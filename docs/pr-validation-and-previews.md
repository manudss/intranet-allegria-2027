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
Previews = Automatic (onglet Previews du service). Chaque PR vers cette branche obtient une preview Render.

Une preview Render ne peut pas recevoir une `DATABASE_URL` différente par PR depuis le dashboard. C'est donc
`scripts/preview-start.mjs` qui, au démarrage de chaque déploiement (service de base ou preview de PR) :

1. lit `RENDER_GIT_BRANCH` (fournie par Render) ;
2. crée (ou réutilise) la branche Neon `preview/render-<branche>` issue de `preview/main` (fictive), avec
   expiration automatique (14 jours par défaut, max 30) ;
3. refuse de continuer si le parent n'est pas `preview/main` ou si c'est la branche par défaut (`production`) ;
4. lance les migrations sur cette branche isolée, puis l'API (avec `DATABASE_URL` spécifique, sans `NEON_API_KEY`).

| Réglage      | Valeur                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Build        | `npm ci && WEB_API_URL= npm run build`                                                           |
| Start        | `WEB_STATIC_DIR=dist/apps/web/browser node scripts/preview-start.mjs`                            |
| Health check | `/health`                                                                                        |
| Variables    | `NEON_API_KEY` (secret, clé dédiée révocable), `NEON_PROJECT_ID`, `CORS_ORIGIN` (URL du service) |

Ne pas définir `NODE_ENV=production` côté Render (le build a besoin des devDependencies). `WEB_STATIC_DIR` fait servir
`dist/apps/web/browser` par l'API (fallback SPA, `/api` et `/health` inchangés) ; sans cette variable (production),
le comportement est identique à avant.

Limites : instance gratuite (veille après 15 min, 750 h et 500 min de build partagées par tout le workspace) ;
10 branches Neon max sur le plan gratuit (les branches expirent seules) ; `NEON_API_KEY` est visible du code de chaque
PR pendant le build, donc réserver ce dépôt privé à des auteurs de confiance.

## Authentification de l'API

Toute route exige un token Bearer sauf celles marquées `@Public()` : `GET /`, `GET /health`, `POST /auth/login`
et les trois `POST /public/*` d'inscription (limitées par `ThrottlerGuard`). La liste est figée par
`public-routes.spec.ts`. Ce guard authentifie seulement : les contrôles de rôles (`@Roles`) restent à compléter
route par route.

> Preview smoke test: this line only exists to trigger a PR preview.
(retrigger)
retrigger 1793287690
