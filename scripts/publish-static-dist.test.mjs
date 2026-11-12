// Integration test for scripts/publish-static-dist.mjs on a real temp git repo
// (local only, no network, no secrets). Run: node --test scripts/publish-static-dist.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from './publish-static-dist.mjs';

const git = (args, cwd) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

function makeRemote() {
  const dir = mkdtempSync(join(tmpdir(), 'pub-test-'));
  const remote = join(dir, 'remote.git');
  const work = join(dir, 'work');
  git(['init', '--bare', '-b', 'main', remote], dir);
  git(['clone', remote, work], dir);
  git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-q', '-m', 'init'], work);
  git(['push', '-q', 'origin', 'main'], work);
  // fake dist builds
  mkdirSync(join(work, 'dist/apps/web/browser'), { recursive: true });
  mkdirSync(join(work, 'dist/apps/site/browser'), { recursive: true });
  writeFileSync(join(work, 'dist/apps/web/browser/index.html'), '<h1>web</h1>');
  writeFileSync(join(work, 'dist/apps/site/browser/index.html'), '<h1>site</h1>');
  return { dir, remote, work };
}

function runIn(work, extraEnv = {}) {
  const prevCwd = process.cwd();
  const prevEnv = { ...process.env };
  process.chdir(work);
  Object.assign(process.env, extraEnv);
  try { return run(); } finally { process.chdir(prevCwd); process.env = prevEnv; }
}

test('publish creates the deploy branch, then skips when dists are unchanged', async () => {
  const { dir, remote, work } = makeRemote();
  try {
    const first = runIn(work);
    assert.equal(first.pushed, true);
    assert.deepEqual(first.apps, ['web', 'site'], 'mobile absent: not published');
    // branch exists on the remote with the expected layout
    const files = git(['ls-tree', '-r', '--name-only', 'origin/deploy'], work).split('\n').sort();
    assert.ok(files.includes('web/index.html'));
    assert.ok(files.includes('site/index.html'));
    assert.ok(files.includes('SOURCE.txt'));
    const source = git(['show', 'origin/deploy:SOURCE.txt'], work);
    assert.match(source, /apps: web, site/);

    // second run, dists unchanged -> no new commit
    const before = git(['rev-parse', 'origin/deploy'], work);
    const second = runIn(work);
    assert.equal(second.pushed, false);
    assert.equal(git(['rev-parse', 'origin/deploy'], work), before, 'no commit when unchanged');

    // change a dist -> new commit
    writeFileSync(join(work, 'dist/apps/web/browser/index.html'), '<h1>web v2</h1>');
    const third = runIn(work);
    assert.equal(third.pushed, true);
    assert.match(git(['show', 'origin/deploy:web/index.html'], work), /v2/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('publish fails cleanly when no dist exists', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pub-empty-'));
  git(['init', '-q', dir], dir);
  try {
    assert.throws(() => runIn(dir), /aucun dist/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
