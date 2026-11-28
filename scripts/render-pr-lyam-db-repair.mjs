#!/usr/bin/env node
// Targeted repair of the database credentials of ONE free image preview on the second Render account.
// It only rewrites DATABASE_URL and DATABASE_URL_DIRECT of the service al-pr<N>-api and redeploys the image
// that service already runs. No migration, no seed, no image build, no other variable, no other service.
// The connection strings come from the previous workflow step as masked step outputs; they are never printed.
import { OWNER, nameFor } from './render-pr-lyam.mjs';
export function assertRepairInputs(e) {
  if (e.GITHUB_REPOSITORY !== 'manudss/intranet-allegria-2027') throw new Error('repository refused');
  if (!/^[1-9][0-9]{0,5}$/.test(e.PR_NUMBER ?? '') || e.PR_NUMBER === '42')
    throw new Error('PR number refused');
  if (e.PREVIEW_HEAD_REPO !== e.GITHUB_REPOSITORY) throw new Error('fork PR refused');
  if (!e.RENDER_LYAM_PREVIEW_API_KEY || !e.PREVIEW_DB_URL || !e.PREVIEW_DB_URL_DIRECT)
    throw new Error('dedicated preview credentials missing');
}
export async function repair(e, fetcher = fetch) {
  assertRepairInputs(e);
  const api = async (method, path, body) => {
    const r = await fetcher(`https://api.render.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${e.RENDER_LYAM_PREVIEW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(`Render ${method} ${path.split('?')[0]}: HTTP ${r.status}`);
    return r.status === 204 ? {} : r.json();
  };
  const owners = await api('GET', '/owners');
  if (!owners.some((x) => (x.owner ?? x).id === OWNER)) throw new Error('wrong Render account');
  const all = (await api('GET', '/services?limit=100')).map((x) => x.service ?? x);
  const service = all.find((x) => x.name === nameFor(e.PR_NUMBER) && x.ownerId === OWNER);
  if (!service) throw new Error('preview service not found, nothing to repair');
  if (service.serviceDetails?.plan !== 'free' || service.serviceDetails?.runtime !== 'image')
    throw new Error('existing service is not the dedicated free image preview');
  await api('PUT', `/services/${service.id}/env-vars/DATABASE_URL`, { value: e.PREVIEW_DB_URL });
  await api('PUT', `/services/${service.id}/env-vars/DATABASE_URL_DIRECT`, { value: e.PREVIEW_DB_URL_DIRECT });
  // No imageUrl: Render redeploys the image the service already runs.
  await api('POST', `/services/${service.id}/deploys`, { clearCache: 'do_not_clear' });
  console.log(JSON.stringify({ repaired: true, serviceId: service.id, url: service.serviceDetails?.url }));
  return service;
}
if (process.argv[1]?.endsWith('/render-pr-lyam-db-repair.mjs')) await repair(process.env);
