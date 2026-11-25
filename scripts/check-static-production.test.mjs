import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRONTENDS, deploymentManifest, checkFrontend, waitForFrontends } from './check-static-production.mjs';

const SHA = 'a'.repeat(40);
const HTML = '<app-root></app-root><script src="appearance-init.js"></script><script src="main-ABC.js"></script><link href="styles-ABC.css">';
function fixture({ stale = false, api = 'https://alegria.dss.name', shell = true, assetStatus = 200 } = {}) {
  return async (url, options) => {
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    const app = FRONTENDS.find((x) => url.startsWith(x.url)).app;
    const path = new URL(url).pathname;
    if (path === '/deployment.json') return Response.json(deploymentManifest(app, stale ? 'b'.repeat(40) : SHA, HTML));
    if (path === '/app-config.json') return Response.json({ apiBaseUrl: api });
    if (path === '/') return new Response(shell ? HTML : '<h1>not found</h1>');
    return new Response('asset', { status: assetStatus });
  };
}

test('manifest records the exact app and full source revision', () => {
  assert.deepEqual(deploymentManifest('mobile', SHA), { app: 'mobile', sourceSha: SHA });
  assert.throws(() => deploymentManifest('api', SHA));
  assert.throws(() => deploymentManifest('site', 'short'));
});
test('verifies release marker, shell, hashed assets and API origin', async () => {
  for (const frontend of FRONTENDS) await checkFrontend(frontend, SHA, fixture());
});
test('rejects stale deployment, HTML fallback, missing asset, or wrong API', async () => {
  for (const options of [{ stale: true }, { shell: false }, { assetStatus: 404 }, { api: 'https://wrong.invalid' }]) {
    await assert.rejects(checkFrontend(FRONTENDS[0], SHA, fixture(options)));
  }
});
test('retries until each CDN is current, without redeploying any service', async () => {
  let time = 0;
  let slept = 0;
  const fetchFn = async (...args) => fixture({ stale: slept === 0 })(...args);
  await waitForFrontends(SHA, { fetchFn, now: () => time, sleep: async (ms) => { time += ms; slept++; }, timeoutMs: 100, intervalMs: 10, log: () => {} });
  assert.equal(slept, 1);
});
test('fails closed on timeout or transport failure', async () => {
  let time = 0;
  await assert.rejects(waitForFrontends(SHA, {
    fetchFn: async () => { throw new Error('offline'); }, now: () => time,
    sleep: async (ms) => { time += ms; }, timeoutMs: 10, intervalMs: 10, log: () => {},
  }), /Deployment unverified: site, web, mobile/);
});
test('production workflow keeps first-account API key out of static job and checks current targets', () => {
  const workflow = readFileSync(new URL('../.github/workflows/prod-deploy.yml', import.meta.url), 'utf8');
  const staticJob = workflow.split('  deploy-static:')[1].split('  health:')[0];
  assert.doesNotMatch(staticJob, /RENDER_API_KEY|render-static-deploy/);
  assert.match(staticJob, /check-static-production.mjs/);
  assert.match(staticJob, /github.event.workflow_run.head_sha \|\| github.sha/);
  for (const { url } of FRONTENDS) assert.ok(workflow.includes(url));
  assert.match(workflow, /https:\/\/alegria.dss.name\/familles\/espace-famille/);
});
