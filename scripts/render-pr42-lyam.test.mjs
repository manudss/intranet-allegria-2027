import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertInputs, deploy, OWNER, NAME } from './render-pr42-lyam.mjs';
const env = {
  GITHUB_REPOSITORY: 'manudss/intranet-allegria-2027',
  PREVIEW_HEAD_REF: 'feat/family-registration',
  PREVIEW_IMAGE: 'ghcr.io/manudss/intranet-allegria-2027@sha256:' + 'a'.repeat(64),
  RENDER_LYAM_PREVIEW_API_KEY: 'fiction',
  PREVIEW_DB_URL: 'postgres://fiction',
  PREVIEW_DB_URL_DIRECT: 'postgres://fiction-direct',
};
test('rejects main, another repository, floating tag and missing dedicated key', () => {
  for (const patch of [
    { PREVIEW_HEAD_REF: 'main' },
    { GITHUB_REPOSITORY: 'other/repo' },
    { PREVIEW_IMAGE: 'ghcr.io/manudss/intranet-allegria-2027:latest' },
    { RENDER_LYAM_PREVIEW_API_KEY: '' },
  ])
    assert.throws(() => assertInputs({ ...env, ...patch }));
});
test('creates only an isolated free immutable image service and never mutates Lyam', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ url, options, body });
    let data;
    if (url.endsWith('/owners')) data = [{ owner: { id: OWNER } }];
    else if (url.endsWith('/services?limit=100'))
      data = [
        {
          service: {
            id: 'lyam-demo',
            name: 'iam-demo-apps',
            ownerId: OWNER,
            repo: 'https://github.com/manudss/iam-demo-apps',
          },
        },
      ];
    else
      data = {
        service: {
          id: 'preview-only',
          name: NAME,
          serviceDetails: { url: 'https://fiction.invalid' },
        },
      };
    return { ok: true, status: 200, json: async () => data };
  };
  await deploy(env, fetcher);
  const writes = calls.filter((x) => x.options.method !== 'GET');
  assert.equal(writes.length, 1);
  const body = writes[0].body;
  assert.equal(body.ownerId, OWNER);
  assert.equal(body.serviceDetails.plan, 'free');
  assert.equal(body.serviceDetails.runtime, 'image');
  assert.equal(body.autoDeployTrigger, 'off');
  assert.equal(body.image.imagePath, env.PREVIEW_IMAGE);
  assert.equal(body.repo, undefined);
  assert.equal(
    body.envVars.some((x) => x.key === 'FAMILY_HEALTH_ENCRYPTION_KEY'),
    false,
  );
  assert.equal(
    body.envVars.some((x) => x.key === 'FAMILY_MAIL_PROVIDER'),
    false,
  );
  assert.equal(
    calls.some((x) => x.url.includes('lyam-demo/')),
    false,
  );
});
test('wrong account makes no mutation', async () => {
  let calls = 0;
  await assert.rejects(
    deploy(env, async () => {
      calls++;
      return { ok: true, status: 200, json: async () => [{ owner: { id: 'wrong' } }] };
    }),
    /wrong Render account/,
  );
  assert.equal(calls, 1);
});
