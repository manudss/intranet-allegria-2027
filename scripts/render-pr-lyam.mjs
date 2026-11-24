#!/usr/bin/env node
// Disposable free image preview of an internal PR on the SECOND Render account (the one Emmanuel
// chose on 20 Nov 2026 for previews). Never uses the production Render key, never builds on Render.
import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';
export const OWNER = 'tea-dbppb5d9fdbs73f1fqf0';
export const nameFor = (pr) => `al-pr${pr}-api`;
export function assertInputs(e) {
  if (e.GITHUB_REPOSITORY !== 'manudss/intranet-allegria-2027') throw new Error('repository refused');
  if (!/^[1-9][0-9]{0,5}$/.test(e.PR_NUMBER ?? '') || e.PR_NUMBER === '42')
    throw new Error('PR number refused');
  if (e.PREVIEW_HEAD_REPO !== e.GITHUB_REPOSITORY) throw new Error('fork PR refused');
  if (
    !/^ghcr\.io\/manudss\/intranet-allegria-2027@sha256:[a-f0-9]{64}$/.test(e.PREVIEW_IMAGE ?? '')
  )
    throw new Error('immutable image digest required');
  if (!e.RENDER_LYAM_PREVIEW_API_KEY || !e.PREVIEW_DB_URL || !e.PREVIEW_DB_URL_DIRECT)
    throw new Error('dedicated preview credentials missing');
}
export async function deploy(e, fetcher = fetch) {
  assertInputs(e);
  const NAME = nameFor(e.PR_NUMBER);
  const api = async (method, path, body) => {
    const r = await fetcher(`https://api.render.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${e.RENDER_LYAM_PREVIEW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok)
      throw new Error(
        `Render ${method} ${path.split('?')[0]}: HTTP ${r.status}. No paid fallback.`,
      );
    return r.status === 204 ? {} : r.json();
  };
  const owners = await api('GET', '/owners');
  if (!owners.some((x) => (x.owner ?? x).id === OWNER)) throw new Error('wrong Render account');
  const all = (await api('GET', '/services?limit=100')).map((x) => x.service ?? x);
  const demo = all.find(
    (x) =>
      x.name === 'iam-demo-apps' &&
      x.ownerId === OWNER &&
      x.repo === 'https://github.com/manudss/iam-demo-apps',
  );
  if (!demo) throw new Error('expected Lyam demo account not found');
  let service = all.find((x) => x.name === NAME && x.ownerId === OWNER);
  if (
    service &&
    (service.serviceDetails?.plan !== 'free' || service.serviceDetails?.runtime !== 'image')
  )
    throw new Error('existing service is not the dedicated free image preview');
  const env = [
    { key: 'DATABASE_URL', value: e.PREVIEW_DB_URL },
    { key: 'DATABASE_URL_DIRECT', value: e.PREVIEW_DB_URL_DIRECT },
    { key: 'DB_SSL', value: 'true' },
  ];
  if (!service) {
    const response = await api('POST', '/services', {
      type: 'web_service',
      name: NAME,
      ownerId: OWNER,
      autoDeployTrigger: 'off',
      image: { ownerId: OWNER, imagePath: e.PREVIEW_IMAGE },
      envVars: [
        ...env,
        { key: 'FAMILY_HEALTH_ENCRYPTION_KEY', value: randomBytes(32).toString('base64') },
        { key: 'JWT_SECRET', value: randomBytes(48).toString('hex') },
      ],
      serviceDetails: {
        runtime: 'image',
        plan: 'free',
        region: 'frankfurt',
        healthCheckPath: '/health',
        envSpecificDetails: {},
      },
    });
    service = response.service ?? response;
  } else {
    const current = await api('GET', `/services/${service.id}/env-vars`);
    if (!current.some((x) => (x.envVar ?? x).key === 'FAMILY_HEALTH_ENCRYPTION_KEY'))
      await api('PUT', `/services/${service.id}/env-vars/FAMILY_HEALTH_ENCRYPTION_KEY`, {
        value: randomBytes(32).toString('base64'),
      });
    for (const { key, value } of env)
      await api('PUT', `/services/${service.id}/env-vars/${key}`, { value });
    // Changing the immutable image requires an explicit deployment, never a source build.
    await api('POST', `/services/${service.id}/deploys`, {
      imageUrl: e.PREVIEW_IMAGE,
      clearCache: 'do_not_clear',
    });
  }
  if (!service.id || !service.serviceDetails?.url)
    throw new Error('Render did not return service identity and URL');
  console.log(
    JSON.stringify({
      serviceId: service.id,
      url: service.serviceDetails.url,
      dashboardUrl: service.dashboardUrl,
      image: e.PREVIEW_IMAGE,
    }),
  );
  if (e.GITHUB_STEP_SUMMARY)
    appendFileSync(
      e.GITHUB_STEP_SUMMARY,
      `Preview PR${e.PR_NUMBER}, second Render account, free image service (API + intranet, no public site)\n\n${service.serviceDetails.url}\n\nRender deployment must be confirmed live before testing. Mail key must be configured separately; no mail is sent by this workflow.\n`,
    );
  return service;
}
if (process.argv[1]?.endsWith('/render-pr-lyam.mjs')) await deploy(process.env);
