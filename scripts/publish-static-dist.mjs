#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
// Publie les builds statiques (web admin, site public, mobile si present) sur la
// branche `deploy` du repo, que les static sites Render suivent avec une commande
// de build VIDE : Render ne fait que copier les fichiers sur son CDN, zero minute
// de pipeline (docs/deploiement.md).
//
// La branche `deploy` garde un historique (un commit par push sur main qui change
// un dist) : le rollback d'un front revient a deployer un commit precedent.
// Si aucun dist n'a change, rien n'est pousse et les deploys sont laisses a
// l'appelant (qui s'abstient alors d'appeler Render).
//
// Usage : node scripts/publish-static-dist.mjs   (dans le checkout du repo, apres les builds)
// Env : DEPLOY_BRANCH (defaut "deploy"), SOURCE_SHA (defaut: git rev-parse HEAD),
//       DRY_RUN=1 pour assembler sans pousser.
const e = process.env;
const DRY = e.DRY_RUN === '1';
const BRANCH = e.DEPLOY_BRANCH ?? 'deploy';
if (!/^[\w./-]{1,100}$/.test(BRANCH)) throw new Error('DEPLOY_BRANCH invalide');

// source (dist builde) -> dossier sur la branche deploy
const APPS = [
  ['web', 'dist/apps/web/browser'],
  ['site', 'dist/apps/site/browser'],
  ['mobile', 'dist/apps/mobile/browser'],
];

const git = (args, cwd) => execFileSync('git', args, { cwd: cwd ?? process.cwd(), stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

function run() {
  const present = APPS.filter(([, dist]) => existsSync(dist));
  if (present.length === 0) throw new Error('aucun dist trouve (lancer les builds avant)');
  const sha = e.SOURCE_SHA ?? git(['rev-parse', 'HEAD']);

  const wt = join(tmpdir(), `deploy-branch-${process.pid}`);
  rmSync(wt, { recursive: true, force: true });
  mkdirSync(wt, { recursive: true });
  let branchExists = false;
  try { git(['fetch', 'origin', `${BRANCH}:${BRANCH}`]); branchExists = true; } catch { branchExists = false; }

  if (branchExists) git(['worktree', 'add', wt, BRANCH]);
  else {
    // Premiere publication : creer une branche orpheline (racine vide) dans le
    // worktree, compatible avec les vieux git (pas de `worktree add --orphan`).
    git(['worktree', 'add', '--no-checkout', wt]);
    git(['symbolic-ref', 'HEAD', `refs/heads/${BRANCH}`], wt);
  }

  try {
    // Nettoie le contenu precedent (sauf .git) puis copie les dist presents.
    for (const entry of execFileSync('ls', ['-A', wt]).toString().split('\n')) {
      if (entry && entry !== '.git') rmSync(join(wt, entry), { recursive: true, force: true });
    }
    for (const [app, dist] of present) cpSync(dist, join(wt, app), { recursive: true });
    writeFileSync(join(wt, 'SOURCE.txt'), `source: ${sha}\napps: ${present.map(([a]) => a).join(', ')}\n`);

    git(['add', '-A'], wt);
    let changed = true;
    try { git(['diff', '--cached', '--quiet'], wt); changed = false; } catch { changed = true; }
    if (!changed) {
      console.log(`aucun changement de dist pour ${sha.slice(0, 7)} : rien a pousser.`);
      console.log('PUBLISH_RESULT pushed=false');
      return { pushed: false, apps: present.map(([a]) => a) };
    }
    git(['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      'commit', '-q', '-m', `deploy: dist statiques de ${sha.slice(0, 7)} (${present.map(([a]) => a).join(', ')})`], wt);
    if (DRY) { console.log('[dry] push', BRANCH); console.log('PUBLISH_RESULT pushed=true'); return { pushed: true, apps: present.map(([a]) => a) }; }
    git(['push', 'origin', `${BRANCH}:${BRANCH}`], wt);
    console.log(`branche ${BRANCH} mise a jour pour ${sha.slice(0, 7)} : ${present.map(([a]) => a).join(', ')}`);
    console.log('PUBLISH_RESULT pushed=true');
    return { pushed: true, apps: present.map(([a]) => a) };
  } finally {
    try { git(['worktree', 'remove', '--force', wt]); } catch { /* deja parti */ }
  }
}

export { run };

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) run();
