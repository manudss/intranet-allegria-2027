#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
// Declenche le deploy Render des static sites de production (front admin, site
// public, mobile quand il existera) APRES publication des dist sur la branche
// `deploy` (scripts/publish-static-dist.mjs). Render ne fait que copier les
// fichiers sur son CDN : zero minute de pipeline.
//
// GARDE-FOU : un static site ne doit etre deploye par ce script QUE s'il suit
// deja la branche `deploy` avec une commande de build vide. Sinon (service
// encore branche sur main avec un vrai build), le script le LAISSE en place et
// l'indique : la bascule est une action manuelle unique dans le dashboard
// (docs/deploiement.md). Aucune minute de build n'est ainsi consommee par
// erreur. Un service absent (mobile pas encore cree) est simplement signale.
//
// Usage : node scripts/render-static-deploy.mjs
// Env : RENDER_API_KEY,
//       STATIC_SERVICES (defaut "intranet-allegria-2027-1,allegria-2027,allegria-mobile"),
//       DEPLOY_BRANCH (defaut "deploy"),
//       PROD_POLL_MS / PROD_WAIT_MAX_MS, DRY_RUN=1.
const e = process.env;
const DRY = e.DRY_RUN === '1';
if (!DRY && !e.RENDER_API_KEY) throw new Error('RENDER_API_KEY missing');

const RENDER = 'https://api.render.com/v1';
const BRANCH = e.DEPLOY_BRANCH ?? 'deploy';
const SERVICES = (e.STATIC_SERVICES ?? 'intranet-allegria-2027-1,allegria-2027,allegria-mobile')
  .split(',').map((s) => s.trim()).filter(Boolean);
const POLL_MS = Number(e.PROD_POLL_MS ?? 15000);
const WAIT_MAX_MS = Number(e.PROD_WAIT_MAX_MS ?? 10 * 60 * 1000);
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
  if (DRY) return { id: `srv-dry-${svcName}`, name: svcName, branch: BRANCH, serviceDetails: { buildCommand: '', publishPath: 'web' } };
  const list = await render('GET', `/services?name=${encodeURIComponent(svcName)}&limit=5`);
  const hit = (Array.isArray(list) ? list : []).map((x) => x.service ?? x).find((s) => s.name === svcName);
  return hit ?? null;
}
async function latestDeploy(svcId) {
  const list = await render('GET', `/services/${svcId}/deploys?limit=1`);
  return (Array.isArray(list) ? list : []).map((x) => x.deploy ?? x)[0] ?? null;
}

// Un service est pret pour le mode "copie de dist" s'il suit la branche deploy
// avec une commande de build vide (les espaces comptent comme vide).
function isDistBacked(s) {
  const branch = s?.branch ?? s?.serviceDetails?.branch ?? '';
  const buildCommand = (s?.serviceDetails?.buildCommand ?? '').trim();
  return branch === BRANCH && buildCommand === '';
}

async function deployOne(svcName) {
  const s = await findService(svcName);
  if (!s) {
    console.log(`skip ${svcName}: service absent (pas encore cree, ex. mobile) - rien a faire.`);
    return { name: svcName, deployed: false, reason: 'missing' };
  }
  if (!isDistBacked(s)) {
    console.log(`skip ${svcName}: pas encore bascule sur la branche ${BRANCH} avec build vide (docs/deploiement.md). Aucun deploy lance, aucune minute consommee.`);
    return { name: svcName, deployed: false, reason: 'not-switched' };
  }
  const res = await render('POST', `/services/${s.id}/deploys`, { clearCache: 'do_not_clear' });
  const dep = res?.deploy ?? res;
  console.log(`deploy ${dep?.id ?? '(dry)'} lance sur ${svcName} (${s.id}) : simple copie CDN.`);
  const deadline = Date.now() + WAIT_MAX_MS;
  while (Date.now() < deadline) {
    if (DRY) return { name: svcName, deployed: true, reason: 'dry' };
    const d = await latestDeploy(s.id);
    const status = d?.status ?? 'unknown';
    console.log(`${svcName}: ${status}`);
    if (FINAL_DEPLOY.has(status)) {
      if (status === 'live') return { name: svcName, deployed: true, reason: 'live' };
      throw new Error(`${svcName}: deploy termine en echec: ${status}`);
    }
    await sleep(POLL_MS);
  }
  throw new Error(`timeout: le deploy de ${svcName} n'est pas live apres ${WAIT_MAX_MS / 60000} min`);
}

async function run() {
  const results = [];
  for (const name of SERVICES) results.push(await deployOne(name));
  return results;
}

export { run, deployOne, isDistBacked };

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) await run();
