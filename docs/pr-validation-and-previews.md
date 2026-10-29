# Validation des PR et previews gratuites

## Ce qui est automatique (GitHub Actions, dépôt privé)

Sur chaque PR et chaque push, `.github/workflows/ci.yml` lance :

- `verify` : `npm run lint`, `npm run build` (web + api), `npm test`, `npm run build:site`.
- `api-auth-smoke` : Postgres éphémère, migrations, seed **fictif** (`seed:api:small`), démarrage de l'API
  puis `scripts/check-api-auth.mjs` (routes protégées = 401 sans token, inscriptions publiques en POST seulement,
  login puis accès autorisé).

`nx format:check` n'est pas bloquant : il échoue déjà sur `main` (fichiers non formatés).

## Base de données de preview

`neon-db.yml` crée une branche Neon par PR. Elle dérive désormais de `preview/main`, jamais de `production`.
`preview/main` est reseedée à chaque push sur `main` : le seed vide **toutes** les tables
(test `seed-coverage.spec.ts`) puis insère des données générées avec faker. Ne jamais y mettre de vraies données.
Les comptes de test (`admin@allegria.local`, etc.) sont publics dans le dépôt : à n'utiliser que sur ces bases fictives.

## Preview de PR sur Render (gratuit)

Les previews natives de Render copient le plan du service de base (Starter = payant) ; les environnements de
preview complets exigent le plan Pro. La voie gratuite : un service web Render en plan **Free**, branche `main`,
Previews = Automatic, qui sert l'API et le front ensemble :

| Réglage                                | Valeur                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Build                                  | `npm ci && WEB_API_URL= npm run build`                                          |
| Start                                  | `npm run db:migrate && WEB_STATIC_DIR=dist/apps/web/browser npm run start:prod` |
| Health check                           | `/health`                                                                       |
| `DATABASE_URL` / `DATABASE_URL_DIRECT` | chaîne de la branche Neon `preview/main` (fictive uniquement)                   |
| `CORS_ORIGIN`                          | l'URL du service                                                                |
| `DB_SSL`                               | `true`                                                                          |

`WEB_STATIC_DIR` fait servir `dist/apps/web/browser` par l'API (fallback SPA, `/api` et `/health` inchangés).
Sans cette variable (production), le comportement est identique à avant.

Limites : instance gratuite (veille après 15 min, 750 h et 500 min de build partagées par tout le workspace),
base partagée entre previews (une migration de PR agit sur `preview/main`, qui se reseede au prochain push sur `main`).

## Authentification de l'API

Toute route exige un token Bearer sauf celles marquées `@Public()` : `GET /`, `GET /health`, `POST /auth/login`
et les trois `POST /public/*` d'inscription (limitées par `ThrottlerGuard`). La liste est figée par
`public-routes.spec.ts`. Ce guard authentifie seulement : les contrôles de rôles (`@Roles`) restent à compléter
route par route.
