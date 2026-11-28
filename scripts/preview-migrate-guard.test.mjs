import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMigrateOnly } from './preview-migrate-guard.mjs';
const ok = { PR_NUMBER: '58', EVENT_NAME: 'pull_request', EVENT_ACTION: 'synchronize', COMMIT_MESSAGE: 'x [preview-migrate-only]', BRANCH_NAME: 'preview/pr-58', IMAGE_ONLY: 'true', SEED: 'false' };
test('autorise le cas nominal', () => assert.deepEqual(checkMigrateOnly(ok), []));
test('refuse sans marqueur', () => assert.ok(checkMigrateOnly({ ...ok, COMMIT_MESSAGE: 'x' }).length));
test('refuse une base qui n est pas la preview de la PR', () => {
  assert.ok(checkMigrateOnly({ ...ok, BRANCH_NAME: 'main' }).length);
  assert.ok(checkMigrateOnly({ ...ok, BRANCH_NAME: 'preview/pr-59' }).length);
  assert.ok(checkMigrateOnly({ ...ok, BRANCH_NAME: 'preview/main' }).length);
});
test('refuse PR 42, evenement manuel, seed, hors image seule', () => {
  assert.ok(checkMigrateOnly({ ...ok, PR_NUMBER: '42', BRANCH_NAME: 'preview/pr-42' }).length);
  assert.ok(checkMigrateOnly({ ...ok, EVENT_NAME: 'workflow_dispatch' }).length);
  assert.ok(checkMigrateOnly({ ...ok, SEED: 'true' }).length);
  assert.ok(checkMigrateOnly({ ...ok, IMAGE_ONLY: 'false' }).length);
});
