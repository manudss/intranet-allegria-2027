#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
// Orchestrates the per-PR Render services (api, web admin, public site, and the mobile PWA
// when the PR branch contains apps/mobile) from a TRUSTED
// GitHub Actions workflow (pull_request_target, or issue_comment / workflow_dispatch which
// run the DEFAULT branch version of this file: never PR code).
//
// DEPLOY ON DEMAND (since 2026-10-30): a push on a PR branch NEVER starts a Render build.
// Each build costs part of the 500 free pipeline minutes/month shared by the workspace (and
// this repo builds 3 services per preview), so the previews only build when someone wants
// to test the branch:
//   - ensure   (PR opened / updated): no build, no service creation, no env change. Only
//              maintains the status comment on the PR. The workflow still prepares the free
//              Neon branch for the PR.
//   - refresh  (`/preview` PR comment from OWNER/MEMBER/COLLABORATOR, or the manual Actions
//              dispatch): creates the services if needed, rotates the DB creds and deploys
//              the latest commit of the PR branch. The head branch/sha are read back from
//              the GitHub API here, never taken from event or env metadata.
//   - cleanup  (PR closed): deletes the preview services (the workflow deletes the Neon branch).
// Untrusted values (branch name) are validated before use.
// Usage: node scripts/render-pr-previews.mjs ensure|refresh|cleanup
// Env: RENDER_API_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER,
//      RENDER_OWNER_ID + RENDER_ENVIRONMENT_ID + NEON_DB_URL + NEON_DB_URL_DIRECT (refresh only),
//      NEON_BRANCH_NAME (comment text only), DRY_RUN=1 to print the plan only.
const MODE = process.argv[2];
const e = process.env;
const DRY = e.DRY_RUN === '1';
const pr = Number(e.PR_NUMBER);
if (!Number.isInteger(pr) || pr <= 0) throw new Error('PR_NUMBER invalid');
const repoFull = e.GITHUB_REPOSITORY ?? '';
if (!/^[\w.-]+\/[\w.-]+$/.test(repoFull)) throw new Error('GITHUB_REPOSITORY invalid');

const RENDER = 'https://api.render.com/v1';
const names = { api: `al-pr${pr}-api`, web: `al-pr${pr}-web`, site: `al-pr${pr}-site`, mobile: `al-pr${pr}-mobile` };
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
  if (res.status === 404) return null;
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
const guess = (n) => `https://${n}.onrender.com`;

function header() {
  return `### Previews Render pour la PR #${pr}`;
}
function linksTable(apiUrl, webUrl, siteUrl, mobileUrl) {
  const rows = [
    '| Composant | Lien |', '|---|---|',
    `| Site public | ${siteUrl} |`,
    `| Front d'administration | ${webUrl} |`,
    `| API | ${apiUrl}/health |`,
  ];
  if (mobileUrl) rows.push(`| App mobile (PWA) | ${mobileUrl} |`);
  return rows.join('\n');
}
const HOWTO = "Pour deployer ou mettre a jour les previews avec le dernier commit : commente `/preview` sur cette PR (ou onglet **Actions > PR Previews > Run workflow** avec le numero de la PR).";

// ensure: PR opened/updated. Never builds; only keeps the status comment accurate.
async function ensure() {
  const found = {};
  for (const [k, n] of Object.entries(names)) found[k] = await findService(n);
  const any = Object.values(found).some(Boolean);
  if (!any) {
    await upsertComment([
      header(),
      '**Previews a la demande** : les pushes ne lancent plus de build Render (chaque build consomme une part des 500 minutes de pipeline gratuites partagees du mois, et cette PR construit plusieurs services : api, admin, site, et mobile si la branche contient apps/mobile).',
      '',
      HOWTO,
      '',
      `Base de donnees Neon prete pour cette PR : \`${e.NEON_BRANCH_NAME ?? `preview/pr-${pr}`}\` (fictive, derivee de \`preview/main\`).`,
      'Les services Render sont crees au premier `/preview` et supprimes a la fermeture de la PR.',
    ].join('\n'));
    console.log('no preview services: status comment only, no build.');
    return;
  }
  const apiUrl = urlOf(found.api, guess(names.api));
  const webUrl = urlOf(found.web, guess(names.web));
  const siteUrl = urlOf(found.site, guess(names.site));
  const mobileUrl = found.mobile ? urlOf(found.mobile, guess(names.mobile)) : undefined;
  await upsertComment([
    header(),
    linksTable(apiUrl, webUrl, siteUrl, mobileUrl),
    '',
    'Les pushes ne redeploient plus automatiquement. ' + HOWTO,
    'Plan gratuit : le premier appel peut etre lent. Les services sont supprimes a la fermeture de la PR.',
  ].join('\n'));
  console.log('previews exist: status comment refreshed, no build.');
}

// refresh: explicit request to (re)deploy the latest commit of the PR branch.
async function refresh() {
  // Read the head back from the API: never trust event/env metadata for what gets built.
  const d = await gh('GET', `/pulls/${pr}`);
  if (!d || d.state !== 'open') throw new Error(`PR #${pr} is not open`);
  if (d.head?.repo?.full_name !== repoFull) throw new Error('fork PR: refused');
  const branch = d.head?.ref ?? '';
  const sha = d.head?.sha ?? '';
  if (!/^[\w./-]{1,200}$/.test(branch)) throw new Error('head branch rejected');
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('head sha rejected');

  // The mobile PWA preview only makes sense when the branch actually carries apps/mobile
  // (its build command would fail otherwise). A directory listing comes back as an array;
  // a 404 comes back as null.
  const hasMobile = Array.isArray(await gh('GET', `/contents/apps/mobile?ref=${sha}`));

  const repo = `https://github.com/${repoFull}`;
  if (!e.RENDER_ENVIRONMENT_ID) throw new Error('RENDER_ENVIRONMENT_ID is required (Allegria-demo project, dev environment)');
  const common = { ownerId: e.RENDER_OWNER_ID, environmentId: e.RENDER_ENVIRONMENT_ID, repo, branch, autoDeploy: 'no' }; // deploys are triggered only by this trusted workflow, not by Render's GitHub webhook

  // PUT only the env vars whose value actually changed. NOTE: with autoDeploy 'no',
  // Render does NOT redeploy on an env var change, so a change never replaces the
  // explicit deploy below - without it, rotating the DB creds would leave the running
  // API with invalid credentials (observed 2026-11-12: 'password authentication failed').
  const syncEnv = async (id, desired) => {
    const vars = await render('GET', `/services/${id}/env-vars`);
    const cur = {};
    for (const x of Array.isArray(vars) ? vars : []) { const v = x.envVar ?? x; cur[v.key] = v.value; }
    let changed = false;
    for (const { key, value } of desired) {
      if (cur[key] !== value) { await render('PUT', `/services/${id}/env-vars/${key}`, { value }); changed = true; }
    }
    return changed;
  };
  const explicitDeploy = async (id) => {
    const dep = await render('POST', `/services/${id}/deploys`, { clearCache: 'do_not_clear' });
    console.log(`deploy requested for ${id}: ${dep?.id ?? 'n/a'} (${dep?.commit?.id?.slice(0, 7) ?? 'latest'})`);
  };

  // api
  let api = await findService(names.api);
  let apiCreated = false;
  if (!api) {
    const r = await render('POST', '/services', {
      ...common, type: 'web_service', name: names.api,
      envVars: [
        { key: 'DATABASE_URL', value: e.NEON_DB_URL },
        { key: 'DATABASE_URL_DIRECT', value: e.NEON_DB_URL_DIRECT },
        { key: 'DB_SSL', value: 'true' },
        { key: 'CORS_ORIGIN', value: [guess(names.web), guess(names.site), ...(hasMobile ? [guess(names.mobile)] : [])].join(',') },
        { key: 'NODE_VERSION', value: '24' },
      ],
      serviceDetails: {
        runtime: 'node', plan: 'free', region: 'frankfurt', healthCheckPath: '/health',
        envSpecificDetails: { buildCommand: 'npm ci --include=dev && npm run db:migrate && npm run build:api', startCommand: 'npm run start:prod' },
      },
    });
    api = r.service ?? r;
    apiCreated = true;
  }
  const apiUrl = urlOf(api, guess(names.api));

  // static sites
  const staticSvc = async (name, buildCommand, publishPath, envVars) => {
    let s = await findService(name);
    if (s) return { s, created: false };
    const r = await render('POST', '/services', {
      ...common, type: 'static_site', name, envVars,
      serviceDetails: { buildCommand, publishPath, routes: [{ type: 'rewrite', source: '/*', destination: '/index.html' }] },
    });
    return { s: r.service ?? r, created: true };
  };
  const web = await staticSvc(names.web, 'npm ci --include=dev && npm run build:web', 'dist/apps/web/browser',
    [{ key: 'WEB_API_URL', value: apiUrl }, { key: 'NODE_VERSION', value: '24' }]);
  const site = await staticSvc(names.site, 'npm ci --include=dev && npm run build:site', 'dist/apps/site/browser',
    [{ key: 'NODE_VERSION', value: '24' }]);
  const mobile = hasMobile
    ? await staticSvc(names.mobile, 'npm ci --include=dev && npm run build:mobile', 'dist/apps/mobile/browser',
      [{ key: 'MOBILE_API_URL', value: apiUrl }, { key: 'NODE_VERSION', value: '24' }])
    : null;

  // Real URLs can differ from the guess (name collision suffix): keep CORS exact.
  const realWeb = urlOf(web.s, guess(names.web));
  const realSite = urlOf(site.s, guess(names.site));
  const realMobile = mobile ? urlOf(mobile.s, guess(names.mobile)) : undefined;
  const corsValue = [realWeb, realSite, ...(realMobile ? [realMobile] : [])].join(',');
  const corsGuess = [guess(names.web), guess(names.site), ...(hasMobile ? [guess(names.mobile)] : [])].join(',');

  // Existing services: rotate the DB creds (they change at every run) and deploy the
  // newest commit, exactly one build per service. The explicit deploy is ALWAYS needed:
  // an env var change does not redeploy a service whose autoDeploy is 'no'.
  if (apiCreated) {
    if (corsValue !== corsGuess) {
      await render('PUT', `/services/${api.id}/env-vars/CORS_ORIGIN`, { value: corsValue });
    }
  } else {
    await syncEnv(api.id, [
      { key: 'DATABASE_URL', value: e.NEON_DB_URL },
      { key: 'DATABASE_URL_DIRECT', value: e.NEON_DB_URL_DIRECT },
      { key: 'CORS_ORIGIN', value: corsValue },
    ]);
    await explicitDeploy(api.id);
  }
  if (!web.created) {
    await syncEnv(web.s.id, [{ key: 'WEB_API_URL', value: apiUrl }]);
    await explicitDeploy(web.s.id);
  }
  if (!site.created) await explicitDeploy(site.s.id);
  if (mobile && !mobile.created) {
    await syncEnv(mobile.s.id, [{ key: 'MOBILE_API_URL', value: apiUrl }]);
    await explicitDeploy(mobile.s.id);
  }

  await upsertComment([
    header(),
    `Previews demandees : deploiement du dernier commit \`${sha.slice(0, 7)}\` lance.`,
    '',
    linksTable(apiUrl, realWeb, realSite, realMobile),
    '',
    `Base de donnees Neon isolee pour cette PR : \`${e.NEON_BRANCH_NAME ?? `preview/pr-${pr}`}\` (fictive, derivee de \`preview/main\`).`,
    'Les services Render sont en plan gratuit (le premier appel peut etre lent). Chaque `/preview` relance les builds (minutes de pipeline gratuites). Ils sont supprimes a la fermeture de la PR.',
  ].join('\n'));
}

async function cleanup() {
  for (const n of Object.values(names)) {
    const s = await findService(n);
    if (s) await render('DELETE', `/services/${s.id}`);
  }
  await upsertComment(`### Previews Render pour la PR #${pr}\nPR fermee : les services de preview ont ete supprimes.`);
}

export { ensure, refresh, cleanup };

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) {
  if (MODE === 'ensure') await ensure();
  else if (MODE === 'refresh') await refresh();
  else if (MODE === 'cleanup') await cleanup();
  else throw new Error('usage: ensure|refresh|cleanup');
}
