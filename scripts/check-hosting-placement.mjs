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

if (failures) { console.error(`${failures} verification(s) en echec`); process.exit(1); }
console.log('Placement d hebergement: toutes les verifications sont OK');
