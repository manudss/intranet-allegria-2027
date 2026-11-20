import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { HEALTH_FIELDS, FOOD_ALLERGENS, EMPTY_HEALTH, cateringSummary } from '@mej-allegria/shared';
import type { StructuredHealth } from '@mej-allegria/shared';
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
@Injectable()
export class RegistrationHealthService {
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    private readonly families: FamilyRegistrationService,
  ) {}
  enabled() {
    return (
      this.config.get('FAMILY_HEALTH_APPROVAL_REFERENCE') &&
      this.config.get('FAMILY_HEALTH_ENCRYPTION_KEY') &&
      this.config.get('FAMILY_HEALTH_DECLARATION_VERSION') &&
      this.config.get('FAMILY_HEALTH_DECLARATION_TEXT')
    );
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
      'SELECT envelope FROM registration_health WHERE family_id=$1 AND "youthId"=$2',
      [familyId, youthId],
    );
    return row
      ? unseal(row.envelope, this.key(), familyId + ':' + youthId)
      : structuredClone(EMPTY_HEALTH);
  }
  async save(familyId: string, youthId: string, revision: number, raw: unknown) {
    const key = this.key(),
      family = await this.families.get(familyId);
    this.families.editable(this.families.youth(family, youthId));
    const p = plainObject(raw),
      answers = plainObject(p.answers);
    if (
      Object.keys(p).some((k) => !['answers', 'foodAllergens', 'page'].includes(k)) ||
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
    return this.db.transaction(async (m) => {
      await m.query('SELECT id FROM registration_families WHERE id=$1 FOR UPDATE', [familyId]);
      const [row] = await m.query(
        'SELECT revision FROM registration_health WHERE family_id=$1 AND "youthId"=$2',
        [familyId, youthId],
      );
      if ((row?.revision || 0) !== revision)
        throw new BadRequestException('Version sanitaire modifiée dans une autre fenêtre.');
      const data: StructuredHealth = {
        answers: answers as Record<string, string>,
        foodAllergens: [...new Set(p.foodAllergens as string[])] as string[],
        page: Number(p.page),
        revision: revision + 1,
        signature: null,
      };
      await m.query(
        'INSERT INTO registration_health(family_id,"youthId",envelope,revision) VALUES($1,$2,$3,$4) ON CONFLICT(family_id,"youthId") DO UPDATE SET envelope=excluded.envelope,revision=excluded.revision,"updatedAt"=now()',
        [familyId, youthId, seal(data, key, familyId + ':' + youthId), data.revision],
      );
      await m.query(
        'INSERT INTO registration_audit(family_id,"youthId",action,actor) VALUES($1,$2,\'HEALTH_SAVED\',$3)',
        [familyId, youthId, family.email],
      );
      return data;
    });
  }
  async sign(familyId: string, youthId: string, revision: number, raw: unknown) {
    const p = plainObject(raw),
      h = await this.get(familyId, youthId);
    if (
      p.accepted !== true ||
      typeof p.name !== 'string' ||
      !p.name.trim() ||
      p.name.length > 180 ||
      !['LEGAL', 'SELF_ADULT'].includes(String(p.capacity)) ||
      h.revision !== revision
    )
      throw new BadRequestException('Relisez la fiche et identifiez le signataire.');
    const family = await this.families.get(familyId),
      y = this.families.youth(family, youthId);
    this.families.editable(y);
    h.signature = {
      name: p.name.trim(),
      capacity: String(p.capacity),
      at: new Date().toISOString(),
      digest: digest(
        JSON.stringify({
          identity: y.identity,
          contact: family.contact,
          answers: h.answers,
          foodAllergens: h.foodAllergens,
          declarationVersion: this.config.get('FAMILY_HEALTH_DECLARATION_VERSION'),
          declaration: this.config.get('FAMILY_HEALTH_DECLARATION_TEXT'),
        }),
      ),
    };
    h.revision++;
    const rows = await this.db.query(
      'UPDATE registration_health SET envelope=$1,revision=$2,"updatedAt"=now() WHERE family_id=$3 AND "youthId"=$4 AND revision=$5 RETURNING revision',
      [seal(h, this.key(), familyId + ':' + youthId), h.revision, familyId, youthId, revision],
    );
    if (!rows.length) throw new BadRequestException('Sauvegardez la fiche avant de signer.');
    return h;
  }
  async catering() {
    const key = this.key();
    const rows = await this.db.query(
      'SELECT family_id,"youthId",envelope FROM registration_health',
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
}
