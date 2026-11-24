import test from 'node:test';
import assert from 'node:assert/strict';
import { assertInputs, deploy, nameFor } from './render-pr-lyam.mjs';
import { cleanup } from './render-pr-lyam-cleanup.mjs';

const OWNER = 'tea-dbppb5d9fdbs73f1fqf0';
const IMAGE = `ghcr.io/manudss/intranet-allegria-2027@sha256:${'a'.repeat(64)}`;
const env = (o = {}) => ({
  GITHUB_REPOSITORY: 'manudss/intranet-allegria-2027',
  PR_NUMBER: '49',
  PREVIEW_HEAD_REPO: 'manudss/intranet-allegria-2027',
  PREVIEW_IMAGE: IMAGE,
  RENDER_LYAM_PREVIEW_API_KEY: 'k',
  PREVIEW_DB_URL: 'postgres://x',
  PREVIEW_DB_URL_DIRECT: 'postgres://y',
  ...o,
});

test('refuses forks, PR42, bad numbers, mutable images and missing credentials', () => {
  assert.throws(() => assertInputs(env({ PREVIEW_HEAD_REPO: 'evil/fork' })), /fork/);
  assert.throws(() => assertInputs(env({ PR_NUMBER: '42' })), /PR number/);
  assert.throws(() => assertInputs(env({ PR_NUMBER: '../1' })), /PR number/);
  assert.throws(() => assertInputs(env({ PREVIEW_IMAGE: 'ghcr.io/manudss/intranet-allegria-2027:latest' })), /digest/);
  assert.throws(() => assertInputs(env({ RENDER_LYAM_PREVIEW_API_KEY: '' })), /credentials/);
  assert.equal(nameFor('49'), 'al-pr49-api');
});

const fakeRender = (services, calls) => async (url, init) => {
  const path = url.replace('https://api.render.com/v1', '');
  calls.push(`${init.method} ${path}`);
  const json = (b, status = 200) => ({ ok: true, status, json: async () => b });
  if (path === '/owners') return json([{ owner: { id: OWNER } }]);
  if (path.startsWith('/services?')) return json(services.map((service) => ({ service })));
  if (init.method === 'POST' && path === '/services')
    return json({ service: { id: 'srv-new', serviceDetails: { url: 'https://al-pr49-api.onrender.com' } } });
  return json({});
};
const demo = { name: 'iam-demo-apps', ownerId: OWNER, repo: 'https://github.com/manudss/iam-demo-apps' };

test('creates a free image service in the second account, never a source build', async () => {
  const calls = [];
  const s = await deploy(env(), fakeRender([demo], calls));
  assert.equal(s.id, 'srv-new');
  assert.ok(calls.includes('POST /services'));
  assert.ok(calls.every((c) => !c.includes('/deploys') || false));
});

test('cleanup deletes only the verified free image service', async () => {
  const calls = [];
  const ok = { id: 'srv-1', name: 'al-pr49-api', ownerId: OWNER, serviceDetails: { runtime: 'image', plan: 'free' } };
  assert.deepEqual(await cleanup(env(), fakeRender([ok], calls)), { deleted: true });
  assert.ok(calls.includes('DELETE /services/srv-1'));
  const paid = { ...ok, serviceDetails: { runtime: 'image', plan: 'starter' } };
  await assert.rejects(cleanup(env(), fakeRender([paid], [])), /mismatch/);
  await assert.rejects(cleanup(env({ PR_NUMBER: '42' }), fakeRender([ok], [])), /refused/);
});

test('opens the PR49 demo mode with fictional-only flags and an owner-only mail lock, key kept', async () => {
  const bodies = [];
  const render = async (url, init) => {
    if (init.body) bodies.push({ url, init });
    return fakeRender([demo], [])(url, init);
  };
  await deploy(env(), render);
  const create = JSON.parse(bodies.find((b) => b.url.endsWith('/services') && b.init.method === 'POST').init.body);
  const get = (k) => create.envVars.find((v) => v.key === k)?.value;
  assert.equal(get('FAMILY_PREVIEW_DEMO_ENABLED'), 'pr49-fictional-only');
  assert.equal(get('FAMILY_PREVIEW_HEALTH_ENABLED'), 'fictional-health-only');
  assert.equal(get('FAMILY_PREVIEW_MAIL_TO'), 'emmanueldesaintsteban@gmail.com');
  assert.equal(get('FAMILY_HEALTH_ENCRYPTION_KEY').length, 44);
  assert.equal(get('FAMILY_HEALTH_APPROVAL_REFERENCE'), undefined);
});
