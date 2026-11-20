import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guard, isLyamPreview } from './guard-pr42-preview-route.mjs';
import { readFileSync } from 'node:fs';
const e = { GITHUB_REPOSITORY: 'manudss/intranet-allegria-2027', GITHUB_TOKEN: 'fiction' };
const routed = async () => ({
  ok: true,
  json: async () => ({ labels: [{ name: 'deploy-preview-lyam' }] }),
});
test('only PR42 with the exact routing label matches', () => {
  assert.equal(isLyamPreview(42, [{ name: 'deploy-preview-lyam' }]), true);
  assert.equal(isLyamPreview(43, ['deploy-preview-lyam']), false);
  assert.equal(isLyamPreview(42, ['other']), false);
});
test('comment, manual dispatch and PR42 events stop before any legacy operation', async () => {
  for (const event of [
    { issue: { number: 42 } },
    { inputs: { pr: '42' } },
    { number: 42, pull_request: { number: 42 } },
  ])
    await assert.rejects(guard(e, event, routed), /uses the Lyam account/);
});
test('other PRs never query GitHub; unlabelled PR42 remains unchanged', async () => {
  await guard(e, { issue: { number: 43 } }, async () => {
    throw Error('unexpected fetch');
  });
  await guard(e, { inputs: { pr: 42 } }, async () => ({
    ok: true,
    json: async () => ({ labels: [] }),
  }));
});
test('PR42 status failure stops rather than guessing', async () => {
  await assert.rejects(
    guard(e, { inputs: { pr: 42 } }, async () => ({ ok: false, status: 503 })),
    /routing check HTTP503/,
  );
  await assert.rejects(
    guard({ ...e, GITHUB_TOKEN: '' }, { inputs: { pr: 42 } }, routed),
    /unavailable/,
  );
});
test('workflow guards precede Neon, reseed skips routed PR42, close uses trusted main', () => {
  const s = readFileSync(new URL('../.github/workflows/pr-previews.yml', import.meta.url), 'utf8');
  for (const job of ['refresh-comment', 'refresh-manual']) {
    const j = s.split(`  ${job}:`)[1].split(/\n  [a-z][a-z-]+:/)[0];
    assert.ok(
      j.indexOf('guard-pr42-preview-route.mjs') < j.indexOf('neondatabase/create-branch-action'),
    );
    assert.ok(j.includes('guard-pr42-preview-route.mjs'));
  }
  const reseed = readFileSync(
    new URL('../.github/workflows/pr-preview-reseed.yml', import.meta.url),
    'utf8',
  );
  assert.match(
    reseed,
    /number == 42 && contains\(github.event.pull_request.labels.\*.name, 'deploy-preview-lyam'\)/,
  );
  const cleanup = s.split('  cleanup-pr42-lyam:')[1];
  assert.match(cleanup, /ref: main/);
  assert.ok(!cleanup.includes('head.sha'));
  assert.match(cleanup, /pull_request_target/);
  assert.match(cleanup, /action == 'closed'/);
});
