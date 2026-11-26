// Seed de demonstration au build de la preview Render de la PR39.
//
// Le buildCommand du service API de preview (verifie par le proprietaire sur
// le service al-pr39-api : `npm ci --include=dev && npm run db:migrate &&
// npm run build:api`) enchaine `npm run db:migrate` : ce script y est appele
// apres les migrations. Les workflows et l'orchestrateur Render sont lus
// depuis la branche par defaut : une PR ne peut pas ajouter d'etape au
// pipeline, elle ne peut agir que sur les scripts npm que le build invoque
// deja (db:migrate, build:api, start:prod), resolus depuis le commit deploye.
//
// DEUX PREUVES DISTINCTES, aucune ne suffit seule :
//   1. Contexte service : n'agir que si l'environnement declare la preview de
//      la PR39 - RENDER=true, RENDER_GIT_BRANCH='feature/consignes-docs',
//      RENDER_SERVICE_NAME='al-pr39-api' (nom attribue par
//      render-pr-previews.mjs : `al-pr<N>-api`). Variables fournies par Render
//      au build comme au runtime (render.com/docs/environment-variables).
//      Cela identifie le CONTEXTE du build, PAS la base ciblee par
//      DATABASE_URL : la cible exacte (branche Neon preview/pr-39) est
//      attestee par le workflow de confiance cote proprietaire, qui affecte
//      les identifiants au service.
//   2. Controle de coherence additionnel sur les donnees : avant toute
//      ecriture, les comptes de la base doivent tous etre des comptes fictifs
//      du seed de demonstration (@allegria.local). Ce n'est ni une preuve de
//      branche Neon ni une garantie d'absence de donnees reelles ; c'est un
//      garde-fou supplementaire contre une cible manifestement incoherente.
//
// MEME CIBLE EFFECTIVE pour le controle et l'ecriture : la resolution
// ci-dessous replique apps/api/src/database/typeorm.config.ts (DataSource
// migrationOptions, utilisee par seed:document-library) :
// DATABASE_URL_DIRECT ?? DATABASE_URL ?? NEON_DATABASE_URL, sinon DB_HOST,
// avec la meme regle SSL. Le controle lit donc la base ou le seed ecrit.
//
// FAIL-HARD une fois le contexte reconnu : toute erreur (AUCUNE cible DB
// declaree, controle illisible, coherence refusee, seed en echec, comptage
// post-seed illisible) sort en code 1 et interrompt le build, pour qu'un
// /preview ne reussisse pas en laissant croire que les fiches sont chargees.
// Le saut explicite en sortie 0 n'existe que HORS contexte PR39 (db:migrate
// sert aussi hors preview).
//
// Le seed lui-meme (seed:document-library) est idempotent, sans purge ni
// ecrasement : fiches et retouches manuelles conservees.
//
// Tests : par injection de dependances (executePreviewDemoSeed recoit
// queryRow/runSeed) et executions reelles des chemins de refus ; aucun
// contournement par variable d'environnement n'existe dans ce fichier.

import { spawnSync } from 'node:child_process';

export const EXPECTED_PREVIEW_BRANCH = 'feature/consignes-docs';
export const EXPECTED_PREVIEW_SERVICE = 'al-pr39-api';
export const FICTITIOUS_EMAIL_DOMAIN = '@allegria.local';

export const FICTITIOUS_USERS_SQL =
  `SELECT count(*)::int AS total, ` +
  `count(*) FILTER (WHERE email LIKE '%${FICTITIOUS_EMAIL_DOMAIN}')::int AS fictitious ` +
  `FROM users`;

export const DOCUMENT_LIBRARY_COUNTS_SQL =
  'SELECT (SELECT count(*)::int FROM document_categories)::int AS categories, ' +
  '(SELECT count(*)::int FROM document_links)::int AS links';

// Replique la resolution de typeorm.config.ts (migrationOptions) : meme
// priorite d'URL, meme regle SSL, meme repli host/port. Le controle prealable
// et le seed visent ainsi la meme base effective par construction.
export const resolveEffectiveDatabaseTarget = (env = process.env) => {
  const url = env.DATABASE_URL_DIRECT ?? env.DATABASE_URL ?? env.NEON_DATABASE_URL;
  const ssl =
    env.DB_SSL === 'true' || Boolean(url) ? { rejectUnauthorized: false } : undefined;
  if (url) {
    const via = env.DATABASE_URL_DIRECT
      ? 'DATABASE_URL_DIRECT'
      : env.DATABASE_URL
        ? 'DATABASE_URL'
        : 'NEON_DATABASE_URL';
    return { connectionString: url, ssl, via };
  }
  return {
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 5432),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl,
    via: 'DB_HOST',
  };
};

export const previewDemoSeedDecision = (env = process.env) => {
  if (env.RENDER !== 'true') {
    return { run: false, reason: 'RENDER != true (poste de dev ou CI hors simulation)' };
  }
  const branch = env.RENDER_GIT_BRANCH ?? '';
  if (branch !== EXPECTED_PREVIEW_BRANCH) {
    return { run: false, reason: `branche '${branch}' != '${EXPECTED_PREVIEW_BRANCH}'` };
  }
  const service = env.RENDER_SERVICE_NAME ?? '';
  if (service !== EXPECTED_PREVIEW_SERVICE) {
    return { run: false, reason: `service '${service}' != '${EXPECTED_PREVIEW_SERVICE}'` };
  }
  // La cible DB n'est pas verifiee ici : dans le contexte PR39, son absence
  // est une erreur bloquante levee dans executePreviewDemoSeed, pas un saut.
  return { run: true, reason: `preview ${EXPECTED_PREVIEW_SERVICE} (${EXPECTED_PREVIEW_BRANCH})` };
};

export const declaredDatabaseTarget = (env = process.env) =>
  env.DATABASE_URL_DIRECT ?? env.DATABASE_URL ?? env.NEON_DATABASE_URL ?? env.DB_HOST ?? null;

// Controle de coherence additionnel, pas une preuve de cible : tous les
// comptes doivent etre fictifs ; base vide ou mixte = incoherent, refus.
export const assessFictitiousUsers = (counts) => {
  // pg renvoie number pour int4 mais string pour int8 : coercition explicite.
  const total = Number(counts?.total ?? 0);
  const fictitious = Number(counts?.fictitious ?? 0);
  if (!total) {
    return { ok: false, reason: 'aucun compte utilisateur : base non seedee, incoherent' };
  }
  if (fictitious !== total) {
    return {
      ok: false,
      reason:
        `${total - fictitious} compte(s) hors ${FICTITIOUS_EMAIL_DOMAIN} sur ${total} : ` +
        'incoherent avec une base de demonstration',
    };
  }
  return { ok: true, reason: `${total} comptes fictifs (${FICTITIOUS_EMAIL_DOMAIN})` };
};

// Corps principal, dependances injectees pour les tests.
// deps.queryRow(sql) -> ligne de resultat ; deps.runSeed() -> code de sortie.
export const executePreviewDemoSeed = async (env, deps) => {
  const { queryRow, runSeed } = deps;
  const log = deps.log ?? console.log;
  const logError = deps.logError ?? console.error;
  const fail = (message) => {
    logError(`[seed-preview-demo] ECHEC : ${message}`);
    return 1;
  };

  const decision = previewDemoSeedDecision(env);
  if (!decision.run) {
    log(`[seed-preview-demo] saut : ${decision.reason}`);
    return 0;
  }
  log(`[seed-preview-demo] contexte service reconnu : ${decision.reason}`);
  if (!declaredDatabaseTarget(env)) {
    return fail(
      'contexte PR39 reconnu mais aucune cible DB declaree ' +
        '(DATABASE_URL_DIRECT, DATABASE_URL, NEON_DATABASE_URL ou DB_HOST)',
    );
  }
  log(`[seed-preview-demo] cible DB resolue via ${resolveEffectiveDatabaseTarget(env).via}`);

  let marker;
  try {
    marker = await queryRow(FICTITIOUS_USERS_SQL);
  } catch (error) {
    return fail(
      `controle de coherence illisible (${error instanceof Error ? error.message : error})`,
    );
  }
  const assessment = assessFictitiousUsers(marker);
  log(`[seed-preview-demo] controle de coherence : ${assessment.reason}`);
  if (!assessment.ok) {
    return fail("ecriture refusee sur une base incoherente avec la demonstration");
  }

  const seedStatus = await runSeed();
  if (seedStatus !== 0) {
    return fail(
      `seed documentaire termine en erreur (code ${seedStatus ?? 'inconnu'}) : ` +
        'le build est interrompu pour ne pas valider une preview sans fiches',
    );
  }

  try {
    const counts = await queryRow(DOCUMENT_LIBRARY_COUNTS_SQL);
    log(
      `[seed-preview-demo] verification post-seed : ${counts.categories} categories, ` +
        `${counts.links} fiches presentes en base`,
    );
  } catch (error) {
    return fail(
      `verification post-seed illisible (${error instanceof Error ? error.message : error})`,
    );
  }
  log('[seed-preview-demo] chargement documentaire termine et verifie.');
  return 0;
};

const queryRowForReal = async (sql) => {
  const { default: pg } = await import('pg');
  const target = resolveEffectiveDatabaseTarget(process.env);
  const client = target.connectionString
    ? new pg.Client({ connectionString: target.connectionString, ssl: target.ssl })
    : new pg.Client({
        host: target.host,
        port: target.port,
        database: target.database,
        user: target.user,
        password: target.password,
        ssl: target.ssl,
      });
  await client.connect();
  try {
    return (await client.query(sql)).rows[0];
  } finally {
    await client.end();
  }
};

const runSeedForReal = async () => {
  const result = spawnSync('npm', ['run', 'seed:document-library'], {
    stdio: 'inherit',
    env: process.env,
  });
  return result.status ?? 1;
};

const main = async () => {
  process.exitCode = await executePreviewDemoSeed(process.env, {
    queryRow: queryRowForReal,
    runSeed: runSeedForReal,
  });
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(
      `[seed-preview-demo] ECHEC : erreur inattendue (${error instanceof Error ? error.message : error})`,
    );
    process.exitCode = 1;
  });
}
