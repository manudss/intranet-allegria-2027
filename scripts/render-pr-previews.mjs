#!/usr/bin/env node
// Orchestrates the 3 per-PR Render services (api, web admin, public site) from a TRUSTED
// GitHub Actions workflow (pull_request_target, base-branch code only, never PR code).
// Untrusted values (branch name) only travel through env vars and are validated here.
// Usage: node scripts/render-pr-previews.mjs ensure|cleanup
// Env: RENDER_API_KEY, RENDER_OWNER_ID, GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, PR_HEAD_BRANCH,
//      NEON_DB_URL, NEON_DB_URL_DIRECT, NEON_BRANCH_NAME (ensure only), DRY_RUN=1 to print the plan only.
const MODE = process.argv[2];
const e = process.env;
const DRY = e.DRY_RUN === '1';
const pr = Number(e.PR_NUMBER);
if (!Number.isInteger(pr) || pr <= 0) throw new Error('PR_NUMBER invalid');
const repoFull = e.GITHUB_REPOSITORY ?? '';
if (!/^[\w.-]+\/[\w.-]+$/.test(repoFull)) throw new Error('GITHUB_REPOSITORY invalid');
const branch = e.PR_HEAD_BRANCH ?? '';
if (MODE === 'ensure' && !/^[\w./-]{1,200}$/.test(branch)) throw new Error('PR_HEAD_BRANCH rejected');

const RENDER = 'https://api.render.com/v1';
const names = { api: `al-pr${pr}-api`, web: `al-pr${pr}-web`, site: `al-pr${pr}-site` };
const MARK = '<!-- render-previews -->';

async function render(method, path, body) {
  if (DRY) { console.log('[dry]', method, path, body ? JSON.stringify(body).replace(/postgres[^"]*/g, '<db>') : ''); return {}; }
  const res = await fetch(RENDER + path, {
    method,
    headers: { Authorization: `Bearer ${e.RENDER_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}
async function findService(name) {
  const list = await render('GET', `/services?name=${encodeURIComponent(name)}&limit=5`);
  const hit = (Array.isArray(list) ? list : []).map((x) => x.service ?? x).find((s) => s.name === name);
  return hit ?? null;
}
async function gh(method, path, body) {
  if (DRY || e.GH_DRY === '1') { console.log('[dry gh]', method, path); return []; }
  const res = await fetch(`https://api.github.com/repos/${repoFull}${path}`, {
    method,
    headers: { Authorization: `Bearer ${e.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GH ${method} ${path} -> ${res.status}`);
  return res.status === 204 ? null : res.json();
}
async function upsertComment(markdown) {
  const comments = await gh('GET', `/issues/${pr}/comments?per_page=100`);
  const mine = (comments ?? []).find((c) => c.body?.includes(MARK));
  const body = `${MARK}\n${markdown}`;
  if (mine) await gh('PATCH', `/issues/comments/${mine.id}`, { body });
  else await gh('POST', `/issues/${pr}/comments`, { body });
}
const urlOf = (s, fallback) => s?.serviceDetails?.url ?? fallback;

async function ensure() {
  const repo = `https://github.com/${repoFull}`;
  if (!e.RENDER_ENVIRONMENT_ID) throw new Error('RENDER_ENVIRONMENT_ID is required (Allegria-demo project, dev environment)');
  const common = { ownerId: e.RENDER_OWNER_ID, environmentId: e.RENDER_ENVIRONMENT_ID, repo, branch, autoDeploy: 'no' }; // deploys are triggered only by this trusted workflow (see end of ensure), not by Render's GitHub webhook
  const guess = (n) => `https://${n}.onrender.com`;
  const webUrl = guess(names.web);
  const siteUrl = guess(names.site);

  let api = await findService(names.api);
  const existing = new Set();
  if (api) existing.add(api.id);
  if (!api) {
    const r = await render('POST', '/services', {
      ...common, type: 'web_service', name: names.api,
      envVars: [
        { key: 'DATABASE_URL', value: e.NEON_DB_URL },
        { key: 'DATABASE_URL_DIRECT', value: e.NEON_DB_URL_DIRECT },
        { key: 'DB_SSL', value: 'true' },
        { key: 'CORS_ORIGIN', value: `${webUrl},${siteUrl}` },
        { key: 'NODE_VERSION', value: '24' },
      ],
      serviceDetails: {
        runtime: 'node', plan: 'free', region: 'frankfurt', healthCheckPath: '/health',
        envSpecificDetails: { buildCommand: 'npm ci --include=dev && npm run db:migrate && npm run build:api', startCommand: 'npm run start:prod' },
      },
    });
    api = r.service ?? r;
  } else {
    // Existing service (PR update): the trusted workflow rotates the DB password at each run.
    await render('PUT', `/services/${api.id}/env-vars/DATABASE_URL`, { value: e.NEON_DB_URL });
    await render('PUT', `/services/${api.id}/env-vars/DATABASE_URL_DIRECT`, { value: e.NEON_DB_URL_DIRECT });
  }
  const apiUrl = urlOf(api, guess(names.api));

  const staticSvc = async (name, buildCommand, publishPath, envVars) => {
    let s = await findService(name);
    if (s) existing.add(s.id);
    if (!s) {
      const r = await render('POST', '/services', {
        ...common, type: 'static_site', name, envVars,
        serviceDetails: { buildCommand, publishPath, routes: [{ type: 'rewrite', source: '/*', destination: '/index.html' }] },
      });
      s = r.service ?? r;
    }
    return s;
  };
  const web = await staticSvc(names.web, 'npm ci --include=dev && npm run build:web', 'dist/apps/web/browser',
    [{ key: 'WEB_API_URL', value: apiUrl }, { key: 'NODE_VERSION', value: '24' }]);
  const site = await staticSvc(names.site, 'npm ci --include=dev && npm run build:site', 'dist/apps/site/browser',
    [{ key: 'NODE_VERSION', value: '24' }]);

  // PR update: do not rely on Render's GitHub webhook; explicitly deploy the newest commit of the branch.
  for (const id of existing) {
    const d = await render('POST', `/services/${id}/deploys`, { clearCache: 'do_not_clear' });
    console.log(`deploy requested for ${id}: ${d?.id ?? 'n/a'} (${d?.commit?.id?.slice(0, 7) ?? 'latest'})`);
  }

  // Real URLs can differ from the guess (name collision suffix): fix CORS if so.
  const realWeb = urlOf(web, webUrl), realSite = urlOf(site, siteUrl);
  if (realWeb !== webUrl || realSite !== siteUrl) {
    await render('PUT', `/services/${api.id}/env-vars/CORS_ORIGIN`, { value: `${realWeb},${realSite}` });
  }
  await upsertComment([
    `### Previews Render pour la PR #${pr}`,
    '| Composant | Lien |', '|---|---|',
    `| Site public | ${realSite} |`, `| Front d'administration | ${realWeb} |`, `| API | ${apiUrl}/health |`,
    '',
    `Base de donnees Neon isolee pour cette PR : \`${e.NEON_BRANCH_NAME ?? 'n/a'}\` (fictive, derivee de \`preview/main\`).`,
    'Les services Render sont en plan gratuit (le premier appel peut etre lent). Ils sont supprimes a la fermeture de la PR.',
  ].join('\n'));
}

async function cleanup() {
  for (const n of Object.values(names)) {
    const s = await findService(n);
    if (s) await render('DELETE', `/services/${s.id}`);
  }
  await upsertComment(`### Previews Render pour la PR #${pr}\nPR fermee : les 3 services de preview ont ete supprimes.`);
}

if (MODE === 'ensure') await ensure();
else if (MODE === 'cleanup') await cleanup();
else throw new Error('usage: ensure|cleanup');
