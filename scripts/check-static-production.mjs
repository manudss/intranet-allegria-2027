#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const FRONTENDS = [
  { app: 'site', url: 'https://alegria-live-site.onrender.com' },
  { app: 'web', url: 'https://alegria-live-web.onrender.com' },
  { app: 'mobile', url: 'https://alegria-live-mobile.onrender.com' },
];

export function deploymentManifest(app, sourceSha, indexHtml) {
  if (!['site', 'web', 'mobile'].includes(app) || !/^[a-f0-9]{40}$/.test(sourceSha)) {
    throw new Error('Invalid deployment app or source SHA');
  }
  return { app, sourceSha, ...(indexHtml === undefined ? {} : { indexSha256: createHash('sha256').update(indexHtml).digest('hex') }) };
}

// Read-only CDN checks. Render follows deploy automatically on the second account;
// no Render key, manual deploy, database, or user session is needed here.
export async function checkFrontend(frontend, sourceSha, fetchFn = fetch) {
  const expected = deploymentManifest(frontend.app, sourceSha);
  const get = async (path) => {
    const response = await fetchFn(`${frontend.url}${path}`, {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response;
  };
  const marker = await (await get(`/deployment.json?source=${sourceSha}`)).json();
  if (marker.app !== expected.app || marker.sourceSha !== expected.sourceSha) {
    throw new Error('CDN still serves another source revision');
  }
  const html = await (await get('/')).text();
  if (!/^[a-f0-9]{64}$/.test(marker.indexSha256 ?? '') ||
      createHash('sha256').update(html).digest('hex') !== marker.indexSha256) {
    throw new Error('CDN index does not match the published revision');
  }
  if (!html.includes('appearance-init.js') || !html.includes('<app-root')) {
    throw new Error('Frontend shell missing');
  }
  const assets = [...html.matchAll(/(?:src|href)="((?:main|styles)-[^"/]+\.(?:js|css))"/g)].map((m) => m[1]);
  if (!assets.some((asset) => asset.startsWith('main-'))) throw new Error('Main bundle missing');
  for (const asset of ['appearance-init.js', ...assets]) await get(`/${asset}`);
  const config = await (await get('/app-config.json')).json();
  if (config.apiBaseUrl !== 'https://alegria.dss.name') throw new Error('Unexpected API destination');
}

export async function waitForFrontends(sourceSha, {
  fetchFn = fetch, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  timeoutMs = 600000, intervalMs = 15000, log = console.log,
} = {}) {
  deploymentManifest('site', sourceSha);
  const deadline = now() + timeoutMs;
  let pending = [...FRONTENDS];
  while (pending.length) {
    const failures = await Promise.all(pending.map(async (frontend) => {
      try {
        await checkFrontend(frontend, sourceSha, fetchFn);
        log(`${frontend.app}: live ${sourceSha} ${frontend.url}`);
        return null;
      } catch (error) {
        log(`${frontend.app}: waiting: ${error.message}`);
        return frontend;
      }
    }));
    pending = failures.filter(Boolean);
    if (!pending.length) return;
    if (now() >= deadline) throw new Error(`Deployment unverified: ${pending.map((x) => x.app).join(', ')}`);
    await sleep(intervalMs);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await waitForFrontends(process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? '');
}
