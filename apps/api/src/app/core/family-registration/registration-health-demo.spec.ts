import { describe, it, expect } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { RegistrationHealthService, seal } from './registration-health.service';
import { familyPreviewHealthEnabled } from './family-preview';
import { EMPTY_HEALTH } from '@mej-allegria/shared';
const env = {
  FAMILY_PREVIEW_DEMO_ENABLED: 'pr42-fictional-only',
  RENDER_SERVICE_NAME: 'al-pr42-api-hz8q',
  RENDER_SERVICE_ID: 'srv-dc06l5mc6qcc73b9ar00',
  RENDER_EXTERNAL_HOSTNAME: 'al-pr42-api-hz8q.onrender.com',
  FAMILY_PREVIEW_IMAGE_ENABLED: 'pr42-prebuilt-only',
  FAMILY_PREVIEW_HEALTH_ENABLED: 'fictional-health-only',
  FAMILY_HEALTH_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
};
describe('isolated fictional health demo', () => {
  it('opens only the opted-in exact preview and never production or another service', () => {
    for (const patch of [
      {},
      { RENDER_SERVICE_ID: 'wrong' },
      { FAMILY_PREVIEW_HEALTH_ENABLED: '' },
      { RENDER_GIT_BRANCH: 'main' },
      { FAMILY_HEALTH_ENCRYPTION_KEY: '' },
    ]) {
      const c = new ConfigService({ ...env, ...patch });
      const h = new RegistrationHealthService({} as never, c, {} as never);
      expect(!!h.enabled()).toBe(Object.keys(patch).length === 0);
    }
    expect(
      familyPreviewHealthEnabled(
        new ConfigService({ FAMILY_PREVIEW_HEALTH_ENABLED: 'fictional-health-only' }),
      ),
    ).toBe(false);
  });
  it('offers an explicitly fictional declaration, not an approval claim', () => {
    const h = new RegistrationHealthService({} as never, new ConfigService(env), {} as never);
    expect(h.declaration()).toMatchObject({ version: 'demo-fiction-1' });
    expect(h.declaration().text).toContain('fictives');
  });
  it('staff gets only submitted fictional samples, not drafts or other families', async () => {
    const sample = {
      ...structuredClone(EMPTY_HEALTH),
      signature: {
        name: 'Parent FICTIF',
        capacity: 'LEGAL',
        at: '2026-11-20T12:00:00Z',
        digest: 'FICTION',
      },
    };
    const family = {
      id: 'f',
      email: 'famille-demo@example.test',
      contact: {},
      youths: [
        { id: 'sent', state: 'SUBMITTED', identity: { firstName: 'Test', lastName: 'FICTIF' } },
        { id: 'draft', state: 'DRAFT', identity: { firstName: 'Draft', lastName: 'FICTIF' } },
      ],
    };
    const families = {
      list: async () => [family, { ...family, id: 'other', email: 'other@example.test' }],
      get: async () => family,
      rules: async () => ({ previewHealthSamples: { sent: sample, draft: sample } }),
    };
    const h = new RegistrationHealthService(
      { query: async () => [] } as never,
      new ConfigService(env),
      families as never,
    );
    expect(await h.staffList()).toMatchObject([{ familyId: 'f', youthId: 'sent', attested: true }]);
  });
});

it('signs the saved fictional health record with the exact demo declaration, rejects other versions', async () => {
  const key = Buffer.alloc(32, 1),
    youth = { id: 'y', identity: { firstName: 'FICTIF', dateOfBirth: '2012-05-01' } };
  const family = {
    email: 'famille-demo@example.test',
    contact: { name: 'Parent FICTIF' },
    youths: [youth],
  };
  const query = async (sql: string) =>
    sql.includes('SELECT dossier')
      ? [{ dossier: family }]
      : sql.includes('SELECT envelope')
        ? [
            {
              revision: 1,
              envelope: seal({ ...structuredClone(EMPTY_HEALTH), revision: 1 }, key, 'f:y'),
            },
          ]
        : [];
  const db = { transaction: async (fn: (m: unknown) => unknown) => fn({ query }) };
  const families = { youth: () => youth, editable: () => undefined };
  const h = new RegistrationHealthService(db as never, new ConfigService(env), families as never);
  const signed = await h.sign('f', 'y', 1, {
    version: 'demo-fiction-1',
    accepted: true,
    name: 'Parent FICTIF',
    capacity: 'LEGAL',
  });
  expect(signed.signature?.name).toBe('Parent FICTIF');
  expect(JSON.parse(signed.signedPayload!).declarationVersion).toBe('demo-fiction-1');
  expect(JSON.parse(signed.signedPayload!).declaration).toContain('fictives');
  await expect(
    h.sign('f', 'y', 1, {
      version: 'wrong',
      accepted: true,
      name: 'Parent FICTIF',
      capacity: 'LEGAL',
    }),
  ).rejects.toThrow('Relisez');
});
