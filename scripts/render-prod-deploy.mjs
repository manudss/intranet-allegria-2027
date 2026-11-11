#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
// Declenche le deploy Render du service API de production (intranet-allegria-2027,
// alegria.dss.name) apres que le workflow "Prod image (GHCR)" a pousse l'image
// d'un push sur main. Render ne fait QUE tirer l'image : zero minute de build.
//
// GARDE-FOU : ce script ne lance jamais un build Docker sur Render. Il lit le
// service et REFUSE de deployer tant qu'il est git-backed (un deploy alors
// builderait depuis les sources et consommerait les minutes du workspace).
// La bascule git-backed -> image-backed est une action manuelle UNIQUE dans le
// dashboard Render (docs/deploiement.md) ; tant qu'elle n'est pas faite, le
// script termine vert avec un message "skipped".
//
// Quand le service EST image-backed :
//   1. POST /services/{id}/deploys (Render retire le tag ghcr ...:latest,
//      reconstruit a chaque push sur main).
//   2. Surveille le deploy jusqu'a un statut final ; sortie non nulle sur echec
//      ou timeout pour que le run Actions passe au rouge.
// Aucun secret n'est affiche : RENDER_API_KEY reste dans les secrets GitHub, les
// env vars du service (DATABASE_URL, ...) ne sont jamais lues.
// Usage : node scripts/render-prod-deploy.mjs
// Env : RENDER_API_KEY, PROD_SERVICE_NAME (defaut intranet-allegria-2027),
//       PROD_POLL_MS / PROD_WAIT_MAX_MS (surveillance), DRY_RUN=1 pour le plan.
const e = process.env;
const DRY = e.DRY_RUN === '1';
if (!DRY && !e.RENDER_API_KEY) throw new Error('RENDER_API_KEY missing');

const RENDER = 'https://api.render.com/v1';
const SVC_NAME = e.PROD_SERVICE_NAME ?? 'intranet-allegria-2027';
const POLL_MS = Number(e.PROD_POLL_MS ?? 20000);
const WAIT_MAX_MS = Number(e.PROD_WAIT_MAX_MS ?? 15 * 60 * 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FINAL_DEPLOY = new Set(['live', 'build_failed', 'update_failed', 'canceled', 'deactivated']);

async function render(method, path, body) {
  if (DRY) { console.log('[dry]', method, path, body ? JSON.stringify(body) : ''); return {}; }
  const res = await fetch(RENDER + path, {
    method,
    headers: { Authorization: `Bearer ${e.RENDER_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}
async function findService(svcName) {
  if (DRY) return { id: 'srv-dry', name: svcName, serviceDetails: { runtime: 'image' } };
  const list = await render('GET', `/services?name=${encodeURIComponent(svcName)}&limit=5`);
  const hit = (Array.isArray(list) ? list : []).map((x) => x.service ?? x).find((s) => s.name === svcName);
  return hit ?? null;
}
async function latestDeploy(svcId) {
  const list = await render('GET', `/services/${svcId}/deploys?limit=1`);
  return (Array.isArray(list) ? list : []).map((x) => x.deploy ?? x)[0] ?? null;
}
function isImageBacked(s) {
  const details = s?.serviceDetails ?? {};
  return details.runtime === 'image' || Boolean(s?.image?.imagePath);
}

// Deploye et surveille. Retourne { deployed, reason } ; leve une erreur sur un
// deploy ECHOUE ou un timeout (le run Actions doit passer au rouge), jamais sur
// le skip git-backed.
async function run() {
  const s = await findService(SVC_NAME);
  if (!s) throw new Error(`service ${SVC_NAME} introuvable sur Render`);
  if (!isImageBacked(s)) {
    console.log(`skipped: ${SVC_NAME} est encore git-backed - bascule image manuelle d'abord (docs/deploiement.md). Aucun deploy lance, aucun build Render consomme.`);
    return { deployed: false, reason: 'git-backed' };
  }
  const res = await render('POST', `/services/${s.id}/deploys`, { clearCache: 'do_not_clear' });
  const dep = res?.deploy ?? res;
  console.log(`deploy ${dep?.id ?? '(dry)'} lance sur ${SVC_NAME} (${s.id}) : Render telecharge l'image GHCR, aucun build.`);
  const deadline = Date.now() + WAIT_MAX_MS;
  while (Date.now() < deadline) {
    if (DRY) return { deployed: true, reason: 'dry' };
    const d = await latestDeploy(s.id);
    const status = d?.status ?? 'unknown';
    console.log(`deploy ${d?.id ?? '?'}: ${status}`);
    if (FINAL_DEPLOY.has(status)) {
      if (status === 'live') return { deployed: true, reason: 'live' };
      throw new Error(`deploy termine en echec: ${status}`);
    }
    await sleep(POLL_MS);
  }
  throw new Error(`timeout: le deploy de ${SVC_NAME} n'est pas live apres ${WAIT_MAX_MS / 60000} min`);
}

export { run, findService, isImageBacked };

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) await run();
