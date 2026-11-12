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
Le programme (Planning & Ordonnancement) est rempli par ce seed pour les 4 jours (J1 à J4, 2027-10-31 à 2027-11-03), via
`program-demo-seed.ts` (testé par `program-demo-seed.spec.ts`). Il n'existe ni bouton de démonstration dans l'application
ni migration qui insère des données : l'application s'installe sans aucune donnée (migrations seules, planning vide), et
seuls les scripts de seed (`npm run seed:api*`, workflow `neon-db.yml` sur `main` ou en dispatch avec `seed=true`) peuplent
une base fictive. Un seed relancé vide les tables : à ne lancer que sur une base de preview.
Les comptes de test (`admin@allegria.local`, etc.) sont publics dans le dépôt : à n'utiliser que sur ces bases fictives.

## Preview de PR sur Render (gratuit) — déploiement à la demande

**Un push sur une branche de PR ne lance plus aucun build Render.** Chaque build consomme une
part des 500 minutes de pipeline gratuites/mois partagées par tout le workspace (et ce dépôt
construit 3 services par preview : api, admin, site). L'épuisement du quota bloque tous les
builds jusqu'à la remise à zéro mensuelle (observé le 2026-10-30). Les previews ne se
construisent donc que lorsqu'on veut réellement tester la branche :

- commenter `/preview` sur la PR (réservé au propriétaire, membres et collaborateurs), ou
- **Actions > PR Previews > Run workflow** avec le numéro de la PR.

`pr-previews.yml` (workflow de confiance, code lu depuis la branche de base/par défaut,
jamais depuis la PR) orchestre tout via `scripts/render-pr-previews.mjs` :

- **PR ouverte / mise à jour** (job `ensure`) : aucune création de service, aucun build.
  La branche Neon fictive `preview/pr-<N>` (parent `preview/main`, expiration 14 jours) est
  préparée, et le commentaire de statut sur la PR est mis à jour (liens et mode d'emploi).
- **`/preview` ou dispatch manuel** (jobs `refresh-*`) : création des 3 services gratuits
  au premier appel (`al-pr<N>-api` web_service Node, `al-pr<N>-web` et `al-pr<N>-site`
  static sites, Francfort), rotation du mot de passe DB propre à la branche Neon, puis
  déploiement du dernier commit — exactement un build par service (un changement de variable
  d'environnement redéploie de lui-même, le script ne relance pas un build explicite dans
  ce cas). La branche/sha déployés sont relus via l'API GitHub, jamais depuis les métadonnées
  d'événement ; les PR de forks sont refusées. `autoDeploy` reste désactivé sur les services :
  le workflow est l'unique déclencheur de build.
- **PR fermée** (job `cleanup`) : suppression des 3 services et de la branche Neon.

Les anciennes previews natives du dashboard Render (section précédente de ce doc,
`scripts/preview-start.mjs`) ne sont plus le mécanisme actif.

Limites : instance gratuite (veille après 15 min, 750 h et 500 min de build partagées par
tout le workspace) ; 10 branches Neon max sur le plan gratuit (les branches expirent seules).

## Authentification de l'API

Toute route exige un token Bearer sauf celles marquées `@Public()` : `GET /`, `GET /health`, `POST /auth/login`
et les trois `POST /public/*` d'inscription (limitées par `ThrottlerGuard`). La liste est figée par
`public-routes.spec.ts`. Ce guard authentifie seulement : les contrôles de rôles (`@Roles`) restent à compléter
route par route.
