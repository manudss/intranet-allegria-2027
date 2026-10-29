// Demarrage d'un deploiement Render de preview (gratuit) avec sa PROPRE branche Neon.
//
// Pour chaque deploiement (service de base ou preview de PR), on cree/reutilise une branche Neon
// `preview/render-<branche git>` issue de `preview/main` (donnees fictives uniquement), avec
// expiration automatique. DATABASE_URL pointe donc vers une base isolee, jamais vers `production`
// ni vers une base partagee entre PR. Puis migrations, puis API.
//
// Variables (Render) : NEON_API_KEY (secret), NEON_PROJECT_ID, RENDER_GIT_BRANCH (fournie par Render).
// Optionnelles : NEON_PARENT_BRANCH (defaut preview/main), PREVIEW_TTL_DAYS (defaut 14, max 30),
// NEON_API_BASE (tests).
import { spawn, spawnSync } from 'node:child_process';

const api = (process.env.NEON_API_BASE ?? 'https://console.neon.tech/api/v2').replace(/\/+$/, '');
const key = process.env.NEON_API_KEY;
const projectId = process.env.NEON_PROJECT_ID;
const gitBranch = process.env.RENDER_GIT_BRANCH;
const parentName = process.env.NEON_PARENT_BRANCH ?? 'preview/main';
const ttlDays = Math.min(30, Math.max(1, Number(process.env.PREVIEW_TTL_DAYS ?? 14)));

const fail = (message) => {
  console.error(`[preview-start] ${message}`);
  process.exit(1);
};

export const branchNameFor = (value) => {
  const slug = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug ? `preview/render-${slug}` : undefined;
};

const call = async (method, path, body) => {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) fail(`Neon API ${method} ${path} -> HTTP ${res.status}`);
  return res.json();
};

const run = (command, args, env) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });

const main = async () => {
  if (!key || !projectId) fail('NEON_API_KEY and NEON_PROJECT_ID are required');
  const target = branchNameFor(gitBranch);
  if (!target) fail('RENDER_GIT_BRANCH is missing, refusing to guess a database branch');
  if (target === parentName || target === 'production') fail(`refusing to use branch ${target}`);

  const { branches } = await call('GET', `/projects/${projectId}/branches`);
  const parent = branches.find((b) => b.name === parentName);
  if (!parent)
    fail(`parent branch ${parentName} not found: refusing to fall back to another branch`);
  if (parent.default) fail(`parent branch ${parentName} is the default (production) branch`);

  let connectionUri;
  const existing = branches.find((b) => b.name === target);
  if (existing) {
    if (existing.parent_id !== parent.id) fail(`branch ${target} exists with another parent`);
    const { databases } = await call(
      'GET',
      `/projects/${projectId}/branches/${existing.id}/databases`,
    );
    const database = databases[0];
    if (!database) fail(`branch ${target} has no database`);
    const query = new URLSearchParams({
      branch_id: existing.id,
      database_name: database.name,
      role_name: database.owner_name,
    });
    const info = await call('GET', `/projects/${projectId}/connection_uri?${query}`);
    connectionUri = info.uri;
    console.log(`[preview-start] reusing Neon branch ${target}`);
  } else {
    const expiresAt = new Date(Date.now() + ttlDays * 86_400_000)
      .toISOString()
      .replace(/\.\d+Z$/, 'Z');
    const created = await call('POST', `/projects/${projectId}/branches`, {
      branch: { name: target, parent_id: parent.id, expires_at: expiresAt },
      endpoints: [{ type: 'read_write' }],
    });
    connectionUri = created.connection_uris?.[0]?.connection_uri;
    console.log(
      `[preview-start] created Neon branch ${target} from ${parentName}, expires ${expiresAt}`,
    );
  }
  if (!connectionUri) fail('no connection URI returned by Neon');

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_URL: connectionUri,
    DATABASE_URL_DIRECT: connectionUri,
    DB_SSL: 'true',
  };
  delete env.NEON_API_KEY; // the API process does not need it

  const migrate = spawnSync('npm', ['run', 'migration:run'], { stdio: 'inherit', env });
  if (migrate.status !== 0) fail('migrations failed');
  process.exit(await run('node', ['dist/apps/api/main.js'], env));
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
