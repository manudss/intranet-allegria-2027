import { describe, expect, it } from 'vitest';
import { mailRecipientAllowed } from './family-mail';

const cfg = (value?: string) => ({ get: (k: string) => (k === 'MAIL_ALLOWED_RECIPIENTS' ? value : undefined) }) as never;

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
});
