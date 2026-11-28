// Garde du mode [preview-migrate-only] : migration ciblee, preview de la PR seulement, jamais de seed.
// Sortie 0 = autorise, sortie 1 = refuse (raison sur stderr).
export function checkMigrateOnly(env) {
  const errors = [];
  const pr = String(env.PR_NUMBER ?? '');
  if (!/^[1-9][0-9]*$/.test(pr)) errors.push('numero de PR invalide');
  if (pr === '42') errors.push('PR 42 exclue');
  if (env.EVENT_NAME !== 'pull_request') errors.push('evenement pull_request requis');
  if (env.EVENT_ACTION !== 'synchronize') errors.push('action synchronize requise');
  if (!String(env.COMMIT_MESSAGE ?? '').includes('[preview-migrate-only]')) errors.push('marqueur [preview-migrate-only] absent');
  if (env.BRANCH_NAME !== `preview/pr-${pr}`) errors.push('la base doit etre la branche preview/pr-<PR>');
  if (env.IMAGE_ONLY !== 'true') errors.push('mode image seule requis (service existant, pas de creation)');
  if (String(env.SEED ?? 'false') !== 'false') errors.push('seed interdit dans ce mode');
  return errors;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = checkMigrateOnly(process.env);
  if (errors.length) {
    console.error('Migration ciblee refusee : ' + errors.join(' ; '));
    process.exit(1);
  }
  console.log('Migration ciblee autorisee sur preview/pr-' + process.env.PR_NUMBER);
}
