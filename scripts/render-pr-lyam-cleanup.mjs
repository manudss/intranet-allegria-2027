#!/usr/bin/env node
// Delete the free image preview of a closed internal PR on the second Render account.
// Refuses anything that is not exactly al-pr<N>-api, free, image runtime, in that account.
import { pathToFileURL } from 'node:url';
const OWNER = 'tea-dbppb5d9fdbs73f1fqf0';
export async function cleanup(e, fetcher = fetch) {
  if (
    e.GITHUB_REPOSITORY !== 'manudss/intranet-allegria-2027' ||
    !/^[1-9][0-9]{0,5}$/.test(e.PR_NUMBER ?? '') ||
    e.PR_NUMBER === '42' ||
    !e.RENDER_LYAM_PREVIEW_API_KEY
  )
    throw new Error('cleanup refused');
  const name = `al-pr${e.PR_NUMBER}-api`;
  const call = async (method, path) => {
    const r = await fetcher(`https://api.render.com/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${e.RENDER_LYAM_PREVIEW_API_KEY}` },
    });
    if (!r.ok) throw new Error(`preview cleanup HTTP ${r.status}`);
    return r.status === 204 ? null : r.json();
  };
  const all = (await call('GET', `/services?name=${encodeURIComponent(name)}&limit=20`)).map(
    (x) => x.service ?? x,
  );
  const s = all.find((x) => x.name === name && x.ownerId === OWNER);
  if (!s) return { deleted: false, reason: 'already absent' };
  if (s.serviceDetails?.runtime !== 'image' || s.serviceDetails?.plan !== 'free')
    throw new Error('preview identity mismatch, nothing deleted');
  await call('DELETE', `/services/${s.id}`);
  console.log(`Deleted only the verified free image preview ${name}.`);
  return { deleted: true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await cleanup(process.env);
