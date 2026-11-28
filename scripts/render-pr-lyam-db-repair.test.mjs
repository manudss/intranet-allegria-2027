import test from 'node:test';
import assert from 'node:assert/strict';
import { assertRepairInputs, repair } from './render-pr-lyam-db-repair.mjs';

const OWNER = 'tea-dbppb5d9fdbs73f1fqf0';
const env = (o = {}) => ({
  GITHUB_REPOSITORY: 'manudss/intranet-allegria-2027',
  PR_NUMBER: '58',
  PREVIEW_HEAD_REPO: 'manudss/intranet-allegria-2027',
  RENDER_LYAM_PREVIEW_API_KEY: 'k',
  PREVIEW_DB_URL: 'postgres://pooled',
  PREVIEW_DB_URL_DIRECT: 'postgres://direct',
  ...o,
});
const svc = { id: 'srv-1', name: 'al-pr58-api', ownerId: OWNER, serviceDetails: { runtime: 'image', plan: 'free', url: 'https://al-pr58-api.onrender.com' } };
const fake = (services, calls) => async (url, init) => {
  const path = url.replace('https://api.render.com/v1', '');
  calls.push({ m: init.method, path, body: init.body });
  const json = (b) => ({ ok: true, status: 200, json: async () => b });
  if (path === '/owners') return json([{ owner: { id: OWNER } }]);
  if (path.startsWith('/services?')) return json(services.map((service) => ({ service })));
  return json({});
};

test('refuses forks, PR42, bad numbers, other repositories and missing credentials', () => {
  assert.throws(() => assertRepairInputs(env({ PREVIEW_HEAD_REPO: 'evil/fork' })), /fork/);
  assert.throws(() => assertRepairInputs(env({ PR_NUMBER: '42' })), /PR number/);
  assert.throws(() => assertRepairInputs(env({ PR_NUMBER: '../1' })), /PR number/);
  assert.throws(() => assertRepairInputs(env({ GITHUB_REPOSITORY: 'a/b' })), /repository/);
  assert.throws(() => assertRepairInputs(env({ PREVIEW_DB_URL: '' })), /credentials/);
});

test('rewrites only the two database variables and redeploys the same image', async () => {
  const calls = [];
  await repair(env(), fake([svc], calls));
  const writes = calls.filter((c) => c.m !== 'GET');
  assert.deepEqual(
    writes.map((c) => `${c.m} ${c.path}`),
    ['PUT /services/srv-1/env-vars/DATABASE_URL', 'PUT /services/srv-1/env-vars/DATABASE_URL_DIRECT', 'POST /services/srv-1/deploys'],
  );
  assert.ok(!String(writes[2].body).includes('imageUrl'));
  assert.ok(calls.every((c) => c.path !== '/services' || c.m === 'GET'));
});

test('does nothing when the service is missing, paid, not an image, or in another account', async () => {
  await assert.rejects(repair(env(), fake([], [])), /not found/);
  const paid = { ...svc, serviceDetails: { runtime: 'image', plan: 'starter' } };
  await assert.rejects(repair(env(), fake([paid], [])), /not the dedicated/);
  const other = { ...svc, ownerId: 'tea-other' };
  await assert.rejects(repair(env(), fake([other], [])), /not found/);
  const calls = [];
  await repair(env(), fake([svc], calls)).catch(() => {});
  const bad = [];
  await repair(env(), fake([paid], bad)).catch(() => {});
  assert.ok(bad.every((c) => c.m === 'GET'));
});
