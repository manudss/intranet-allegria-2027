import { familyPreviewEnabled, familyPreviewRecipientAllowed } from './family-preview';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';

const unavailable = () =>
  new ServiceUnavailableException(
    "L'envoi des codes n'est pas encore configuré. Contactez l'organisation ; aucune inscription n'a été perdue.",
  );

/** Explicit provider selection. No automatic fallback or shared project credential. */
export function familyMailSettings(config: ConfigService) {
  const provider = config.get<string>('FAMILY_MAIL_PROVIDER', 'smtp');
  const from = config.get<string>('FAMILY_MAIL_FROM');
  if (!from || from.length > 320 || /[\r\n]/.test(from)) throw unavailable();
  if (provider === 'resend') {
    const key = config.get<string>('FAMILY_RESEND_API_KEY');
    if (!key || /\s/.test(key)) throw unavailable();
    return { provider, from, key } as const;
  }
  if (provider !== 'smtp' || !config.get<string>('FAMILY_SMTP_HOST')) throw unavailable();
  return { provider, from } as const;
}

export async function sendFamilyAccessCode(
  config: ConfigService,
  email: string,
  code: string,
  challengeId: string,
  purpose: 'ACCESS' | 'SIGNATURE' = 'ACCESS',
) {
  if (familyPreviewEnabled(config) && !familyPreviewRecipientAllowed(config, email))
    throw new ForbiddenException('Destinataire de test non autorisé');
  const settings = familyMailSettings(config);
  const subject =
    purpose === 'SIGNATURE'
      ? 'Confirmer votre signature Alegria'
      : 'Votre accès aux inscriptions Alegria';
  const text =
    (purpose === 'SIGNATURE'
      ? 'Code réservé à la signature du document que vous venez de relire, distinct de la connexion. Ne le communiquez à personne.\n'
      : '') +
    `Votre code à usage unique : ${code}\nIl expire dans dix minutes. Ne le partagez pas. Si vous n'avez rien demandé, ignorez ce message.`;
  if (settings.provider === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${settings.key}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Alegria/1.0',
        'Idempotency-Key': `alegria-family-${purpose.toLowerCase()}-${challengeId}`,
      },
      body: JSON.stringify({ from: settings.from, to: [email], subject, text }),
    });
    // Do not expose/log provider payloads: they may echo recipients, credentials or codes.
    if (!response.ok) throw new Error('Family mail provider rejected request');
    const result: unknown = await response.json();
    if (
      !result ||
      typeof result !== 'object' ||
      !('id' in result) ||
      typeof result.id !== 'string' ||
      !result.id
    ) {
      throw new Error('Family mail provider did not acknowledge request');
    }
    return;
  }
  await createTransport({
    host: config.get<string>('FAMILY_SMTP_HOST'),
    port: Number(config.get('FAMILY_SMTP_PORT', 587)),
    secure: config.get('FAMILY_SMTP_SECURE') === 'true',
    requireTLS: true,
    auth: config.get('FAMILY_SMTP_USER')
      ? { user: config.get('FAMILY_SMTP_USER'), pass: config.get('FAMILY_SMTP_PASSWORD') }
      : undefined,
    connectionTimeout: 10000,
  }).sendMail({ from: settings.from, to: email, subject, text });
}
