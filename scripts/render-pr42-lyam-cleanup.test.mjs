import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanup } from './render-pr42-lyam-cleanup.mjs';
const e = {
  GITHUB_REPOSITORY: 'manudss/intranet-allegria-2027',
  RENDER_LYAM_PREVIEW_API_KEY: 'fiction',
};
const event = {
  action: 'closed',
  number: 42,
  pull_request: {
    head: { ref: 'feat/family-registration', repo: { full_name: e.GITHUB_REPOSITORY } },
  },
};
test('open PR, another PR and foreign repository never call Render', async () => {
  for (const patch of [
    { action: 'labeled' },
    { number: 43 },
    { pull_request: { head: { repo: { full_name: 'other' } } } },
  ])
    await assert.rejects(
      cleanup(e, { ...event, ...patch }, async () => {
        throw new Error('must not call');
      }),
      /cleanup refused/,
    );
});
test('closed PR42 deletes only exact preview ID, no Neon or demo calls', async () => {
  const methods = [];
  const r = await cleanup(e, event, async (url, options) => {
    assert.equal(url, 'https://api.render.com/v1/services/srv-dc06l5mc6qcc73b9ar00');
    methods.push(options.method);
    return {
      ok: true,
      status: options.method === 'DELETE' ? 204 : 200,
      json: async () => ({
        id: 'srv-dc06l5mc6qcc73b9ar00',
        ownerId: 'tea-dbppb5d9fdbs73f1fqf0',
        name: 'al-pr42-api',
        serviceDetails: { runtime: 'image', plan: 'free' },
      }),
    };
  });
  assert.deepEqual(methods, ['GET', 'DELETE']);
  assert.equal(r.deleted, true);
});
test('wrong account or changed service fails closed before deletion', async () => {
  const methods = [];
  await assert.rejects(
    cleanup(e, event, async (url, options) => {
      methods.push(options.method);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'srv-dc06l5mc6qcc73b9ar00', ownerId: 'wrong' }),
      };
    }),
    /identity mismatch/,
  );
  assert.deepEqual(methods, ['GET']);
});
