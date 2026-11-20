import type { ConfigService } from '@nestjs/config';
/** Temporary PR42 demo access, fail closed outside this exact disposable deployment. */
export const PREVIEW_FAMILY_EMAIL = 'famille-demo@example.test';
export function familyPreviewEnabled(config: Pick<ConfigService, 'get'>): boolean {
  return (
    config.get('FAMILY_PREVIEW_DEMO_ENABLED') === 'pr42-fictional-only' &&
    config.get('RENDER_SERVICE_NAME') === 'al-pr42-api' &&
    (config.get('RENDER_GIT_BRANCH') === 'feat/family-registration' ||
      (!config.get('RENDER_GIT_BRANCH') &&
        config.get('FAMILY_PREVIEW_IMAGE_ENABLED') === 'pr42-prebuilt-only')) &&
    /^al-pr42-api(?:-[a-z0-9]+)?\.onrender\.com$/.test(
      String(config.get('RENDER_EXTERNAL_HOSTNAME') || ''),
    )
  );
}

/** Temporary owner-only registration test. Never enables general preview sending. */
export function familyPreviewMailEnabled(config: Pick<ConfigService, 'get'>): boolean {
  return (
    familyPreviewEnabled(config) &&
    config.get('FAMILY_PREVIEW_MAIL_ENABLED') === 'owner-only-test' &&
    config.get('FAMILY_PREVIEW_MAIL_TO') === 'emmanueldesaintsteban@gmail.com'
  );
}
export function familyPreviewRecipientAllowed(
  config: Pick<ConfigService, 'get'>,
  email: string,
): boolean {
  return familyPreviewMailEnabled(config) && email === config.get('FAMILY_PREVIEW_MAIL_TO');
}
