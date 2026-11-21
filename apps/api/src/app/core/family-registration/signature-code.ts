import { familyPreviewEnabled, familyPreviewRecipientAllowed } from './family-preview';
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { DataSource } from 'typeorm';
import { PDFDocument } from 'pdf-lib';
import { familyMailSettings, sendFamilyAccessCode } from './family-mail';
import type { SignatureAppearance, SignatureVerification } from '@mej-allegria/shared';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const invalid = () =>
  new UnauthorizedException(
    'Code de signature invalide, expiré ou document modifié. Demandez un nouveau code.',
  );
/** Only hashes live in the existing challenge table. Domain separation prevents login/signature reuse. */
export async function signatureAppearance(raw: unknown): Promise<SignatureAppearance> {
  const p = raw as SignatureAppearance;
  if (!p || !['NAME', 'DRAW', 'UPLOAD'].includes(p.method))
    throw new BadRequestException('Choisissez une apparence de signature.');
  if (p.method === 'NAME') return { method: 'NAME' };
  if (
    typeof p.image !== 'string' ||
    p.image.length > 65000 ||
    !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(p.image)
  )
    throw new BadRequestException('Image de signature invalide ou trop volumineuse.');
  try {
    const bytes = Buffer.from(p.image.split(',')[1], 'base64');
    if (
      p.image.startsWith('data:image/png') &&
      (bytes.length < 24 || bytes.readUInt32BE(16) > 4096 || bytes.readUInt32BE(20) > 4096)
    )
      throw new Error();
    const pdf = await PDFDocument.create();
    const img = p.image.startsWith('data:image/png')
      ? await pdf.embedPng(p.image)
      : await pdf.embedJpg(p.image);
    if (img.width < 1 || img.height < 1 || img.width > 4096 || img.height > 4096) throw new Error();
  } catch {
    throw new BadRequestException('Choisissez une image PNG ou JPEG valide.');
  }
  return { method: p.method, image: p.image };
}
export function signatureContext(
  purpose: string,
  familyId: string,
  youthId: string,
  revision: number,
  familyRevision: number,
  content: unknown,
  proposal: unknown,
) {
  return hash(
    JSON.stringify([
      'alegria-signature-v1',
      purpose,
      familyId,
      youthId,
      revision,
      familyRevision,
      content,
      proposal,
    ]),
  );
}
export async function requestSignatureCode(
  db: DataSource,
  config: ConfigService,
  familyId: string,
  email: string,
  context: string,
) {
  if (familyPreviewEnabled(config) && !familyPreviewRecipientAllowed(config, email))
    throw new ForbiddenException(
      "Le compte fictif partagé n'envoie pas d'e-mail. Utilisez votre accès e-mail de test autorisé.",
    );
  familyMailSettings(config);
  const id = randomUUID(),
    code = String(randomInt(10000000, 100000000));
  await db.transaction(async (m) => {
    await m.query('SELECT id FROM registration_families WHERE id=$1 FOR UPDATE', [familyId]);
    const [recent] = await m.query(
      'SELECT count(*)::int AS n FROM registration_challenges WHERE email=$1 AND "createdAt">now()-interval \'10 minutes\'',
      [email],
    );
    if (recent.n >= 3)
      throw new BadRequestException('Patientez dix minutes avant un nouveau code.');
    await m.query('DELETE FROM registration_challenges WHERE "expiresAt"<now()');
    await m.query(
      'INSERT INTO registration_challenges(id,email,digest,"expiresAt") VALUES($1,$2,$3,now()+interval \'10 minutes\')',
      [id, email, hash(id + ':' + context + ':' + code)],
    );
  });
  try {
    await sendFamilyAccessCode(config, email, code, id, 'SIGNATURE');
  } catch {
    await db.query('DELETE FROM registration_challenges WHERE id=$1', [id]);
    throw new ServiceUnavailableException(
      "Le code de signature n'a pas pu être envoyé. Aucun document n'a été signé.",
    );
  }
  return {
    challengeId: id,
    context,
    expiresInSeconds: 600,
    recipient: email.replace(/^(.).*(@.*)$/, '$1***$2'),
    message: 'Code de signature envoyé. Il expire dans dix minutes.',
  };
}
export async function verifySignatureCode(
  db: DataSource,
  email: string,
  context: string,
  id: unknown,
  code: unknown,
): Promise<SignatureVerification> {
  if (
    typeof id !== 'string' ||
    !/^[0-9a-f-]{36}$/.test(id) ||
    typeof code !== 'string' ||
    !/^\d{8}$/.test(code)
  )
    throw invalid();
  // Failure is returned, not thrown inside the transaction: failed-attempt counters must commit.
  const ok = await db.transaction(async (m) => {
    const [c] = await m.query('SELECT * FROM registration_challenges WHERE id=$1 FOR UPDATE', [id]);
    if (!c || c.email !== email || new Date(c.expiresAt) <= new Date() || c.attempts >= 5)
      return false;
    if (
      !timingSafeEqual(
        Buffer.from(c.digest, 'hex'),
        Buffer.from(hash(id + ':' + context + ':' + code), 'hex'),
      )
    ) {
      await m.query('UPDATE registration_challenges SET attempts=attempts+1 WHERE id=$1', [id]);
      return false;
    }
    await m.query('DELETE FROM registration_challenges WHERE id=$1', [id]);
    return true;
  });
  if (!ok) throw invalid();
  return { method: 'EMAIL_CODE', challengeId: id, verifiedAt: new Date().toISOString(), context };
}
