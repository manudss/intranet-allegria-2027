#!/usr/bin/env node
// Fail closed before any Neon password rotation or legacy Render operation for routed PR42.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export function isLyamPreview(number, labels) {
  return (
    Number(number) === 42 &&
    labels.some(
      (label) => (typeof label === 'string' ? label : label.name) === 'deploy-preview-lyam',
    )
  );
}
export async function guard(e, event, fetcher = fetch) {
  const number = Number(
    event.issue?.number ?? event.pull_request?.number ?? event.number ?? event.inputs?.pr,
  );
  if (number !== 42) return;
  if (e.GITHUB_REPOSITORY !== 'manudss/intranet-allegria-2027' || !e.GITHUB_TOKEN)
    throw new Error('PR42 routing check unavailable; no legacy preview action allowed');
  const r = await fetcher('https://api.github.com/repos/manudss/intranet-allegria-2027/issues/42', {
    headers: { Authorization: `Bearer ${e.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  if (!r.ok)
    throw new Error(`PR42 routing check HTTP${r.status}; no legacy preview action allowed`);
  const current = await r.json();
  if (isLyamPreview(number, current.labels ?? []))
    throw new Error(
      'PR42 uses the Lyam account. Use deploy-preview-lyam, not /preview, legacy manual dispatch or reseed-preview. No Neon credentials or services were changed.',
    );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await guard(process.env, JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')));
