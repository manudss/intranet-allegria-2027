#!/usr/bin/env node
// Trusted workflow only. Gives a PR Neon branch its OWN password for the owner role, so the
// connection string handed to the PR preview is not the production password inherited through
// preview/main. Roles are per branch in Neon: the reset only affects the given branch.
// Env: NEON_API_KEY, NEON_PROJECT_ID, NEON_BRANCH_ID, NEON_DB_URL, NEON_DB_URL_DIRECT (from create-branch-action).
// Prints GitHub step outputs db_url / db_url_pooled with the new password (masked in logs).
import { appendFileSync } from 'node:fs';
const e = process.env;
for (const k of ['NEON_API_KEY', 'NEON_PROJECT_ID', 'NEON_BRANCH_ID', 'NEON_DB_URL', 'NEON_DB_URL_DIRECT'])
  if (!e[k]) throw new Error(`${k} missing`);
if (!/^br-[a-z0-9-]+$/.test(e.NEON_BRANCH_ID)) throw new Error('branch id rejected');
const u = new URL(e.NEON_DB_URL_DIRECT);
const role = decodeURIComponent(u.username);
// Right after branch creation Neon answers 423 (operations in progress): retry for up to ~2 min.
let res;
for (let i = 0; i < 24; i++) {
  res = await fetch(
    `https://console.neon.tech/api/v2/projects/${encodeURIComponent(e.NEON_PROJECT_ID)}/branches/${e.NEON_BRANCH_ID}/roles/${encodeURIComponent(role)}/reset_password`,
    { method: 'POST', headers: { Authorization: `Bearer ${e.NEON_API_KEY}`, Accept: 'application/json' } },
  );
  if (res.status !== 423 && res.status !== 409) break;
  await new Promise((r) => setTimeout(r, 5000));
}
if (!res.ok) throw new Error(`reset_password failed: ${res.status}`);
const password = (await res.json()).role?.password;
if (!password) throw new Error('no password returned');
console.log(`::add-mask::${password}`);
const withPw = (raw) => { const x = new URL(raw); x.password = password; return x.toString(); };
appendFileSync(e.GITHUB_OUTPUT, `db_url=${withPw(e.NEON_DB_URL_DIRECT)}\ndb_url_pooled=${withPw(e.NEON_DB_URL)}\n`);
