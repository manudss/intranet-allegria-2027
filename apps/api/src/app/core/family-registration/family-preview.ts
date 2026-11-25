import type { ConfigService } from '@nestjs/config';
/** Temporary PR42 demo access, fail closed outside this exact disposable deployment. */
export const PREVIEW_FAMILY_EMAIL = 'famille-demo@example.test';
export function familyPreviewEnabled(config: Pick<ConfigService, 'get'>): boolean {
  return pr42PreviewEnabled(config) || pr49PreviewEnabled(config);
}

/**
 * PR49 test phase (user decision of 24 Nov 2026: everything open to test while the interface is
 * being built, fictional data only). Same fail-closed shape as PR42: explicit opt-ins, exact
 * disposable image service name and hostname, no Git branch. Never matches production or another PR.
 */
function pr49PreviewEnabled(config: Pick<ConfigService, 'get'>): boolean {
  return (
    config.get('FAMILY_PREVIEW_DEMO_ENABLED') === 'pr49-fictional-only' &&
    config.get('FAMILY_PREVIEW_IMAGE_ENABLED') === 'pr49-prebuilt-only' &&
    config.get('PREVIEW_DEPLOYMENT') === 'true' &&
    config.get('RENDER_SERVICE_NAME') === 'al-pr49-api-qkcc' &&
    !config.get('RENDER_GIT_BRANCH') &&
    config.get('RENDER_EXTERNAL_HOSTNAME') === 'al-pr49-api-qkcc.onrender.com'
  );
}

function pr42PreviewEnabled(config: Pick<ConfigService, 'get'>): boolean {
  return (
    config.get('FAMILY_PREVIEW_DEMO_ENABLED') === 'pr42-fictional-only' &&
    (config.get('RENDER_SERVICE_NAME') === 'al-pr42-api' ||
      (config.get('RENDER_SERVICE_NAME') === 'al-pr42-api-hz8q' &&
        config.get('RENDER_SERVICE_ID') === 'srv-dc06l5mc6qcc73b9ar00')) &&
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

/** Demo health is never the production approval circuit. */
export function familyPreviewHealthEnabled(config: Pick<ConfigService, 'get'>): boolean {
  return (
    familyPreviewEnabled(config) &&
    config.get('FAMILY_PREVIEW_HEALTH_ENABLED') === 'fictional-health-only'
  );
}
