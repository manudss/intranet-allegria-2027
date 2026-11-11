// Unit tests for scripts/render-prod-deploy.mjs and scripts/render-static-deploy.mjs
// with a mocked global fetch (no network, no secrets).
// Run: node --test scripts/render-prod-deploy.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

let importCounter = 0;
const BASE_ENV = { RENDER_API_KEY: 'test-key', PROD_POLL_MS: '1', PROD_WAIT_MAX_MS: '5000' };

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method ?? 'GET', body: opts.body ? JSON.parse(opts.body) : undefined });
    const r = await handler(u, opts);
    return r ?? { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
  };
  return calls;
}
const json200 = (obj) => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) });
const withServices = (map) => (u) => {
  const m = u.match(/\/services\?name=([^&]+)/);
  if (m) {
    const svc = map[decodeURIComponent(m[1])] ?? null;
    return json200(svc ? [{ service: svc }] : []);
  }
  return null;
};
const deploys = (calls, method = 'POST') => calls.filter((c) => c.method === method && /\/deploys/.test(c.url));

async function loadProd(env = {}) {
  for (const k of Object.keys(process.env)) if (k.startsWith('RENDER_') || k.startsWith('PROD_') || k === 'DRY_RUN') delete process.env[k];
  Object.assign(process.env, BASE_ENV, env);
  return import(`./render-prod-deploy.mjs?case=${importCounter++}`);
}
async function loadStatic(env = {}) {
  for (const k of Object.keys(process.env)) if (k.startsWith('RENDER_') || k.startsWith('PROD_') || k.startsWith('STATIC_') || k === 'DRY_RUN') delete process.env[k];
  Object.assign(process.env, BASE_ENV, env);
  return import(`./render-static-deploy.mjs?case=${importCounter++}`);
}

const imageSvc = { id: 'srv-api', name: 'intranet-allegria-2027', serviceDetails: { runtime: 'image' } };
const gitSvc = { id: 'srv-api', name: 'intranet-allegria-2027', serviceDetails: { runtime: 'node' } };
const distSvc = (name) => ({ id: `srv-${name}`, name, branch: 'deploy', serviceDetails: { buildCommand: '', publishPath: 'web' } });

// --- render-prod-deploy.mjs ---

test('prod deploy: skips a git-backed service and never triggers a deploy', async () => {
  const calls = mockFetch(async (u) => withServices({ 'intranet-allegria-2027': gitSvc })(u) ?? json200([]));
  const m = await loadProd();
  const r = await m.run();
  assert.deepEqual(r, { deployed: false, reason: 'git-backed' });
  assert.equal(deploys(calls).length, 0, 'no deploy POST against a git-backed service');
});

test('prod deploy: deploys an image-backed service and waits for live', async () => {
  let polls = 0;
  const calls = mockFetch(async (u, opts) => {
    const r = withServices({ 'intranet-allegria-2027': imageSvc })(u);
    if (r) return r;
    if (opts.method === 'POST' && /\/deploys/.test(u)) return json200({ deploy: { id: 'dep-1', status: 'created' } });
    if (/\/deploys\?limit=1/.test(u)) { polls++; return json200([{ deploy: { id: 'dep-1', status: polls >= 2 ? 'live' : 'build_in_progress' } }]); }
    return json200({});
  });
  const m = await loadProd();
  const r = await m.run();
  assert.deepEqual(r, { deployed: true, reason: 'live' });
  assert.equal(deploys(calls).length, 1);
  assert.equal(deploys(calls)[0].body.clearCache, 'do_not_clear');
});

test('prod deploy: fails the run on a failed deploy', async () => {
  const calls = mockFetch(async (u, opts) => {
    const r = withServices({ 'intranet-allegria-2027': imageSvc })(u);
    if (r) return r;
    if (opts.method === 'POST' && /\/deploys/.test(u)) return json200({ deploy: { id: 'dep-2', status: 'created' } });
    if (/\/deploys\?limit=1/.test(u)) return json200([{ deploy: { id: 'dep-2', status: 'update_failed' } }]);
    return json200({});
  });
  const m = await loadProd();
  await assert.rejects(m.run(), /update_failed/);
});

test('prod deploy: fails when the service does not exist', async () => {
  mockFetch(async (u) => withServices({})(u) ?? json200([]));
  const m = await loadProd();
  await assert.rejects(m.run(), /introuvable/);
});

test('prod deploy: isImageBacked detects runtime and imagePath', async () => {
  const m = await loadProd();
  assert.equal(m.isImageBacked(imageSvc), true);
  assert.equal(m.isImageBacked(gitSvc), false);
  assert.equal(m.isImageBacked({ image: { imagePath: 'ghcr.io/x/y:latest' } }), true);
});

// --- render-static-deploy.mjs ---

test('static deploy: skips a service not yet switched (branch main or real build)', async () => {
  const old = { id: 'srv-front', name: 'intranet-allegria-2027-1', branch: 'main', serviceDetails: { buildCommand: 'npm run build:web', publishPath: 'dist/apps/web/browser' } };
  const calls = mockFetch(async (u) => withServices({ 'intranet-allegria-2027-1': old, 'allegria-2027': distSvc('allegria-2027'), 'allegria-mobile': null })(u) ?? json200([{ deploy: { id: 'd', status: 'live' } }]));
  const m = await loadStatic({ STATIC_SERVICES: 'intranet-allegria-2027-1,allegria-2027,allegria-mobile' });
  const results = await m.run();
  assert.deepEqual(results[0], { name: 'intranet-allegria-2027-1', deployed: false, reason: 'not-switched' });
  assert.deepEqual(results[1], { name: 'allegria-2027', deployed: true, reason: 'live' });
  assert.deepEqual(results[2], { name: 'allegria-mobile', deployed: false, reason: 'missing' });
  assert.equal(deploys(calls).length, 1, 'only the switched service is deployed');
});

test('static deploy: a whitespace-only build command counts as empty', async () => {
  const m = await loadStatic();
  assert.equal(m.isDistBacked({ branch: 'deploy', serviceDetails: { buildCommand: '   ' } }), true);
  assert.equal(m.isDistBacked({ branch: 'main', serviceDetails: { buildCommand: '' } }), false);
  assert.equal(m.isDistBacked({ branch: 'deploy', serviceDetails: { buildCommand: 'true' } }), false);
});

test('static deploy: fails the run on a failed deploy', async () => {
  mockFetch(async (u, opts) => {
    const r = withServices({ 'allegria-2027': distSvc('allegria-2027') })(u);
    if (r) return r;
    if (opts.method === 'POST' && /\/deploys/.test(u)) return json200({ deploy: { id: 'dep-9', status: 'created' } });
    if (/\/deploys\?limit=1/.test(u)) return json200([{ deploy: { id: 'dep-9', status: 'build_failed' } }]);
    return json200({});
  });
  const m = await loadStatic({ STATIC_SERVICES: 'allegria-2027' });
  await assert.rejects(m.run(), /build_failed/);
});
