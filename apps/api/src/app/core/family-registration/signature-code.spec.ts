import { PGlite } from '@electric-sql/pglite';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { FamilyRegistration1790600000000 } from '../../../database/migrations/1790600000000-FamilyRegistration';
import { FamilyRegistrationService } from './family-registration.service';
import { RegistrationHealthService } from './registration-health.service';
import {
  requestSignatureCode,
  signatureAppearance,
  signatureContext,
  verifySignatureCode,
} from './signature-code';
import { DEFAULT_FAMILY_RULES, EMPTY_CONTACT, newYouth } from '@mej-allegria/shared';

describe('Distinct signature verification, isolated SQL and fake mail transport only', () => {
  let pg: PGlite,
    db: any,
    families: FamilyRegistrationService,
    health: RegistrationHealthService,
    cfg: ConfigService;
  let familyId: string,
    youthId: string,
    email: string,
    sent: { to: string[]; text: string; subject: string }[];
  const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
  const proposal = {
    name: 'Parent FICTIF',
    signerName: 'Parent FICTIF',
    capacity: 'LEGAL',
    version: 'test-v1',
    accepted: true,
    appearance: { method: 'NAME' },
  };
  beforeEach(async () => {
    pg = new PGlite();
    await new FamilyRegistration1790600000000().up({
      query: (sql: string) => pg.exec(sql),
    } as never);
    // Le service liste les délégations proposées à l'inscription (rules() lit
    // groups) : la fixture isolée crée la table minimale, comme les autres
    // specs family-registration.
    await pg.exec(
      "CREATE TABLE groups(id serial PRIMARY KEY, name varchar NOT NULL, diocese varchar); INSERT INTO groups(name, diocese) VALUES('Délégation fictive','Lyon')",
    );
    const query = async (sql: string, args: unknown[] = []) => (await pg.query(sql, args)).rows;
    db = {
      query,
      transaction: async (fn: any) =>
        pg.transaction(async (tx) =>
          fn({
            query: async (sql: string, args: unknown[] = []) => (await tx.query(sql, args)).rows,
          }),
        ),
    };
    cfg = new ConfigService({
      FAMILY_MAIL_PROVIDER: 'resend',
      FAMILY_MAIL_FROM: 'Fiction <fiction@example.test>',
      FAMILY_RESEND_API_KEY: 'fake-not-a-secret',
      FAMILY_HEALTH_APPROVAL_REFERENCE: 'isolated-tests-only',
      FAMILY_HEALTH_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      FAMILY_HEALTH_DECLARATION_VERSION: 'test-v1',
      FAMILY_HEALTH_DECLARATION_TEXT: 'Déclaration FICTIVE',
    });
    families = new FamilyRegistrationService(db, cfg);
    health = new RegistrationHealthService(db, cfg, families);
    familyId = randomUUID();
    youthId = randomUUID();
    email = 'fiction@example.test';
    const y = newYouth(youthId);
    y.identity = {
      ...y.identity,
      firstName: 'Camille',
      lastName: 'FICTIF',
      dateOfBirth: '2012-05-01',
    };
    await query('INSERT INTO registration_families(id,email,dossier) VALUES($1,$2,$3)', [
      familyId,
      email,
      {
        id: familyId,
        email,
        contact: { ...EMPTY_CONTACT, name: 'Parent FICTIF' },
        youths: [y],
        revision: 0,
        updatedAt: new Date().toISOString(),
      },
    ]);
    await query('INSERT INTO registration_settings(id,rules) VALUES(1,$1)', [
      {
        ...DEFAULT_FAMILY_RULES,
        templates: [
          {
            id: 'permission',
            version: 'test-v1',
            title: 'Autorisation FICTIVE',
            text: 'Texte fictif intégral sans valeur réelle.',
            enabled: true,
            required: true,
          },
        ],
      },
    ]);
    await health.save(familyId, youthId, 0, {
      answers: { foodAllergy: 'Consigne FICTIVE' },
      presence: { foodAllergy: 'YES' },
      foodAllergens: [],
      page: 0,
    });
    sent = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, req) => {
        sent.push(JSON.parse(req.body));
        return { ok: true, json: async () => ({ id: 'fictional-mail' }) };
      }),
    );
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await pg.close();
  });
  const code = () => sent[sent.length - 1].text.match(/\d{8}/)![0];
  async function challenge(p: Record<string, unknown> = proposal) {
    return (await health.requestCode(familyId, youthId, 1, p)) as { challengeId: string };
  }
  it('requires a fresh distinct code, binds the appearance and freezes exact PDF bytes in the encrypted envelope', async () => {
    await expect(health.sign(familyId, youthId, 1, proposal)).rejects.toThrow('Code de signature');
    const c = await challenge();
    expect(sent[0].subject).toContain('signature');
    expect(sent[0].text).toContain('distinct');
    expect(sent[0].text).not.toContain('Consigne FICTIVE');
    const row = (await db.query('SELECT * FROM registration_challenges'))[0];
    expect(row.digest).not.toContain(code());
    await expect(
      health.sign(familyId, youthId, 1, { ...proposal, name: 'Autre FICTIF', ...c, code: code() }),
    ).rejects.toThrow('document modifié');
    const signed = await health.sign(familyId, youthId, 1, { ...proposal, ...c, code: code() });
    expect(signed.signature?.verification?.method).toBe('EMAIL_CODE');
    expect(signed.signature?.appearance).toEqual({ method: 'NAME' });
    expect(signed.signedPdf).toBeUndefined();
    expect((await health.get(familyId, youthId)).signedPdf).toBeUndefined();
    const pdf = await health.pdf(familyId, youthId),
      pdfAgain = await health.pdf(familyId, youthId);
    expect(Buffer.from(pdfAgain)).toEqual(Buffer.from(pdf));
    expect(hash(Buffer.from(pdf))).toBe(signed.documentDigest);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(4);
    const stored = (await db.query('SELECT envelope FROM registration_health'))[0].envelope;
    expect(stored).not.toContain('Consigne FICTIVE');
    expect(stored).not.toContain('pdfBase64');
    await expect(
      health.sign(familyId, youthId, 1, { ...proposal, ...c, code: code() }),
    ).rejects.toThrow();
    expect((await db.query('SELECT * FROM registration_health_versions')).length).toBe(1);
  });
  it('cannot use an access code as a signature or a signature code to connect', async () => {
    const id = randomUUID();
    await db.query(
      'INSERT INTO registration_challenges(id,email,digest,"expiresAt") VALUES($1,$2,$3,now()+interval \'10 minutes\')',
      [id, email, hash(id + '12345678')],
    );
    await expect(
      health.sign(familyId, youthId, 1, { ...proposal, challengeId: id, code: '12345678' }),
    ).rejects.toThrow('Code de signature');
    const c = await challenge();
    await expect(families.verify(c.challengeId, code())).rejects.toThrow('Code invalide');
    const signed = await health.sign(familyId, youthId, 1, { ...proposal, ...c, code: code() });
    expect(signed.signature).toBeTruthy();
  });
  it('commits failed attempts, locks after five and refuses an expired code', async () => {
    const c = await challenge();
    for (let i = 0; i < 5; i++)
      await expect(
        health.sign(familyId, youthId, 1, { ...proposal, ...c, code: '00000000' }),
      ).rejects.toThrow();
    expect(
      (
        await db.query('SELECT attempts FROM registration_challenges WHERE id=$1', [c.challengeId])
      )[0].attempts,
    ).toBe(5);
    await expect(
      health.sign(familyId, youthId, 1, { ...proposal, ...c, code: code() }),
    ).rejects.toThrow();
    const expired = await challenge();
    await db.query(
      'UPDATE registration_challenges SET "expiresAt"=now()-interval \'1 minute\' WHERE id=$1',
      [expired.challengeId],
    );
    await expect(
      health.sign(familyId, youthId, 1, { ...proposal, ...expired, code: code() }),
    ).rejects.toThrow();
  });
  it('rejects codes after changed health answers or family identity and refuses another youth/family', async () => {
    const c = await challenge(),
      oldCode = code();
    await health.save(familyId, youthId, 1, {
      answers: { foodAllergy: 'Correction FICTIVE' },
      presence: {},
      foodAllergens: [],
      page: 0,
    });
    await expect(
      health.sign(familyId, youthId, 2, { ...proposal, ...c, code: oldCode }),
    ).rejects.toThrow('document modifié');
    const c2 = (await health.requestCode(familyId, youthId, 2, proposal)) as {
        challengeId: string;
      },
      code2 = code();
    await families.saveContact(familyId, 0, { ...EMPTY_CONTACT, name: 'Contact corrigé FICTIF' });
    await expect(
      health.sign(familyId, youthId, 2, { ...proposal, ...c2, code: code2 }),
    ).rejects.toThrow('document modifié');
    await expect(
      health.sign(randomUUID(), youthId, 2, { ...proposal, ...c2, code: code2 }),
    ).rejects.toThrow();
    await expect(
      health.sign(familyId, randomUUID(), 2, { ...proposal, ...c2, code: code2 }),
    ).rejects.toThrow();
  });
  it('limits requests to three per ten minutes, and cleans up after mail failure without signing', async () => {
    await challenge();
    await challenge();
    await challenge();
    await expect(challenge()).rejects.toThrow('Patientez');
    expect(sent.length).toBe(3);
    await db.query('DELETE FROM registration_challenges');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 })),
    );
    await expect(challenge()).rejects.toThrow('Aucun document');
    expect(await db.query('SELECT * FROM registration_challenges')).toEqual([]);
    expect((await health.get(familyId, youthId)).signature).toBeNull();
  });
  it('signs only the selected authorization, rejects replay and preserves a byte-identical final PDF', async () => {
    const p = { ...proposal, templateId: 'permission' },
      c = (await families.requestSignatureCode(familyId, youthId, 0, p)) as { challengeId: string };
    const s = await families.sign(familyId, youthId, 0, { ...p, ...c, code: code() });
    const signature = s.youths[0].signatures[0];
    expect(signature.verification?.method).toBe('EMAIL_CODE');
    expect(hash(Buffer.from(signature.document!.pdfBase64, 'base64'))).toBe(
      signature.document?.digest,
    );
    expect(
      (await PDFDocument.load(Buffer.from(signature.document!.pdfBase64, 'base64'))).getPageCount(),
    ).toBe(3);
    await expect(
      families.sign(familyId, youthId, s.revision, { ...p, ...c, code: code() }),
    ).rejects.toThrow();
    expect((await health.get(familyId, youthId)).signature).toBeNull();
  });
  it('separates signature purposes, revisions, family ownership and consent in the hash', () => {
    const c = signatureContext('HEALTH', familyId, youthId, 1, 0, { a: 'FICTIF' }, proposal);
    for (const args of [
      ['TEMPLATE:x', familyId, youthId, 1, 0, { a: 'FICTIF' }, proposal],
      ['HEALTH', familyId, youthId, 2, 0, { a: 'FICTIF' }, proposal],
      ['HEALTH', familyId, randomUUID(), 1, 0, { a: 'FICTIF' }, proposal],
      ['HEALTH', familyId, youthId, 1, 0, { a: 'Changed' }, proposal],
    ])
      expect(signatureContext(...(args as Parameters<typeof signatureContext>))).not.toBe(c);
  });
  it('refuses the shared preview account before creating any challenge or contacting a provider', async () => {
    const preview = new ConfigService({
      FAMILY_PREVIEW_DEMO_ENABLED: 'pr42-fictional-only',
      RENDER_SERVICE_NAME: 'al-pr42-api',
      RENDER_GIT_BRANCH: 'feat/family-registration',
      RENDER_EXTERNAL_HOSTNAME: 'al-pr42-api.onrender.com',
      FAMILY_PREVIEW_MAIL_ENABLED: 'owner-only-test',
      FAMILY_PREVIEW_MAIL_TO: 'emmanueldesaintsteban@gmail.com',
    });
    await expect(
      requestSignatureCode(db, preview, familyId, 'famille-demo@example.test', 'context'),
    ).rejects.toThrow('compte fictif partagé');
    expect(sent).toHaveLength(0);
    expect(await db.query('SELECT * FROM registration_challenges')).toHaveLength(0);
  });
  it('validates signature images, never accepts SVG, URLs or malformed payloads', async () => {
    for (const image of [
      'https://example.test/image.png',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:image/png;base64,bm90LWFuLWltYWdl',
      'x'.repeat(66000),
    ])
      await expect(signatureAppearance({ method: 'UPLOAD', image })).rejects.toThrow();
    expect(await signatureAppearance({ method: 'NAME', image: 'ignored' })).toEqual({
      method: 'NAME',
    });
  });
});
