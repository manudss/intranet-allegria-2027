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
  // Mode « image seulement » (commit marque [preview-image-only]) : jamais de creation de service,
  // seulement le redeploiement d'un service gratuit existant avec une nouvelle image, sans migration ni seed.
  if (e.PREVIEW_IMAGE_ONLY === 'true' && !service)
    throw new Error('image-only mode needs an existing preview service');
  const env = [
    { key: 'DATABASE_URL', value: e.PREVIEW_DB_URL },
    { key: 'DATABASE_URL_DIRECT', value: e.PREVIEW_DB_URL_DIRECT },
    { key: 'DB_SSL', value: 'true' },
    { key: 'PREVIEW_DEPLOYMENT', value: 'true' },
    // Phase de creation de l'interface (decision d'Emmanuel du 24 nov. 2026, message WhatsApp de 21h11) :
    // sur cette preview jetable, le mode demonstration (famille fictive, sante numerique de demonstration,
    // exemples visibles du personnel) est ouvert pour pouvoir tester, donnees FICTIVES uniquement. Cle de
    // chiffrement, journal des lectures, roles et mails limites a l'adresse du proprietaire restent actifs.
    // Le code API refuse ces options hors du service exact de la PR49 ; rien n'est pose en production.
    ...(e.PR_NUMBER === '49'
      ? [
          { key: 'FAMILY_PREVIEW_DEMO_ENABLED', value: 'pr49-fictional-only' },
          { key: 'FAMILY_PREVIEW_IMAGE_ENABLED', value: 'pr49-prebuilt-only' },
          { key: 'FAMILY_PREVIEW_HEALTH_ENABLED', value: 'fictional-health-only' },
          { key: 'FAMILY_PREVIEW_MAIL_ENABLED', value: 'owner-only-test' },
          { key: 'FAMILY_PREVIEW_MAIL_TO', value: 'emmanueldesaintsteban@gmail.com' },
        ]
      : []),
  ];
  // Mail (Resend, sender alegria@dss.name) only when the repo secret exists, and ALWAYS locked to the
  // owner's own address: the API refuses every other recipient before any provider call.
  if (e.FAMILY_RESEND_API_KEY) {
    env.push(
      { key: 'FAMILY_MAIL_PROVIDER', value: 'resend' },
      { key: 'FAMILY_MAIL_FROM', value: 'alegria@dss.name' },
      { key: 'FAMILY_RESEND_API_KEY', value: e.FAMILY_RESEND_API_KEY },
      { key: 'MAIL_ALLOWED_RECIPIENTS', value: 'emmanueldesaintsteban@gmail.com' },
    );
  }
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
    // Retire les variables d'attestation posees par un essai precedent (le mode demonstration les remplace).
    for (const key of ['FAMILY_HEALTH_APPROVAL_REFERENCE', 'FAMILY_HEALTH_DECLARATION_VERSION', 'FAMILY_HEALTH_DECLARATION_TEXT'])
      if (current.some((x) => (x.envVar ?? x).key === key))
        await api('DELETE', `/services/${service.id}/env-vars/${key}`);
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
  const base = service.serviceDetails.url.replace(/\/+$/, '');
  const body = [
    `Preview PR${e.PR_NUMBER}, deuxieme compte Render, service image gratuit (zero minute de build Render).`,
    '',
    `- Intranet : ${base}/`,
    `- Site public : ${base}/site/`,
    `- Appli mobile : ${base}/m/`,
    `- API : ${base}/api (Swagger : ${base}/api/docs)`,
    '',
    'Plan gratuit : le service s\'endort apres environ 15 minutes sans visite, la premiere page peut prendre une a deux minutes a se reveler. Le site public est servi en mode statique (pas de rendu serveur). Donnees fictives uniquement ; les mails (si configures) ne partent que vers l\'adresse du proprietaire.',
  ].join('\n');
  if (e.GITHUB_STEP_SUMMARY) appendFileSync(e.GITHUB_STEP_SUMMARY, `${body}\n`);
  if (e.GITHUB_OUTPUT) appendFileSync(e.GITHUB_OUTPUT, `comment<<EOF_PREVIEW\n${body}\nEOF_PREVIEW\n`);
  return service;
}
if (process.argv[1]?.endsWith('/render-pr-lyam.mjs')) await deploy(process.env);
