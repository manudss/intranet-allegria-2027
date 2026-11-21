import { healthPdf, healthPdfSourceDigest } from './health-pdf';
import {
  signatureAppearance,
  signatureContext,
  requestSignatureCode,
  verifySignatureCode,
} from './signature-code';
import {
  familyPreviewEnabled,
  familyPreviewHealthEnabled,
  PREVIEW_FAMILY_EMAIL,
} from './family-preview';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  HEALTH_FIELDS,
  HEALTH_MODEL_ITEMS,
  HEALTH_WEB_ITEMS,
  FOOD_ALLERGENS,
  EMPTY_HEALTH,
  cateringSummary,
  ageOn,
} from '@mej-allegria/shared';
import type { StructuredHealth, FamilySpace } from '@mej-allegria/shared';
import { FamilyRegistrationService, digest, plainObject } from './family-registration.service';
export function seal(value: unknown, key: Buffer, context: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((b) => b.toString('base64')).join('.');
}
export function unseal(envelope: string, key: Buffer, context: string): StructuredHealth {
  const [iv, tag, content] = envelope.split('.').map((s) => Buffer.from(s, 'base64'));
  const cipher = createDecipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(content), cipher.final()]).toString('utf8'));
}
export function validatedHealth(raw: unknown) {
  const p = plainObject(raw),
    answers = plainObject(p.answers),
    presence = plainObject(p.presence ?? {});
  if (
    Object.entries(presence).some(
      ([key, value]) =>
        ![...HEALTH_MODEL_ITEMS, ...HEALTH_WEB_ITEMS].some((item) => item.id === key) ||
        !['YES', 'NO'].includes(String(value)),
    )
  )
    throw new BadRequestException('Choix du modèle sanitaire invalide');
  if (
    Object.keys(p).some((k) => !['answers', 'presence', 'foodAllergens', 'page'].includes(k)) ||
    Object.keys(answers).some(
      (k) =>
        !HEALTH_FIELDS.includes(k as never) ||
        typeof answers[k] !== 'string' ||
        String(answers[k]).length > 3000,
    ) ||
    !Array.isArray(p.foodAllergens) ||
    p.foodAllergens.some((a) => !FOOD_ALLERGENS.includes(a)) ||
    !Number.isInteger(p.page) ||
    Number(p.page) < 0 ||
    Number(p.page) > 6
  )
    throw new BadRequestException('Champ sanitaire invalide');
  return {
    answers: answers as Record<string, string>,
    presence: presence as StructuredHealth['presence'],
    foodAllergens: [...new Set(p.foodAllergens as string[])],
    page: Number(p.page),
    revision: 0,
    signature: null,
  } satisfies StructuredHealth;
}
@Injectable()
export class RegistrationHealthService {
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    private readonly families: FamilyRegistrationService,
  ) {}
  enabled() {
    if (familyPreviewEnabled(this.config))
      return (
        familyPreviewHealthEnabled(this.config) &&
        Buffer.from(this.config.get<string>('FAMILY_HEALTH_ENCRYPTION_KEY', ''), 'base64')
          .length === 32
      );
    return (
      this.config.get('FAMILY_HEALTH_APPROVAL_REFERENCE') &&
      this.config.get('FAMILY_HEALTH_ENCRYPTION_KEY') &&
      this.config.get('FAMILY_HEALTH_DECLARATION_VERSION') &&
      this.config.get('FAMILY_HEALTH_DECLARATION_TEXT')
    );
  }
  declaration() {
    this.key();
    return {
      version: familyPreviewHealthEnabled(this.config)
        ? 'demo-fiction-1'
        : this.config.get<string>('FAMILY_HEALTH_DECLARATION_VERSION'),
      text: familyPreviewHealthEnabled(this.config)
        ? 'DÉMONSTRATION : données fictives uniquement. Cette attestation de test ne vaut ni collecte qualifiée ni prise en charge réelle.'
        : this.config.get<string>('FAMILY_HEALTH_DECLARATION_TEXT'),
    };
  }
  private key() {
    if (!this.enabled())
      throw new ForbiddenException(
        'Collecte sanitaire numérique non activée : circuit à qualifier.',
      );
    const key = Buffer.from(this.config.get<string>('FAMILY_HEALTH_ENCRYPTION_KEY', ''), 'base64');
    if (key.length !== 32) throw new ForbiddenException('Configuration sanitaire incomplète');
    return key;
  }
  async get(familyId: string, youthId: string) {
    this.key();
    this.families.youth(await this.families.get(familyId), youthId);
    const [row] = await this.db.query(
      'SELECT envelope,"signatureValid" FROM registration_health WHERE family_id=$1 AND "youthId"=$2',
      [familyId, youthId],
    );
    if (!row) {
      const sample = await this.demoSample(familyId, youthId);
      return sample || structuredClone(EMPTY_HEALTH);
    }
    const data = unseal(row.envelope, this.key(), familyId + ':' + youthId);
    if (!row.signatureValid) {
      data.signature = null;
      delete data.signedPayload;
      delete data.documentDigest;
    }
    delete data.signedPdf;
    return data;
  }
  async pdf(familyId: string, youthId: string) {
    const family = await this.families.get(familyId),
      youth = this.families.youth(family, youthId);
    const current = await this.get(familyId, youthId);
    const [row] = await this.db.query(
      'SELECT envelope,"signatureValid" FROM registration_health WHERE family_id=$1 AND "youthId"=$2',
      [familyId, youthId],
    );
    const data = row?.signatureValid
      ? unseal(row.envelope, this.key(), familyId + ':' + youthId)
      : current;
    return healthPdf(family, youth, data, String(this.declaration().text));
  }
  async preview(familyId: string, youthId: string, raw: unknown, planned?: unknown) {
    this.key();
    const family = await this.families.get(familyId),
      youth = this.families.youth(family, youthId),
      h = validatedHealth(raw);
    const p = planned ? plainObject(planned) : null;
    const mark = p
      ? {
          name: typeof p.name === 'string' ? p.name.trim().slice(0, 180) : '',
          appearance: await signatureAppearance(p.appearance),
        }
      : undefined;
    return healthPdf(family, youth, h, String(this.declaration().text), mark);
  }
  async save(familyId: string, youthId: string, revision: number, raw: unknown) {
    const key = this.key(),
      family = await this.families.get(familyId);
    this.families.editable(this.families.youth(family, youthId));
    const clean = validatedHealth(raw),
      answers = clean.answers,
      presence = clean.presence;
    return this.db.transaction(async (m) => {
      const [fresh] = await m.query(
        'SELECT dossier FROM registration_families WHERE id=$1 FOR UPDATE',
        [familyId],
      );
      this.families.editable(this.families.youth(fresh.dossier, youthId));
      const [row] = await m.query(
        'SELECT revision,envelope,"signatureValid" FROM registration_health WHERE family_id=$1 AND "youthId"=$2',
        [familyId, youthId],
      );
      if ((row?.revision || 0) !== revision)
        throw new BadRequestException('Version sanitaire modifiée dans une autre fenêtre.');
      const data: StructuredHealth = {
        answers: answers as Record<string, string>,
        presence: presence as StructuredHealth['presence'],
        foodAllergens: [...new Set(clean.foodAllergens)] as string[],
        page: clean.page,
        revision: revision + 1,
        signature: null,
      };
      const previous = row?.envelope ? unseal(row.envelope, key, familyId + ':' + youthId) : null;
      const content = (h: StructuredHealth) =>
        JSON.stringify({
          answers: HEALTH_FIELDS.map((k) => h.answers[k] || ''),
          presence: [...HEALTH_MODEL_ITEMS, ...HEALTH_WEB_ITEMS].map(
            (i) => h.presence?.[i.id] || '',
          ),
          foodAllergens: [...h.foodAllergens].sort(),
        });
      if (previous && row.signatureValid && content(previous) === content(data)) {
        data.signature = previous.signature;
        data.signedPayload = previous.signedPayload;
        data.signedPdf = previous.signedPdf;
        data.documentDigest = previous.documentDigest;
      }
      await m.query(
        'INSERT INTO registration_health(family_id,"youthId",envelope,revision,"signatureValid") VALUES($1,$2,$3,$4,$5) ON CONFLICT(family_id,"youthId") DO UPDATE SET envelope=excluded.envelope,revision=excluded.revision,"signatureValid"=excluded."signatureValid","updatedAt"=now()',
        [
          familyId,
          youthId,
          seal(data, key, familyId + ':' + youthId),
          data.revision,
          !!data.signature,
        ],
      );
      await m.query(
        'INSERT INTO registration_audit(family_id,"youthId",action,actor) VALUES($1,$2,\'HEALTH_SAVED\',$3)',
        [familyId, youthId, family.email],
      );
      delete data.signedPdf;
      return data;
    });
  }
  async signatureAction(
    familyId: string,
    youthId: string,
    revision: number,
    raw: unknown,
    requestCode = false,
  ) {
    const p = plainObject(raw),
      key = this.key();
    if (
      p.version !== this.declaration().version ||
      p.accepted !== true ||
      typeof p.name !== 'string' ||
      !p.name.trim() ||
      p.name.length > 180 ||
      !['LEGAL', 'SELF_ADULT'].includes(String(p.capacity))
    )
      throw new BadRequestException('Relisez la fiche et identifiez le signataire.');
    const familyBefore = await this.families.get(familyId),
      youthBefore = this.families.youth(familyBefore, youthId),
      before = await this.get(familyId, youthId),
      appearance = await signatureAppearance(p.appearance);
    this.families.editable(youthBefore);
    if (before.revision !== revision || !revision)
      throw new BadRequestException('Sauvegardez la fiche avant de signer.');
    if (
      p.capacity === 'SELF_ADULT' &&
      (ageOn(youthBefore.identity.dateOfBirth, new Date().toISOString().slice(0, 10)) ?? -1) < 18
    )
      throw new BadRequestException('Un représentant légal est nécessaire pour un mineur.');
    const proposal = {
        name: String(p.name).trim(),
        capacity: String(p.capacity),
        appearance,
        version: p.version,
        accepted: true,
      },
      context = signatureContext(
        'HEALTH',
        familyId,
        youthId,
        revision,
        familyBefore.revision,
        {
          identity: youthBefore.identity,
          contact: familyBefore.contact,
          answers: before.answers,
          presence: before.presence || {},
          foodAllergens: before.foodAllergens,
          declaration: this.declaration(),
          sourcePdfDigest: await healthPdfSourceDigest(),
        },
        proposal,
      );
    if (requestCode)
      return requestSignatureCode(this.db, this.config, familyId, familyBefore.email, context);
    const verification = await verifySignatureCode(
      this.db,
      familyBefore.email,
      context,
      p.challengeId,
      p.code,
    );
    return this.db.transaction(async (m) => {
      const [row] = await m.query(
        'SELECT dossier FROM registration_families WHERE id=$1 FOR UPDATE',
        [familyId],
      );
      if (!row) throw new BadRequestException('Dossier introuvable');
      if (row.dossier.revision !== familyBefore.revision)
        throw new BadRequestException(
          'Le dossier a changé. Relisez le document et demandez un nouveau code.',
        );
      const family = row.dossier,
        y = this.families.youth(family, youthId);
      this.families.editable(y);
      if (
        p.capacity === 'SELF_ADULT' &&
        (ageOn(y.identity.dateOfBirth, new Date().toISOString().slice(0, 10)) ?? -1) < 18
      )
        throw new BadRequestException('Un représentant légal est nécessaire pour un mineur.');
      const [stored] = await m.query(
        'SELECT envelope,revision FROM registration_health WHERE family_id=$1 AND "youthId"=$2',
        [familyId, youthId],
      );
      if (!stored || stored.revision !== revision)
        throw new BadRequestException('Sauvegardez la fiche avant de signer.');
      const h = unseal(stored.envelope, key, familyId + ':' + youthId);
      h.signedPayload = JSON.stringify({
        identity: y.identity,
        contact: family.contact,
        answers: h.answers,
        presence: h.presence || {},
        foodAllergens: h.foodAllergens,
        declarationVersion: this.declaration().version,
        declaration: this.declaration().text,
      });
      h.signature = {
        name: String(p.name).trim(),
        capacity: String(p.capacity),
        at: new Date().toISOString(),
        digest: digest(h.signedPayload),
        appearance,
        verification,
      };
      delete h.signedPdf;
      delete h.documentDigest;
      const bytes = await healthPdf(family, y, h, String(this.declaration().text));
      h.signedPdf = Buffer.from(bytes).toString('base64');
      h.documentDigest = digest(Buffer.from(bytes));
      h.revision++;
      const envelope = seal(h, key, familyId + ':' + youthId);
      await m.query(
        'UPDATE registration_health SET envelope=$1,revision=$2,"signatureValid"=true,"updatedAt"=now() WHERE family_id=$3 AND "youthId"=$4',
        [envelope, h.revision, familyId, youthId],
      );
      await m.query(
        'INSERT INTO registration_health_versions(family_id,"youthId",envelope) VALUES($1,$2,$3)',
        [familyId, youthId, envelope],
      );
      await m.query(
        `INSERT INTO registration_audit(family_id,"youthId",action,actor) VALUES($1,$2,'HEALTH_ATTESTED',$3)`,
        [familyId, youthId, family.email],
      );
      delete h.signedPdf;
      return h;
    });
  }
  async sign(familyId: string, youthId: string, revision: number, raw: unknown) {
    return (await this.signatureAction(familyId, youthId, revision, raw)) as StructuredHealth;
  }
  async requestCode(familyId: string, youthId: string, revision: number, raw: unknown) {
    return this.signatureAction(familyId, youthId, revision, raw, true);
  }
  private async demoSample(familyId: string, youthId: string) {
    if (!familyPreviewHealthEnabled(this.config)) return null;
    const family = await this.families.get(familyId);
    if (family.email !== PREVIEW_FAMILY_EMAIL) return null;
    const rules = await this.families.rules();
    return rules.previewHealthSamples?.[youthId]
      ? structuredClone(rules.previewHealthSamples[youthId])
      : null;
  }
  async catering() {
    const key = this.key();
    const rows = await this.db.query(
      `SELECT h.family_id,h."youthId",h.envelope FROM registration_health_submissions h JOIN registration_families f ON f.id=h.family_id WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(f.dossier->'youths') y WHERE y->>'id'=h."youthId"::text AND y->>'state' IN ('SUBMITTED','VALIDATED','CONFIRMED'))`,
    );
    const records = rows
      .map((r: { family_id: string; youthId: string; envelope: string }) =>
        unseal(r.envelope, key, r.family_id + ':' + r.youthId),
      )
      .filter((h: StructuredHealth) => h.signature);
    return {
      notice:
        'Besoins alimentaires agrégés. Aucun nom ni donnée médicale détaillée. Effectifs inférieurs à cinq non affichés. Cette vue ne remplace pas les consignes confidentielles de prise en charge.',
      items: cateringSummary(records),
    };
  }
  async staffList() {
    this.key();
    const rows = await this.db.query(
      `SELECT f.id,f.dossier,h."youthId",true AS "signatureValid",h."submittedAt" AS "updatedAt" FROM registration_health_submissions h JOIN registration_families f ON f.id=h.family_id ORDER BY h."submittedAt" DESC`,
    );
    if (familyPreviewHealthEnabled(this.config)) {
      const all: FamilySpace[] = await this.families.list();
      for (const f of all.filter((f) => f.email === PREVIEW_FAMILY_EMAIL)) {
        for (const y of f.youths.filter((y) => y.state !== 'DRAFT')) {
          if (
            !rows.some(
              (r: { id: string; youthId: string }) => r.id === f.id && r.youthId === y.id,
            ) &&
            (await this.demoSample(f.id, y.id))
          )
            rows.push({
              id: f.id,
              dossier: f,
              youthId: y.id,
              signatureValid: !!(await this.demoSample(f.id, y.id))?.signature,
              updatedAt: y.submittedAt || '',
            });
        }
      }
    }
    return rows.flatMap(
      (r: {
        id: string;
        dossier: FamilySpace;
        youthId: string;
        signatureValid: boolean;
        updatedAt: string;
      }) => {
        const y = r.dossier.youths.find((y) => y.id === r.youthId);
        return y && !['DRAFT'].includes(y.state)
          ? [
              {
                familyId: r.id,
                youthId: y.id,
                participantId: y.participantId,
                name: y.identity.firstName + ' ' + y.identity.lastName,
                state: y.state,
                attested: r.signatureValid,
                updatedAt: r.updatedAt,
              },
            ]
          : [];
      },
    );
  }
  async staffRead(family: string, youth: string, actor: string) {
    const f = await this.families.get(family),
      y = this.families.youth(f, youth);
    if (y.state === 'DRAFT') throw new ForbiddenException('Dossier non envoyé');
    const [row] = await this.db.query(
      'SELECT envelope FROM registration_health_submissions WHERE family_id=$1 AND "youthId"=$2',
      [family, youth],
    );
    this.key();
    const data = row
      ? unseal(row.envelope, this.key(), family + ':' + youth)
      : await this.demoSample(family, youth);
    if (!data) throw new BadRequestException('Aucune fiche sanitaire transmise');
    const snapshot = data.signedPayload ? JSON.parse(data.signedPayload) : null;
    await this.db.query(
      `INSERT INTO registration_audit(family_id,"youthId",action,actor) VALUES($1,$2,'HEALTH_READ',$3)`,
      [family, youth, actor],
    );
    return {
      administrative:
        y.administrativeAtSubmission ||
        (y.state !== 'CORRECTION'
          ? {
              identity: snapshot?.identity || y.identity,
              logistics: y.logistics,
              signatures: y.signatures,
              simulation: y.simulation,
              paperHealth: y.paperHealth,
              submittedAt: y.submittedAt,
              participantId: y.participantId,
            }
          : null),
      administrativeNotice: y.administrativeAtSubmission
        ? 'Version administrative transmise par la famille.'
        : y.state === 'CORRECTION'
          ? 'Ancien dossier : aucun instantané administratif complet disponible. La correction non renvoyée reste privée.'
          : 'Dossier transmis antérieur à la création des instantanés administratifs complets.',
      identity: snapshot?.identity || y.identity,
      contact: snapshot?.contact || y.contactAtSubmission || f.contact,
      health: data,
    };
  }
}
