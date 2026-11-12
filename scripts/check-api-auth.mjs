// Smoke test d'authentification de l'API (utilise des donnees FICTIVES uniquement).
// Usage : API_URL=http://localhost:3000 node scripts/check-api-auth.mjs
// Variables optionnelles : CHECK_EMAIL / CHECK_PASSWORD (par defaut compte seed fictif).
const base = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const email = process.env.CHECK_EMAIL ?? 'admin@allegria.local';
// Mot de passe commun des comptes de demo seedes (voir seed.ts DEMO_PASSWORD).
const password = process.env.CHECK_PASSWORD ?? 'demo-only-not-a-secret';

let failures = 0;
const expect = (label, actual, ok) => {
  const pass = ok(actual);
  if (!pass) failures += 1;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label} -> ${actual}`);
};
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  await res.arrayBuffer();
  return res.status;
};

// Sans token : tout ce qui n'est pas public doit etre refuse (401).
for (const [method, path] of [
  ['GET', '/api/participants'],
  ['POST', '/api/participants'],
  ['DELETE', '/api/participants/1'],
  ['GET', '/api/users'],
  ['GET', '/api/roles'],
  ['GET', '/api/groups'],
  ['GET', '/api/host-families'],
  ['GET', '/api/teams'],
  ['GET', '/api/volunteers'],
  ['GET', '/api/assignments'],
  ['GET', '/api/volunteer-teams'],
  ['GET', '/api/volunteer-audit-logs'],
  ['GET', '/api/operational-dashboard/global'],
]) {
  expect(`anonyme ${method} ${path}`, await call(method, path), (s) => s === 401);
}

// Public : sante, login, inscriptions en POST uniquement (jamais de lecture/liste).
expect('anonyme GET /health', await call('GET', '/health'), (s) => s === 200);
expect(
  'anonyme GET inscriptions jeunes (lecture interdite)',
  await call('GET', '/api/public/participant-registrations'),
  (s) => s === 401 || s === 404,
);
expect(
  'anonyme POST inscriptions jeunes (corps vide -> validation, pas 401)',
  await call('POST', '/api/public/participant-registrations', { body: {} }),
  (s) => s === 400 || s === 429,
);

// Token invalide.
expect(
  'token invalide',
  await call('GET', '/api/participants', { token: 'nope' }),
  (s) => s === 401,
);

// Login puis acces autorise.
const login = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
expect('login', login.status, (s) => s === 200 || s === 201);
const { accessToken } = await login.json();
for (const path of ['/api/participants', '/api/groups', '/api/host-families', '/api/users']) {
  expect(
    `authentifie GET ${path}`,
    await call('GET', path, { token: accessToken }),
    (s) => s === 200,
  );
}

if (failures > 0) {
  console.error(`${failures} verification(s) en echec`);
  process.exit(1);
}
console.log("Toutes les verifications d'authentification sont OK");
