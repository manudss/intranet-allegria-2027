#!/usr/bin/env node
// Cleanup only the verified disposable PR42 preview in the second Render account.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const ID = 'srv-dc06l5mc6qcc73b9ar00';
const OWNER = 'tea-dbppb5d9fdbs73f1fqf0';
export async function cleanup(e, event, fetcher = fetch) {
  if (
    e.GITHUB_REPOSITORY !== 'manudss/intranet-allegria-2027' ||
    event.action !== 'closed' ||
    event.number !== 42 ||
    event.pull_request?.head?.repo?.full_name !== e.GITHUB_REPOSITORY ||
    event.pull_request?.head?.ref !== 'feat/family-registration' ||
    !e.RENDER_LYAM_PREVIEW_API_KEY
  )
    throw new Error('cleanup refused outside closed internal PR42');
  const call = async (method) => {
    const r = await fetcher(`https://api.render.com/v1/services/${ID}`, {
      method,
      headers: { Authorization: `Bearer ${e.RENDER_LYAM_PREVIEW_API_KEY}` },
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`preview cleanup HTTP${r.status}`);
    return r.status === 204 ? null : r.json();
  };
  const s = await call('GET');
  if (!s) return { deleted: false, reason: 'already absent' };
  if (
    s.id !== ID ||
    s.ownerId !== OWNER ||
    s.name !== 'al-pr42-api' ||
    s.serviceDetails?.runtime !== 'image' ||
    s.serviceDetails?.plan !== 'free'
  )
    throw new Error('preview identity mismatch, nothing deleted');
  await call('DELETE');
  console.log(
    'Deleted only the verified PR42 Lyam preview service. Existing Neon lifecycle and Lyam demos unchanged.',
  );
  return { deleted: true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await cleanup(process.env, JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')));
