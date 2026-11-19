import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assessFictitiousUsers,
  executePreviewDemoSeed,
  previewDemoSeedDecision,
  resolveEffectiveDatabaseTarget,
} from './seed-preview-demo.mjs';

const SCRIPT = fileURLToPath(new URL('./seed-preview-demo.mjs', import.meta.url));

const PREVIEW_ENV = {
  RENDER: 'true',
  RENDER_GIT_BRANCH: 'feature/consignes-docs',
  RENDER_SERVICE_NAME: 'al-pr39-api',
  DATABASE_URL: 'postgres://u:p@ep-example-pooler.eu-west-2.aws.neon.tech/db',
  DATABASE_URL_DIRECT: 'postgres://u:p@ep-example.eu-west-2.aws.neon.tech/db',
};

// Environnement minimal controle pour les executions reelles du wrapper.
const runWrapperCli = (env) =>
  spawnSync(process.execPath, [SCRIPT], {
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
  });

// Dependances factices injectees : aucune base, aucun sous-processus npm.
const fakeDeps = ({ marker, markerError, seedStatus = 0, countsError } = {}) => {
  const calls = { queries: 0, seedRuns: 0 };
  return {
    calls,
    queryRow: async () => {
      calls.queries += 1;
      if (calls.queries === 1) {
        if (markerError) throw new Error('connexion refusee');
        return marker;
      }
      if (countsError) throw new Error('lecture impossible');
      return { categories: 11, links: 22 };
    },
    runSeed: async () => {
      calls.seedRuns += 1;
      return seedStatus;
    },
    log: () => {},
    logError: () => {},
  };
};

test('decision : hors contexte preview, tout est refuse', () => {
  assert.equal(previewDemoSeedDecision({}).run, false);
  assert.equal(previewDemoSeedDecision({ ...PREVIEW_ENV, RENDER: undefined }).run, false);
  assert.equal(
    previewDemoSeedDecision({ ...PREVIEW_ENV, RENDER_GIT_BRANCH: 'main' }).run,
    false,
    'branche main',
  );
  assert.equal(
    previewDemoSeedDecision({ ...PREVIEW_ENV, RENDER_GIT_BRANCH: 'feature/autre' }).run,
    false,
    'autre branche feature',
  );
  assert.equal(
    previewDemoSeedDecision({ ...PREVIEW_ENV, RENDER_SERVICE_NAME: 'al-pr40-api' }).run,
    false,
    'service d une autre PR',
  );
  const sansCible = { ...PREVIEW_ENV };
  delete sansCible.DATABASE_URL;
  delete sansCible.DATABASE_URL_DIRECT;
  assert.equal(
    previewDemoSeedDecision(sansCible).run,
    true,
    'contexte complet sans cible : decision positive, echec bloquant leve dans execute',
  );
});

test('decision : la preview exacte de la PR39 est acceptee', () => {
  const decision = previewDemoSeedDecision(PREVIEW_ENV);
  assert.equal(decision.run, true);
  assert.match(decision.reason, /al-pr39-api/);
});

test('resolution de cible : meme priorite que typeorm.config (DIRECT d abord)', () => {
  const direct = resolveEffectiveDatabaseTarget(PREVIEW_ENV);
  assert.equal(direct.via, 'DATABASE_URL_DIRECT');
  assert.match(direct.connectionString, /ep-example\./);
  const pooledOnly = { ...PREVIEW_ENV };
  delete pooledOnly.DATABASE_URL_DIRECT;
  assert.equal(resolveEffectiveDatabaseTarget(pooledOnly).via, 'DATABASE_URL');
  const hostOnly = { DB_HOST: 'db.local', DB_PORT: '5433' };
  const hostTarget = resolveEffectiveDatabaseTarget(hostOnly);
  assert.equal(hostTarget.via, 'DB_HOST');
  assert.equal(hostTarget.host, 'db.local');
  assert.equal(hostTarget.port, 5433);
});

test('marqueur de coherence : vide ou mixte refuse, 100% fictif accepte', () => {
  assert.equal(assessFictitiousUsers({ total: 0, fictitious: 0 }).ok, false, 'base vide');
  assert.equal(assessFictitiousUsers({ total: 5, fictitious: 4 }).ok, false, 'un compte hors domaine');
  assert.equal(assessFictitiousUsers({ total: 5, fictitious: 5 }).ok, true, 'tout fictif');
});

test('execution injectee : parcours nominal, controle puis seed puis comptage', async () => {
  const deps = fakeDeps({ marker: { total: 12, fictitious: 12 } });
  const code = await executePreviewDemoSeed(PREVIEW_ENV, deps);
  assert.equal(code, 0);
  assert.equal(deps.calls.seedRuns, 1, 'seed execute une fois');
  assert.equal(deps.calls.queries, 2, 'controle prealable + comptage post-seed');
});

test('execution injectee : base incoherente = refus, seed jamais appele', async () => {
  const deps = fakeDeps({ marker: { total: 12, fictitious: 11 } });
  const code = await executePreviewDemoSeed(PREVIEW_ENV, deps);
  assert.equal(code, 1);
  assert.equal(deps.calls.seedRuns, 0);
});

test('execution injectee : controle illisible = echec, seed jamais appele', async () => {
  const deps = fakeDeps({ markerError: true });
  const code = await executePreviewDemoSeed(PREVIEW_ENV, deps);
  assert.equal(code, 1);
  assert.equal(deps.calls.seedRuns, 0);
});

test('execution injectee : seed en echec = code 1 (fail-hard, pas de faux succes)', async () => {
  const deps = fakeDeps({ marker: { total: 12, fictitious: 12 }, seedStatus: 3 });
  const code = await executePreviewDemoSeed(PREVIEW_ENV, deps);
  assert.equal(code, 1);
  assert.equal(deps.calls.queries, 1, 'pas de comptage apres un seed en echec');
});

test('execution injectee : comptage post-seed illisible = echec', async () => {
  const deps = fakeDeps({ marker: { total: 12, fictitious: 12 }, countsError: true });
  const code = await executePreviewDemoSeed(PREVIEW_ENV, deps);
  assert.equal(code, 1);
});

test('execution injectee : contexte PR39 sans cible DB = echec visible, rien tente', async () => {
  const sansCible = { ...PREVIEW_ENV };
  delete sansCible.DATABASE_URL;
  delete sansCible.DATABASE_URL_DIRECT;
  const deps = fakeDeps({ marker: { total: 12, fictitious: 12 } });
  const code = await executePreviewDemoSeed(sansCible, deps);
  assert.equal(code, 1, 'echec bloquant, pas un saut 0');
  assert.equal(deps.calls.queries, 0, 'aucune requete sans cible');
  assert.equal(deps.calls.seedRuns, 0, 'seed jamais appele');
});

test('execution reelle du wrapper : hors contexte, saut explicite et sortie 0', () => {
  const res = runWrapperCli({});
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /saut/);
});

test('execution reelle du wrapper : branche principale refusee, sortie 0', () => {
  const res = runWrapperCli({ ...PREVIEW_ENV, RENDER_GIT_BRANCH: 'main' });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /saut.*main/);
});

test('execution reelle du wrapper : contexte PR39 sans cible DB, echec visible code 1', () => {
  const sansCible = { ...PREVIEW_ENV };
  delete sansCible.DATABASE_URL;
  delete sansCible.DATABASE_URL_DIRECT;
  const res = runWrapperCli(sansCible);
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.stdout + res.stderr, /ECHEC.*aucune cible DB/);
});
