import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { createTransport } from 'nodemailer';
import {
  DEFAULT_FAMILY_RULES,
  EMPTY_CONTACT,
  EMPTY_IDENTITY,
  EMPTY_LOGISTICS,
  missingRequirements,
  newYouth,
} from '@mej-allegria/shared';
import type { FamilyContact, FamilyRules, FamilySpace, YouthDossier } from '@mej-allegria/shared';
import {
  Participant,
  ParticipantRegistrationStatus,
  PersonSource,
  ParticipantSex,
  MejAgeGroup,
} from '../entities';
export const digest = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
export function plainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Objet attendu');
  return value as Record<string, unknown>;
}
export function strings<T extends object>(raw: unknown, model: T, max = 1000): T {
  const v = plainObject(raw),
    out = { ...model };
  for (const k of Object.keys(v)) {
    if (
      !Object.prototype.hasOwnProperty.call(model, k) ||
      typeof v[k] !== 'string' ||
      (v[k] as string).length > max
    )
      throw new BadRequestException('Champ invalide : ' + k);
    (out as Record<string, unknown>)[k] = (v[k] as string).trim();
  }
  return out;
}
export function emailValue(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 254 || !/^\S+@\S+\.\S+$/.test(raw))
    throw new BadRequestException('Adresse e-mail invalide');
  return raw.trim().toLowerCase();
}
@Injectable()
export class FamilyRegistrationService {
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
  ) {}
  async rules(): Promise<FamilyRules> {
    const rows = await this.db.query('SELECT rules FROM registration_settings WHERE id=1');
    return {
      ...DEFAULT_FAMILY_RULES,
      ...rows[0]?.rules,
      healthMode:
        this.config.get('FAMILY_HEALTH_APPROVAL_REFERENCE') &&
        this.config.get('FAMILY_HEALTH_ENCRYPTION_KEY') &&
        this.config.get('FAMILY_HEALTH_DECLARATION_TEXT') &&
        this.config.get('FAMILY_HEALTH_DECLARATION_VERSION')
          ? 'DIGITAL_APPROVED'
          : 'PAPER',
    };
  }
  async challenge(raw: unknown) {
    const email = emailValue(raw),
      id = randomUUID(),
      code = String(randomInt(10000000, 100000000));
    const host = this.config.get<string>('FAMILY_SMTP_HOST'),
      from = this.config.get<string>('FAMILY_MAIL_FROM');
    if (!host || !from)
      throw new ServiceUnavailableException(
        "L'envoi des codes n'est pas encore configuré. Contactez l'organisation ; aucune inscription n'a été perdue.",
      );
    const recent = await this.db.query(
      'SELECT count(*)::int AS n FROM registration_challenges WHERE email=$1 AND "createdAt">now()-interval \'10 minutes\'',
      [email],
    );
    if (recent[0].n >= 3)
      throw new BadRequestException('Patientez dix minutes avant un nouveau code.');
    await this.db.query('DELETE FROM registration_challenges WHERE "expiresAt"<now()');
    await this.db.query(
      'INSERT INTO registration_challenges(id,email,digest,"expiresAt") VALUES($1,$2,$3,now()+interval \'10 minutes\')',
      [id, email, digest(id + code)],
    );
    try {
      await createTransport({
        host,
        port: Number(this.config.get('FAMILY_SMTP_PORT', 587)),
        secure: this.config.get('FAMILY_SMTP_SECURE') === 'true',
        requireTLS: true,
        auth: this.config.get('FAMILY_SMTP_USER')
          ? {
              user: this.config.get('FAMILY_SMTP_USER'),
              pass: this.config.get('FAMILY_SMTP_PASSWORD'),
            }
          : undefined,
        connectionTimeout: 10000,
      }).sendMail({
        from,
        to: email,
        subject: 'Votre accès aux inscriptions Alegria',
        text: `Votre code à usage unique : ${code}\nIl expire dans dix minutes. Ne le partagez pas. Si vous n'avez rien demandé, ignorez ce message.`,
      });
    } catch {
      await this.db.query('DELETE FROM registration_challenges WHERE id=$1', [id]);
      throw new ServiceUnavailableException("Le code n'a pas pu être envoyé. Réessayez plus tard.");
    }
    return { challengeId: id, message: 'Un code valable dix minutes a été envoyé.' };
  }
  async verify(id: string, code: string) {
    if (!/^[0-9a-f-]{36}$/.test(id) || !/^\d{8}$/.test(code))
      throw new UnauthorizedException('Code invalide ou expiré');
    const result = await this.db.transaction(async (m) => {
      const rows = await m.query('SELECT * FROM registration_challenges WHERE id=$1 FOR UPDATE', [
          id,
        ]),
        c = rows[0];
      if (!c || new Date(c.expiresAt) <= new Date() || c.attempts >= 5) return null;
      if (!timingSafeEqual(Buffer.from(c.digest, 'hex'), Buffer.from(digest(id + code), 'hex'))) {
        await m.query('UPDATE registration_challenges SET attempts=attempts+1 WHERE id=$1', [id]);
        return null;
      }
      await m.query('DELETE FROM registration_challenges WHERE id=$1', [id]);
      const familyId = randomUUID(),
        initial: FamilySpace = {
          id: familyId,
          email: c.email,
          contact: { ...EMPTY_CONTACT },
          youths: [],
          revision: 0,
          updatedAt: new Date().toISOString(),
        };
      await m.query(
        'INSERT INTO registration_families(id,email,dossier) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING',
        [familyId, c.email, initial],
      );
      const [family] = await m.query('SELECT id FROM registration_families WHERE email=$1', [
        c.email,
      ]);
      const token = randomBytes(32).toString('hex');
      await m.query('DELETE FROM registration_sessions WHERE "expiresAt"<now()');
      await m.query(
        'INSERT INTO registration_sessions(digest,family_id,"expiresAt") VALUES($1,$2,now()+interval \'30 days\')',
        [digest(token), family.id],
      );
      return { token, familyId: family.id };
    });
    if (!result) throw new UnauthorizedException('Code invalide ou expiré');
    return result;
  }
  async session(token: string): Promise<string> {
    if (!/^[a-f0-9]{64}$/.test(token || ''))
      throw new UnauthorizedException('Reconnectez-vous pour retrouver vos dossiers.');
    const [s] = await this.db.query(
      'SELECT family_id FROM registration_sessions WHERE digest=$1 AND "expiresAt">now()',
      [digest(token)],
    );
    if (!s) throw new UnauthorizedException('Session expirée. Vos dossiers restent sauvegardés.');
    return s.family_id;
  }
  async logout(token: string) {
    await this.db.query('DELETE FROM registration_sessions WHERE digest=$1', [digest(token || '')]);
  }
  async get(id: string) {
    const [f] = await this.db.query('SELECT dossier FROM registration_families WHERE id=$1', [id]);
    if (!f) throw new NotFoundException();
    return f.dossier as FamilySpace;
  }
  async mutate(
    id: string,
    revision: number,
    action: string,
    work: (space: FamilySpace, m: EntityManager) => Promise<void>,
    youthId?: string,
  ) {
    return this.db.transaction(async (m) => {
      const [row] = await m.query(
        'SELECT dossier FROM registration_families WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!row) throw new NotFoundException();
      const s = row.dossier as FamilySpace;
      if (s.revision !== revision)
        throw new ConflictException(
          "Une autre fenêtre a modifié le dossier. Rechargez avant de continuer ; votre saisie n'a pas été écrasée.",
        );
      await work(s, m);
      s.revision++;
      s.updatedAt = new Date().toISOString();
      await m.query('UPDATE registration_families SET dossier=$1,"updatedAt"=now() WHERE id=$2', [
        s,
        id,
      ]);
      await m.query(
        'INSERT INTO registration_audit(family_id,"youthId",action,actor) VALUES($1,$2,$3,$4)',
        [id, youthId || null, action, s.email],
      );
      return s;
    });
  }
  youth(s: FamilySpace, id: string) {
    const y = s.youths.find((y) => y.id === id);
    if (!y) throw new NotFoundException('Dossier introuvable');
    return y;
  }
  editable(y: YouthDossier) {
    if (!['DRAFT', 'CORRECTION'].includes(y.state))
      throw new ForbiddenException(
        'Le dossier envoyé est en lecture seule. Demandez une correction à l’organisation.',
      );
  }
  add(id: string, revision: number) {
    return this.mutate(id, revision, 'YOUTH_CREATED', async (s) => {
      if (s.youths.length >= 10)
        throw new BadRequestException('Dix jeunes maximum par espace. Contactez l’organisation.');
      s.youths.push(newYouth(randomUUID(), s.contact.city));
    });
  }
  saveContact(id: string, revision: number, raw: unknown) {
    const contact = strings(raw, EMPTY_CONTACT) as FamilyContact;
    return this.mutate(id, revision, 'CONTACT_SAVED', async (s) => {
      if (s.youths.some((y) => !['DRAFT', 'CORRECTION'].includes(y.state)))
        throw new ForbiddenException(
          'Des dossiers sont déjà envoyés : contactez l’organisation pour corriger les contacts communs.',
        );
      if (JSON.stringify(s.contact) !== JSON.stringify(contact))
        for (const y of s.youths)
          y.signatures = y.signatures.map((a) => ({
            ...a,
            withdrawnAt: a.withdrawnAt || new Date().toISOString(),
          }));
      s.contact = contact;
    });
  }
  saveYouth(id: string, youthId: string, revision: number, raw: unknown) {
    const p = plainObject(raw);
    if (
      Object.keys(p).some(
        (k) => !['identity', 'logistics', 'currentPage', 'simulation'].includes(k),
      )
    )
      throw new BadRequestException('Champ non modifiable');
    return this.mutate(
      id,
      revision,
      'DRAFT_SAVED',
      async (s) => {
        const y = this.youth(s, youthId);
        this.editable(y);
        const before = JSON.stringify([y.identity, y.logistics]);
        if (p.identity) y.identity = strings(p.identity, EMPTY_IDENTITY);
        if (p.logistics) y.logistics = strings(p.logistics, EMPTY_LOGISTICS);
        if (p.currentPage !== undefined) {
          if (
            !Number.isInteger(p.currentPage) ||
            Number(p.currentPage) < 0 ||
            Number(p.currentPage) > 6
          )
            throw new BadRequestException();
          y.currentPage = Number(p.currentPage);
        }
        if (p.simulation !== undefined) {
          if (!['NOT_TESTED', 'SUCCESS', 'FAILURE', 'CANCELLED'].includes(String(p.simulation)))
            throw new BadRequestException();
          y.simulation = p.simulation as YouthDossier['simulation'];
        }
        if (before !== JSON.stringify([y.identity, y.logistics]))
          y.signatures = y.signatures.map((a) => ({ ...a, withdrawnAt: new Date().toISOString() }));
        y.revision++;
      },
      youthId,
    );
  }
  async sign(id: string, youthId: string, revision: number, raw: unknown) {
    const p = plainObject(raw),
      rules = await this.rules(),
      template = rules.templates.find((t) => t.id === p.templateId && t.enabled);
    if (
      !template ||
      !template.text ||
      p.version !== template.version ||
      p.accepted !== true ||
      typeof p.signerName !== 'string' ||
      !p.signerName.trim() ||
      p.signerName.length > 180 ||
      !['LEGAL', 'SELF_ADULT'].includes(String(p.capacity))
    )
      throw new BadRequestException('Relisez le document et identifiez le signataire.');
    return this.mutate(
      id,
      revision,
      'DOCUMENT_ATTESTED',
      async (s) => {
        const y = this.youth(s, youthId);
        this.editable(y);
        const content = JSON.stringify({
          template,
          identity: y.identity,
          logistics: y.logistics,
          contact: s.contact,
        });
        y.signatures = y.signatures.map((a) =>
          a.templateId === template.id
            ? { ...a, withdrawnAt: a.withdrawnAt || new Date().toISOString() }
            : a,
        );
        y.signatures.push({
          templateId: template.id,
          version: template.version,
          digest: digest(content),
          snapshot: content,
          signerName: String(p.signerName).trim(),
          capacity: String(p.capacity),
          signedAt: new Date().toISOString(),
        });
      },
      youthId,
    );
  }
  async submit(id: string, youthId: string, revision: number, accepted: unknown) {
    const rules = await this.rules();
    if (!rules.registrationOpen)
      throw new ForbiddenException(
        "L'envoi final n'est pas encore ouvert par l'organisation. Vos brouillons restent sauvegardés.",
      );
    if (accepted !== true)
      throw new BadRequestException('Veuillez relire et attester le récapitulatif.');
    return this.mutate(
      id,
      revision,
      'DOSSIER_SUBMITTED',
      async (s, m) => {
        const y = this.youth(s, youthId);
        this.editable(y);
        const missing = missingRequirements(y, s.contact, rules);
        if (missing.length)
          throw new BadRequestException({ message: 'Dossier à compléter', missing });
        const repo = m.getRepository(Participant);
        const participant = await repo.save(
          repo.create({
            ...(y.participantId ? { id: y.participantId } : {}),
            firstName: y.identity.firstName,
            lastName: y.identity.lastName,
            dateOfBirth: y.identity.dateOfBirth,
            sex: y.identity.sex as ParticipantSex,
            mejAgeGroup: y.identity.mejAgeGroup as MejAgeGroup,
            diocese: y.identity.dioceseId,
            city: y.identity.city || s.contact.city,
            emergencyContactName: s.contact.emergencyName,
            emergencyContactPhone: s.contact.emergencyPhone,
            status: ParticipantRegistrationStatus.PENDING,
            source: PersonSource.PUBLIC_FORM,
          }),
        );
        y.participantId = participant.id;
        y.state = 'SUBMITTED';
        y.submittedAt = new Date().toISOString();
      },
      youthId,
    );
  }
  async list() {
    const rows = await this.db.query(
      'SELECT id,email,dossier FROM registration_families ORDER BY "updatedAt" DESC LIMIT 500',
    );
    return rows.map((r: { id: string; email: string; dossier: FamilySpace }) => ({
      id: r.id,
      email: r.email,
      contact: r.dossier.contact,
      youths: r.dossier.youths,
      revision: r.dossier.revision,
    }));
  }
  async review(id: string, youthId: string, revision: number, state: unknown, reason: unknown) {
    if (!['CORRECTION', 'VALIDATED', 'CONFIRMED', 'REFUSED', 'CANCELLED'].includes(String(state)))
      throw new BadRequestException();
    if (state === 'CORRECTION' && (typeof reason !== 'string' || !reason.trim()))
      throw new BadRequestException('Motif de correction requis, sans information médicale.');
    return this.mutate(
      id,
      revision,
      'STAFF_' + state,
      async (s, m) => {
        const y = this.youth(s, youthId);
        if (y.state === 'DRAFT') throw new BadRequestException('Dossier non envoyé');
        y.state = state as YouthDossier['state'];
        y.correction = typeof reason === 'string' ? reason.slice(0, 500) : '';
        if (y.participantId && state === 'CONFIRMED')
          await m
            .getRepository(Participant)
            .update(y.participantId, { status: ParticipantRegistrationStatus.CONFIRMED });
      },
      youthId,
    );
  }
  async configure(raw: unknown) {
    const p = plainObject(raw);
    const rules = { ...DEFAULT_FAMILY_RULES, ...p, healthMode: 'PAPER' } as FamilyRules;
    if (
      typeof rules.registrationOpen !== 'boolean' ||
      !Array.isArray(rules.templates) ||
      rules.templates.length > 20
    )
      throw new BadRequestException();
    for (const t of rules.templates) {
      if (
        !t.id ||
        !t.title ||
        !t.version ||
        typeof t.text !== 'string' ||
        t.text.length > 30000 ||
        typeof t.enabled !== 'boolean' ||
        typeof t.required !== 'boolean'
      )
        throw new BadRequestException('Modèle invalide');
    }
    if (rules.registrationOpen && !rules.ageReferenceDate)
      throw new BadRequestException('Fixez la date de référence des âges avant ouverture.');
    await this.db.query(
      'INSERT INTO registration_settings(id,rules) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET rules=excluded.rules',
      [rules],
    );
    return this.rules();
  }
}
