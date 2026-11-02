// Appele par `npm run db:migrate`. Ne fait strictement rien (et ne charge ni tsx ni le code API) sauf si
// PREVIEW_SEED_PROGRAM=true, variable posee uniquement par le pipeline de preview de PR : une installation ou la
// production restent sans donnee. Le peuplement ne touche jamais un jour qui contient deja des sequences.
import { spawnSync } from 'node:child_process';

export const isEnabled = (env = process.env) => env.PREVIEW_SEED_PROGRAM === 'true';

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!isEnabled()) {
    console.log('[seed-preview-program] PREVIEW_SEED_PROGRAM is not "true": skipped.');
  } else {
    const result = spawnSync('npm', ['run', 'seed:preview-program'], { stdio: 'inherit', env: process.env });
    process.exit(result.status ?? 1);
  }
}
