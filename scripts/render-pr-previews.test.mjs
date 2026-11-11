// Unit tests for scripts/render-pr-previews.mjs with a mocked global fetch (no network,
// no secrets). Run: node --test scripts/render-pr-previews.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let importCounter = 0;
const SHA = 'b'.repeat(40);
const BASE_ENV = {
  RENDER_API_KEY: 'test-key',
  RENDER_OWNER_ID: 'tea-test',
  RENDER_ENVIRONMENT_ID: 'evm-test',
  GITHUB_TOKEN: 'ghp-test',
  GITHUB_REPOSITORY: 'manudss/intranet-allegria-2027',
  PR_NUMBER: '3',
  NEON_DB_URL: 'postgres://pooled',
  NEON_DB_URL_DIRECT: 'postgres://direct',
  NEON_BRANCH_NAME: 'preview/pr-3',
};

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
const openPr = (over = {}) => json200({
  state: 'open',
  head: { ref: 'feature/x', sha: SHA, repo: { full_name: 'manudss/intranet-allegria-2027' } },
  ...over,
});

async function load(env = {}) {
  for (const k of Object.keys(process.env)) if (k.startsWith('RENDER_') || k.startsWith('PR_') || k.startsWith('NEON_') || k === 'GITHUB_TOKEN' || k === 'GITHUB_REPOSITORY' || k === 'DRY_RUN' || k === 'GH_DRY') delete process.env[k];
  Object.assign(process.env, BASE_ENV, env);
  process.argv[2] = env.MODE ?? 'ensure';
  return import(`./render-pr-previews.mjs?case=${importCounter++}`);
}

const renderCalls = (calls, method, re) => calls.filter((c) => c.method === method && re.test(c.url));
const ghCalls = (calls, method, re) => calls.filter((c) => c.method === method && c.url.includes('api.github.com') && re.test(c.url));
// findService does GET /services?name=<name>; serve the given map {name: service|null}.
const withServices = (map) => (u) => {
  const m = u.match(/\/services\?name=([^&]+)/);
  if (m) {
    const svc = map[decodeURIComponent(m[1])] ?? null;
    return json200(svc ? [{ service: svc }] : []);
  }
  return null;
};
const svc = (name) => ({ id: `srv-${name}`, name, serviceDetails: { url: `https://${name}.onrender.com` } });

test('rejects an invalid PR_NUMBER', async () => {
  await assert.rejects(load({ PR_NUMBER: 'abc' }), /PR_NUMBER invalid/);
});

// --- ensure: a push never builds ---

test('ensure with no services writes nothing to Render and comments the how-to', async () => {
  const calls = mockFetch(async (u) => {
    if (u.includes('api.github.com') && u.includes('/comments')) return json200([]);
    return withServices({})(u) ?? json200([]);
  });
  const m = await load();
  await m.ensure();
  assert.equal(renderCalls(calls, 'POST', /\/v1\/services$/).length, 0, 'no service creation');
  assert.equal(renderCalls(calls, 'POST', /\/deploys/).length, 0, 'no deploy');
  assert.equal(renderCalls(calls, 'PUT', /.*/).length, 0, 'no env rotation on a push');
  const comments = ghCalls(calls, 'POST', /\/issues\/3\/comments/);
  assert.equal(comments.length, 1);
  assert.match(comments[0].body.body, /render-previews/);
  assert.match(comments[0].body.body, /\/preview/, 'comment tells how to deploy on demand');
  assert.match(comments[0].body.body, /preview\/pr-3/, 'comment names the Neon branch');
});

test('ensure with existing services keeps the links, adds the how-to, and never deploys', async () => {
  const map = { 'al-pr3-api': svc('al-pr3-api'), 'al-pr3-web': svc('al-pr3-web'), 'al-pr3-site': svc('al-pr3-site') };
  const calls = mockFetch(async (u) => {
    if (u.includes('api.github.com') && u.includes('/comments')) return json200([]);
    return withServices(map)(u) ?? json200({});
  });
  const m = await load();
  await m.ensure();
  assert.equal(renderCalls(calls, 'POST', /\/deploys/).length, 0, 'a push must not start a build');
  assert.equal(renderCalls(calls, 'PUT', /env-vars/).length, 0, 'no env rewrite from ensure');
  const comments = ghCalls(calls, 'POST', /\/issues\/3\/comments/);
  assert.match(comments[0].body.body, /https:\/\/al-pr3-site\.onrender\.com/);
  assert.match(comments[0].body.body, /\/preview/);
});

// --- refresh: explicit on-demand deploy ---

test('refresh reads the head from the pulls API and creates the 3 services with autoDeploy off', async () => {
  const calls = mockFetch(async (u) => {
    if (u.includes('/pulls/3')) return openPr();
    if (u.includes('api.github.com') && u.includes('/comments')) return json200([]);
    const fromMap = withServices({})(u);
    if (fromMap) return fromMap;
    if (u.endsWith('/services')) return json200({ service: { id: 'srv-new', serviceDetails: { url: 'https://x.onrender.com' } } });
    return json200({});
  });
  const m = await load({ MODE: 'refresh' });
  await m.refresh();
  assert.equal(ghCalls(calls, 'GET', /\/pulls\/3/).length, 1, 'head read back from the API');
  const creates = renderCalls(calls, 'POST', /\/v1\/services$/);
  assert.equal(creates.length, 3, 'api + web + site created');
  const api = creates.find((c) => c.body.name === 'al-pr3-api').body;
  assert.equal(api.autoDeploy, 'no', 'autoDeploy must stay off');
  assert.equal(api.branch, 'feature/x');
  assert.equal(api.type, 'web_service');
  assert.deepEqual(api.envVars[0], { key: 'DATABASE_URL', value: 'postgres://pooled' });
  assert.equal(creates.filter((c) => c.body.type === 'static_site').length, 2);
  assert.equal(renderCalls(calls, 'POST', /\/deploys/).length, 0, 'no explicit deploy on creation: Render deploys on create');
  const comments = ghCalls(calls, 'POST', /\/issues\/3\/comments/);
  assert.match(comments[0].body.body, /bbbbbbb/, 'comment names the deployed short sha');
});

test('refresh on existing services rotates the api creds (env change redeploys) and deploys web and site explicitly', async () => {
  const map = { 'al-pr3-api': svc('al-pr3-api'), 'al-pr3-web': svc('al-pr3-web'), 'al-pr3-site': svc('al-pr3-site') };
  const calls = mockFetch(async (u) => {
    if (u.includes('/pulls/3')) return openPr();
    if (u.includes('api.github.com') && u.includes('/comments')) return json200([]);
    const fromMap = withServices(map)(u);
    if (fromMap) return fromMap;
    if (u.includes('/env-vars')) return json200([
      { envVar: { key: 'DATABASE_URL', value: 'postgres://old' } },
      { envVar: { key: 'DATABASE_URL_DIRECT', value: 'postgres://old' } },
      { envVar: { key: 'CORS_ORIGIN', value: 'https://al-pr3-web.onrender.com,https://al-pr3-site.onrender.com' } },
      { envVar: { key: 'WEB_API_URL', value: 'https://al-pr3-api.onrender.com' } },
    ]);
    return json200({});
  });
  const m = await load({ MODE: 'refresh' });
  await m.refresh();
  assert.equal(renderCalls(calls, 'POST', /\/v1\/services$/).length, 0, 'no re-creation');
  assert.equal(renderCalls(calls, 'PUT', /srv-al-pr3-api\/env-vars\/DATABASE_URL$/).length, 1, 'creds rotated');
  assert.equal(renderCalls(calls, 'PUT', /env-vars\/CORS_ORIGIN/).length, 0, 'CORS already right');
  assert.equal(renderCalls(calls, 'POST', /srv-al-pr3-api\/deploys/).length, 0, 'env change redeploys the api: no double build');
  assert.equal(renderCalls(calls, 'POST', /srv-al-pr3-web\/deploys/).length, 1, 'web deployed once');
  assert.equal(renderCalls(calls, 'POST', /srv-al-pr3-site\/deploys/).length, 1, 'site deployed once');
});

test('refresh with unchanged env vars deploys every existing service explicitly, once', async () => {
  const map = { 'al-pr3-api': svc('al-pr3-api'), 'al-pr3-web': svc('al-pr3-web'), 'al-pr3-site': svc('al-pr3-site') };
  const calls = mockFetch(async (u) => {
    if (u.includes('/pulls/3')) return openPr();
    if (u.includes('api.github.com') && u.includes('/comments')) return json200([]);
    const fromMap = withServices(map)(u);
    if (fromMap) return fromMap;
    if (u.includes('/env-vars')) return json200([
      { envVar: { key: 'DATABASE_URL', value: 'postgres://pooled' } },
      { envVar: { key: 'DATABASE_URL_DIRECT', value: 'postgres://direct' } },
      { envVar: { key: 'CORS_ORIGIN', value: 'https://al-pr3-web.onrender.com,https://al-pr3-site.onrender.com' } },
      { envVar: { key: 'WEB_API_URL', value: 'https://al-pr3-api.onrender.com' } },
    ]);
    return json200({});
  });
  const m = await load({ MODE: 'refresh' });
  await m.refresh();
  assert.equal(renderCalls(calls, 'PUT', /env-vars/).length, 0, 'no env change needed');
  assert.equal(renderCalls(calls, 'POST', /\/deploys/).length, 3, 'one explicit deploy per service');
});

test('refresh on a branch with apps/mobile also creates the mobile static site and CORS it', async () => {
  const calls = mockFetch(async (u) => {
    if (u.includes('/pulls/3')) return openPr();
    if (u.includes('/contents/apps/mobile')) return json200([{ name: 'project.json', type: 'file' }]);
    if (u.includes('api.github.com') && u.includes('/comments')) return json200([]);
    const fromMap = withServices({})(u);
    if (fromMap) return fromMap;
    if (u.endsWith('/services')) return json200({ service: { id: 'srv-new', serviceDetails: { url: 'https://x.onrender.com' } } });
    return json200({});
  });
  const m = await load({ MODE: 'refresh' });
  await m.refresh();
  const creates = renderCalls(calls, 'POST', /\/v1\/services$/);
  assert.equal(creates.length, 4, 'api + web + site + mobile created');
  assert.equal(creates.filter((c) => c.body.type === 'static_site').length, 3);
  const mobile = creates.find((c) => c.body.name === 'al-pr3-mobile').body;
  assert.match(mobile.serviceDetails.buildCommand, /build:mobile/);
  assert.equal(mobile.serviceDetails.publishPath, 'dist/apps/mobile/browser');
  assert.deepEqual(mobile.serviceDetails.routes, [{ type: 'rewrite', source: '/*', destination: '/index.html' }]);
  assert.ok(mobile.envVars.some((v) => v.key === 'MOBILE_API_URL'), 'mobile gets MOBILE_API_URL');
  const api = creates.find((c) => c.body.name === 'al-pr3-api').body;
  assert.match(api.envVars.find((v) => v.key === 'CORS_ORIGIN').value, /al-pr3-mobile\.onrender\.com/, 'API CORS includes the mobile origin');
  const comments = ghCalls(calls, 'POST', /\/issues\/3\/comments/);
  assert.match(comments[0].body.body, /App mobile \(PWA\)/, 'comment links the mobile preview');
});

test('refresh on a branch without apps/mobile creates no mobile service', async () => {
  const calls = mockFetch(async (u) => {
    if (u.includes('/pulls/3')) return openPr();
    if (u.includes('/contents/apps/mobile')) return { ok: false, status: 404, json: async () => null, text: async () => '' };
    if (u.includes('api.github.com') && u.includes('/comments')) return json200([]);
    const fromMap = withServices({})(u);
    if (fromMap) return fromMap;
    if (u.endsWith('/services')) return json200({ service: { id: 'srv-new', serviceDetails: { url: 'https://x.onrender.com' } } });
    return json200({});
  });
  const m = await load({ MODE: 'refresh' });
  await m.refresh();
  assert.equal(renderCalls(calls, 'POST', /\/v1\/services$/).length, 3, 'no mobile service without apps/mobile');
  const comments = ghCalls(calls, 'POST', /\/issues\/3\/comments/);
  assert.ok(!comments[0].body.body.includes('App mobile'), 'comment has no mobile row');
});

test('refresh with existing mobile service and unchanged env deploys it explicitly, once', async () => {
  const map = { 'al-pr3-api': svc('al-pr3-api'), 'al-pr3-web': svc('al-pr3-web'), 'al-pr3-site': svc('al-pr3-site'), 'al-pr3-mobile': svc('al-pr3-mobile') };
  const calls = mockFetch(async (u) => {
    if (u.includes('/pulls/3')) return openPr();
    if (u.includes('/contents/apps/mobile')) return json200([{ name: 'project.json', type: 'file' }]);
    if (u.includes('api.github.com') && u.includes('/comments')) return json200([]);
    const fromMap = withServices(map)(u);
    if (fromMap) return fromMap;
    if (u.includes('/env-vars')) return json200([
      { envVar: { key: 'DATABASE_URL', value: 'postgres://pooled' } },
      { envVar: { key: 'DATABASE_URL_DIRECT', value: 'postgres://direct' } },
      { envVar: { key: 'CORS_ORIGIN', value: 'https://al-pr3-web.onrender.com,https://al-pr3-site.onrender.com,https://al-pr3-mobile.onrender.com' } },
      { envVar: { key: 'WEB_API_URL', value: 'https://al-pr3-api.onrender.com' } },
      { envVar: { key: 'MOBILE_API_URL', value: 'https://al-pr3-api.onrender.com' } },
    ]);
    return json200({});
  });
  const m = await load({ MODE: 'refresh' });
  await m.refresh();
  assert.equal(renderCalls(calls, 'PUT', /env-vars/).length, 0, 'no env change needed');
  assert.equal(renderCalls(calls, 'POST', /\/deploys/).length, 4, 'one explicit deploy per service, mobile included');
  assert.equal(renderCalls(calls, 'POST', /srv-al-pr3-mobile\/deploys/).length, 1);
});

test('refresh refuses a fork PR', async () => {
  mockFetch(async (u) => {
    if (u.includes('/pulls/3')) return openPr({ head: { ref: 'x', sha: SHA, repo: { full_name: 'someone/else' } } });
    return json200([]);
  });
  const m = await load({ MODE: 'refresh' });
  await assert.rejects(m.refresh(), /fork/);
});

test('refresh refuses a closed PR', async () => {
  mockFetch(async (u) => {
    if (u.includes('/pulls/3')) return openPr({ state: 'closed' });
    return json200([]);
  });
  const m = await load({ MODE: 'refresh' });
  await assert.rejects(m.refresh(), /not open/);
});

// --- cleanup: unchanged ---


test('workflow never pins trusted-code checkouts to pull_request metadata (stale base.sha ran an old script)', () => {
  // pull_request_target reads the workflow from the default branch head, but
  // github.event.pull_request.base.sha in the event payload can lag behind it: an ensure checkout pinned
  // to it ran an OLDER render-pr-previews.mjs (whose ensure guard required PR_HEAD_BRANCH, no longer
  // passed) and failed every synchronize. Trusted code must always come from the default branch head,
  // exactly like the workflow file itself — so no checkout may take a ref from pull_request metadata.
  const wf = readFileSync(new URL('../.github/workflows/pr-previews.yml', import.meta.url), 'utf8');
  assert.ok((wf.match(/uses: actions\/checkout@/g) ?? []).length >= 3, 'expected several checkout steps');
  assert.ok(!/ref:\s*\$\{\{\s*github\.event\.pull_request/.test(wf), 'a checkout must never take its ref from pull_request event metadata');
});

test('cleanup deletes the existing services, mobile included, and comments', async () => {
  const map = { 'al-pr3-api': svc('al-pr3-api'), 'al-pr3-web': svc('al-pr3-web'), 'al-pr3-site': svc('al-pr3-site'), 'al-pr3-mobile': svc('al-pr3-mobile') };
  const calls = mockFetch(async (u) => {
    if (u.includes('api.github.com') && u.includes('/comments')) return json200([]);
    return withServices(map)(u) ?? json200({});
  });
  const m = await load();
  await m.cleanup();
  assert.equal(renderCalls(calls, 'DELETE', /\/services\//).length, 4);
  const comments = ghCalls(calls, 'POST', /\/issues\/3\/comments/);
  assert.match(comments[0].body.body, /supprimes/);
});
