import { describe, it, expect } from 'vitest';
import { familyPreviewEnabled } from './family-preview';
const valid = {
  FAMILY_PREVIEW_DEMO_ENABLED: 'pr42-fictional-only',
  RENDER_SERVICE_NAME: 'al-pr42-api',
  RENDER_GIT_BRANCH: 'feat/family-registration',
  RENDER_EXTERNAL_HOSTNAME: 'al-pr42-api.onrender.com',
};
const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as never;
describe('Temporary PR42 demo gates', () => {
  it('requires the exact opt-in and isolated service, branch and hostname', () => {
    expect(familyPreviewEnabled(config(valid))).toBe(true);
    expect(familyPreviewEnabled(config({}))).toBe(false);
  });
  for (const key of Object.keys(valid))
    it('refuses missing/wrong ' + key, () => {
      const missing = { ...valid };
      delete missing[key as keyof typeof missing];
      expect(familyPreviewEnabled(config(missing))).toBe(false);
      expect(familyPreviewEnabled(config({ ...valid, [key]: 'production' }))).toBe(false);
    });
  it('rejects production and look-alike origins even with the demo flag', () => {
    for (const host of [
      'alegria.dss.name',
      'al-pr42-api.onrender.com.attacker.test',
      'other.onrender.com',
    ])
      expect(familyPreviewEnabled(config({ ...valid, RENDER_EXTERNAL_HOSTNAME: host }))).toBe(
        false,
      );
    expect(familyPreviewEnabled(config({ ...valid, RENDER_GIT_BRANCH: 'main' }))).toBe(false);
  });
});
