// Test d'integration du placement d'hebergement (API reelle + base reelle, donnees FICTIVES du seed).
// Usage : API_URL=http://localhost:3000 node scripts/check-hosting-placement.mjs
// Ecrit puis nettoie ses propres donnees (groupe d'hebergement de test, placements de l'equipe choisie).
const base = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
let failures = 0;
const check = (label, pass, info = '') => {
  if (!pass) failures += 1;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label}${pass ? '' : ' -> ' + JSON.stringify(info)}`);
};
const call = async (method, path, body, token) => {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* corps vide */ }
  return [res.status, json];
};
const login = async (email, password) => (await call('POST', '/auth/login', { email, password }))[1]?.accessToken;
const adm = await login('admin@allegria.local', 'Admin#2027!');
const health = await login('sante@allegria.local', 'Health#2027!');
check('connexion admin et sante', Boolean(adm && health));

let [s, board] = await call('GET', '/hosting/board', undefined, adm);
check('board 200', s === 200, s);
check('donnees seed coherentes (aucun conflit)', board.conflicts.length === 0, board.conflicts.slice(0, 2));
check('board exige un token', (await call('GET', '/hosting/board'))[0] === 401);
check('role lecture seule peut lire', (await call('GET', '/hosting/board', undefined, health))[0] === 200);
check("role sante ne peut pas ecrire", (await call('POST', '/hosting/groups', { name: 'x' }, health))[0] === 403);

const STAY = { arrivalDate: '2027-10-30', departureDate: '2027-11-02' };
const RULES = { countAnimatorsInCapacity: true, sexMixing: 'ignore' };
const [, group] = await call('POST', '/hosting/groups', { name: 'Groupe test integration' }, adm);
const gid = group.id;
const team = board.teams.find((t) => t.hostingGroupId === null && t.memberCount >= 5);
const tmembers = board.members.filter((m) => m.teamId === team.id);
const fams = board.families.filter((f) => f.hostingGroupId === null && f.status === 'VALIDATED' && f.maxCapacity >= 3);
const place = (pid, fid, extra = {}) => call('POST', '/hosting/placements', { participantId: pid, hostFamilyId: fid, ...extra }, adm);

check('placer sans groupe d hebergement -> 409', (await place(tmembers[0].participantId, fams[0].id, STAY))[0] === 409);
check('affecter equipe', (await call('PUT', `/hosting/teams/${team.id}/group`, { hostingGroupId: gid }, adm))[0] === 200);
check('famille hors groupe de l equipe -> 409', (await place(tmembers[0].participantId, fams[0].id, STAY))[0] === 409);
for (const f of fams.slice(0, 3)) await call('PUT', `/hosting/families/${f.id}/group`, { hostingGroupId: gid }, adm);
check('sans dates: repli sur les dates du groupe de rassemblement', [200, 201].includes((await place(tmembers[0].participantId, fams[0].id))[0]));
check('deplacer sans replaceExisting -> 409', (await place(tmembers[0].participantId, fams[1].id, STAY))[0] === 409);
check('deplacer avec replaceExisting', [200, 201].includes((await place(tmembers[0].participantId, fams[1].id, { replaceExisting: true }))[0]));
check('retirer une famille de son groupe tant qu elle accueille -> 409', (await call('PUT', `/hosting/families/${fams[1].id}/group`, { hostingGroupId: null }, adm))[0] === 409);
check('retirer une equipe de son groupe tant que ses membres sont places -> 409', (await call('PUT', `/hosting/teams/${team.id}/group`, { hostingGroupId: null }, adm))[0] === 409);
check('supprimer un groupe ou des personnes sont placees -> 409', (await call('DELETE', `/hosting/groups/${gid}`, undefined, adm))[0] === 409);
check('retirer un placement', (await call('DELETE', `/hosting/placements/${tmembers[0].participantId}`, undefined, adm))[0] === 200);
check('retirer deux fois -> 404', (await call('DELETE', `/hosting/placements/${tmembers[0].participantId}`, undefined, adm))[0] === 404);

const target = fams[2];
const cands = tmembers.slice(0, target.maxCapacity + 4);
const codes = await Promise.all(cands.map(async (m) => (await place(m.participantId, target.id, STAY))[0]));
const okCount = codes.filter((c) => c === 200 || c === 201).length;
check('placements simultanes: jamais plus que la capacite', okCount <= target.maxCapacity, { okCount, cap: target.maxCapacity, codes });
[, board] = await call('GET', '/hosting/board', undefined, adm);
const occ = board.members.filter((m) => m.hostFamilyId === target.id).length;
check('occupation du board = placements reussis', occ === okCount, { occ, okCount });
for (const m of board.members) if (m.teamId === team.id && m.hostFamilyId) await call('DELETE', `/hosting/placements/${m.participantId}`, undefined, adm);

const [ps, preview] = await call('POST', `/hosting/groups/${gid}/auto-place`, { ...STAY, rules: RULES }, adm);
check('apercu auto: 200 et non applique', ps < 300 && preview.applied === false, ps);
[, board] = await call('GET', '/hosting/board', undefined, adm);
check("l'apercu n'ecrit rien", board.members.filter((m) => m.teamId === team.id && m.hostFamilyId).length === 0);
check('appliquer sans choisir les regles -> 400', (await call('POST', `/hosting/groups/${gid}/auto-place`, { ...STAY, apply: true }, adm))[0] === 400);
const [as, applied] = await call('POST', `/hosting/groups/${gid}/auto-place`, { ...STAY, apply: true, rules: RULES }, adm);
check("application identique a l'apercu", as < 300 && applied.applied === true && JSON.stringify(applied.proposals) === JSON.stringify(preview.proposals), as);
[, board] = await call('GET', '/hosting/board', undefined, adm);
const counts = new Map();
for (const m of board.members) if (m.hostFamilyId) counts.set(m.hostFamilyId, (counts.get(m.hostFamilyId) ?? 0) + 1);
const over = board.families.filter((f) => (counts.get(f.id) ?? 0) > f.maxCapacity);
check('aucune famille au-dessus de sa capacite (tout le board)', over.length === 0, over.slice(0, 2));
check("aucun conflit equipe/groupe/famille apres l'application", board.conflicts.length === 0, board.conflicts.slice(0, 2));
const [, again] = await call('POST', `/hosting/groups/${gid}/auto-place`, { ...STAY, apply: true, rules: RULES }, adm);
check('relancer ne replace pas les personnes deja placees', again.proposals.length === 0, again.proposals.length);
for (const m of board.members) if (m.teamId === team.id && m.hostFamilyId) await call('DELETE', `/hosting/placements/${m.participantId}`, undefined, adm);
await call('PUT', `/hosting/teams/${team.id}/group`, { hostingGroupId: null }, adm);
for (const f of fams.slice(0, 3)) await call('PUT', `/hosting/families/${f.id}/group`, { hostingGroupId: null }, adm);
await call('DELETE', `/hosting/groups/${gid}`, undefined, adm);

// ── Hebergement collectif: capacite respectee en placement manuel et automatique ──
{
  const tag2 = `C${Date.now()}`;
  const [, cg] = await call('POST', '/hosting/groups', { name: `Collectif ${tag2}`, kind: 'OTHER' }, adm);
  const [, internat] = await call('POST', '/host-families', { familyName: `Internat ${tag2}`, address: '1 rue du Test', postalCode: '69000', city: 'Lyon', maxCapacity: 3, status: 'VALIDATED', accommodationType: 'COLLECTIVE' }, adm);
  await call('PUT', `/hosting/families/${internat.id}/group`, { hostingGroupId: cg.id }, adm);
  await call('PUT', `/hosting/teams/${team.id}/group`, { hostingGroupId: cg.id }, adm);
  const codes2 = [];
  for (const m of tmembers.slice(0, 4)) codes2.push((await place(m.participantId, internat.id, STAY))[0]);
  check('collectif manuel: 3 places acceptees puis refus au-dela de la capacite', codes2.slice(0, 3).every((c) => c === 200 || c === 201) && codes2[3] === 409, codes2);
  for (const m of tmembers.slice(0, 4)) await call('DELETE', `/hosting/placements/${m.participantId}`, undefined, adm);
  const [as2, ap2] = await call('POST', `/hosting/groups/${cg.id}/auto-place`, { ...STAY, apply: true, rules: RULES }, adm);
  const [, b5] = await call('GET', '/hosting/board', undefined, adm);
  const occ2 = b5.members.filter((m) => m.hostFamilyId === internat.id).length;
  check('collectif auto: occupe jusqu a la capacite sans la depasser', as2 < 300 && occ2 === 3, { as2, occ2 });
  for (const m of b5.members) if (m.teamId === team.id && m.hostFamilyId) await call('DELETE', `/hosting/placements/${m.participantId}`, undefined, adm);
  await call('PUT', `/hosting/teams/${team.id}/group`, { hostingGroupId: null }, adm);
  await call('PUT', `/hosting/families/${internat.id}/group`, { hostingGroupId: null }, adm);
  await call('DELETE', `/host-families/${internat.id}`, undefined, adm);
  await call('DELETE', `/hosting/groups/${cg.id}`, undefined, adm);
}

// ── Groupes par zone/paroisse, regroupement en lot, hebergements collectifs ──
{
  const tag = `T${Date.now()}`;
  const mkFam = (name, extra) => call('POST', '/host-families', { familyName: `${name} ${tag}`, address: '1 rue du Test', postalCode: '69000', city: 'Lyon', maxCapacity: 4, status: 'VALIDATED', ...extra }, adm);
  const [, g1] = await call('POST', '/hosting/groups', { name: `Zone ${tag}`, kind: 'ZONE', color: '#2f7d6d' }, adm);
  check('groupe avec type et couleur', g1?.kind === 'ZONE' && g1?.color === '#2f7d6d', g1);
  check('couleur invalide -> 400', (await call('POST', '/hosting/groups', { name: 'x', color: 'rouge' }, adm))[0] === 400);
  check('type inconnu -> 400', (await call('POST', '/hosting/groups', { name: 'x', kind: 'AUTRE' }, adm))[0] === 400);
  const [, col] = await mkFam('Internat', { accommodationType: 'COLLECTIVE', maxCapacity: 30 });
  check('collectif: type enregistre et mineurs = capacite par defaut', col?.accommodationType === 'COLLECTIVE' && col?.maxUnder18 === 30, col);
  const [, fam] = await mkFam('Famille', { parish: `Paroisse ${tag}` });
  const [, fam2] = await mkFam('Famille', { parish: `Paroisse ${tag}` });
  check('famille: type par defaut FAMILY', fam?.accommodationType === 'FAMILY', fam);
  check('lot sans selection -> 400', (await call('PUT', '/hosting/families-group', { familyIds: [], hostingGroupId: g1.id }, adm))[0] === 400);
  check('lot avec famille inconnue -> 404', (await call('PUT', '/hosting/families-group', { familyIds: [fam.id, 99999999], hostingGroupId: g1.id }, adm))[0] === 404);
  const [bs] = await call('PUT', '/hosting/families-group', { familyIds: [col.id, fam.id], hostingGroupId: g1.id }, adm);
  check('regroupement en lot', bs === 200);
  const [, b3] = await call('GET', '/hosting/board', undefined, adm);
  const ff = (id) => b3.families.find((f) => f.id === id);
  check('board: familles dans le groupe + type collectif visible', ff(col.id)?.hostingGroupId === g1.id && ff(fam.id)?.hostingGroupId === g1.id && ff(col.id)?.accommodationType === 'COLLECTIVE');
  check('regroupement en lot interdit en lecture seule (403)', (await call('PUT', '/hosting/families-group', { familyIds: [fam.id], hostingGroupId: null }, health))[0] === 403);
  const [ps, pr] = await call('POST', '/hosting/groups/from-parishes', { parishes: [`Paroisse ${tag}`] }, adm);
  const made = pr?.groups?.find((x) => x.name === `Paroisse ${tag}`);
  check('par paroisse: groupe cree pour les familles sans groupe', ps === 201 && made?.created && made.families === 1 && !pr.groups.some((x) => x.families > 1), pr);
  const [, b4] = await call('GET', '/hosting/board', undefined, adm);
  check('par paroisse: la famille deja groupee n est pas deplacee', b4.families.find((f) => f.id === fam.id).hostingGroupId === g1.id);
  check('par paroisse: la famille libre est rangee', b4.families.find((f) => f.id === fam2.id).hostingGroupId === made.id);
  const [, again2] = await call('POST', '/hosting/groups/from-parishes', { parishes: [`Paroisse ${tag}`] }, adm);
  check('par paroisse: idempotent', again2.groups.length === 0, again2);
  // nettoyage
  await call('PUT', '/hosting/families-group', { familyIds: [col.id, fam.id, fam2.id], hostingGroupId: null }, adm);
  for (const id of [col.id, fam.id, fam2.id]) await call('DELETE', `/host-families/${id}`, undefined, adm);
  for (const id of [g1.id, made.id]) await call('DELETE', `/hosting/groups/${id}`, undefined, adm);
}

if (failures) { console.error(`${failures} verification(s) en echec`); process.exit(1); }
console.log('Placement d hebergement: toutes les verifications sont OK');
