// Read the existing PR42 Neon database only. No branch creation, reset, seed or password rotation.
import { appendFileSync } from 'node:fs';
const e = process.env;
if (!e.NEON_API_KEY || !e.NEON_PROJECT_ID || !e.GITHUB_OUTPUT)
  throw new Error('Neon preview config missing');
const base = `https://console.neon.tech/api/v2/projects/${encodeURIComponent(e.NEON_PROJECT_ID)}`;
const get = async (path) => {
  const r = await fetch(base + path, { headers: { Authorization: `Bearer ${e.NEON_API_KEY}` } });
  if (!r.ok) throw new Error(`Neon read HTTP ${r.status}`);
  return r.json();
};
const { branches } = await get('/branches');
const branch = branches.find((x) => x.name === 'preview/pr-42');
if (!branch || branch.default || !/^br-[a-z0-9-]+$/.test(branch.id))
  throw new Error('Existing PR42 branch not found or unsafe');
const { databases } = await get(`/branches/${branch.id}/databases`);
const database = databases.find((x) => x.name === 'neondb');
if (!database?.owner_name) throw new Error('Expected preview database and owner not found');
const query = new URLSearchParams({
  branch_id: branch.id,
  database_name: database.name,
  role_name: database.owner_name,
});
for (const [output, pooled] of [
  ['db_url', false],
  ['db_url_pooled', true],
]) {
  query.set('pooled', String(pooled));
  const { uri } = await get(`/connection_uri?${query}`);
  if (!uri?.startsWith('postgres')) throw new Error('No current preview connection URI');
  console.log(`::add-mask::${uri}`);
  const u = new URL(uri);
  console.log(`::add-mask::${decodeURIComponent(u.password)}`);
  appendFileSync(e.GITHUB_OUTPUT, `${output}=${uri}\n`);
}
console.log(`Existing Neon PR42 branch verified: ${branch.id}; no DB mutation.`);
