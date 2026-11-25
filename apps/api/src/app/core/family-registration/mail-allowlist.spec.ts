import { describe, expect, it } from 'vitest';
import { mailRecipientAllowed } from './family-mail';

const cfg = (value?: string, env: Record<string, string> = {}) =>
  ({ get: (k: string) => (k === 'MAIL_ALLOWED_RECIPIENTS' ? value : env[k]) }) as never;

describe('preview mail allowlist', () => {
  it('allows everyone when unset (production)', () => {
    expect(mailRecipientAllowed(cfg(undefined), 'a@b.fr')).toBe(true);
    expect(mailRecipientAllowed(cfg(''), 'a@b.fr')).toBe(true);
  });
  it('fails closed to the listed addresses only, case-insensitive', () => {
    const c = cfg('Owner@Example.com, second@example.com');
    expect(mailRecipientAllowed(c, 'owner@example.com')).toBe(true);
    expect(mailRecipientAllowed(c, ' SECOND@example.com ')).toBe(true);
    expect(mailRecipientAllowed(c, 'other@example.com')).toBe(false);
  });
  it('a variable holding only separators refuses everyone', () => {
    expect(mailRecipientAllowed(cfg(' , '), 'a@b.fr')).toBe(false);
  });

  it('refuses everyone in a preview when the allowlist is absent or empty (provider enabled)', () => {
    for (const env of [{ RENDER_SERVICE_NAME: 'al-pr49-api' }, { RENDER_SERVICE_NAME: 'al-pr7-api-qkcc' }, { PREVIEW_DEPLOYMENT: 'true' }]) {
      expect(mailRecipientAllowed(cfg(undefined, env), 'owner@example.com')).toBe(false);
      expect(mailRecipientAllowed(cfg('', env), 'owner@example.com')).toBe(false);
      expect(mailRecipientAllowed(cfg('owner@example.com', env), 'owner@example.com')).toBe(true);
    }
  });
  it('leaves production unchanged (other service names, no allowlist)', () => {
    expect(mailRecipientAllowed(cfg(undefined, { RENDER_SERVICE_NAME: 'alegria-api' }), 'a@b.fr')).toBe(true);
    expect(mailRecipientAllowed(cfg(undefined, { RENDER_SERVICE_NAME: 'al-pr49-web' }), 'a@b.fr')).toBe(true);
  });
});
