# Deploiement production (GitHub Actions -> Render)

Objectif : `main` se deploie tout seul, **sans consommer aucune des 500 minutes
de pipeline gratuites** du workspace Render, et sans dependre du webhook
Render<->GitHub (observe comme non fiable : aucun auto-deploy au merge de #13).

- **API** : image Docker buildee par GitHub Actions (runners gratuits, repo
  public), poussee sur GHCR. Render ne fait que tirer l'image.
- **Fronts** (admin `web`, site public `site`, mobile a venir) : dists buildes
  par GitHub Actions, publies sur la branche `deploy` du repo. Les static sites
  Render suivent cette branche avec une **commande de build vide** : simple
  copie CDN, zero minute.
- **Migrations Neon** : job GitHub separe, avant tout deploy.

## Chaine

```
push sur main
  -> workflow "Prod image (GHCR)"  : build + push ghcr.io/manudss/intranet-allegria-2027:<sha> et :latest
  -> workflow "Prod deploy (Render)" (workflow_run sur le precedent, ou manuel)
       1. migrate        : npm ci && npm run db:migrate  (TypeORM, base Neon prod)
       2. deploy-api     : scripts/render-prod-deploy.mjs   (POST /deploys, attend "live")
       3. deploy-static  : build web/site/(mobile) -> branche `deploy` -> scripts/render-static-deploy.mjs
       4. health         : curl alegria.dss.name/health + fronts
```

Garde-fous : tant qu'un service Render n'a pas ete bascule (une seule fois, a la
main, ci-dessous), le script correspondant le **saute** et le run reste vert -
jamais de build Render declenche par erreur.

## Secrets GitHub (Settings -> Secrets and variables -> Actions)

| Secret | Contenu |
| --- | --- |
| `RENDER_API_KEY` | deja present (cle API Render du compte) |
| `ALLEGRIA_PROD_DATABASE_URL` | **nouveau** - URL Neon prod (pooler, `-pooler.` dans l'hote) |
| `ALLEGRIA_PROD_DATABASE_URL_DIRECT` | optionnel - URL Neon prod directe ; si absent, `DATABASE_URL` est utilisee |

## Configuration unique (dashboard Render)

### 1. API `intranet-allegria-2027` : git-backed -> image-backed
1. Attendre que le workflow "Prod image (GHCR)" ait pousse une premiere image.
2. Le package GHCR `manudss/intranet-allegria-2027` est cree **prive** : le
   passer en public (GitHub -> Packages -> settings -> Change visibility),
   sinon configurer un registry credential GHCR dans Render.
3. Dashboard Render -> service -> **Settings -> Build & Deploy** ->
   **Source Code** : *Disconnect*. Puis **New -> ou edit -> Docker** :
   Image URL `ghcr.io/manudss/intranet-allegria-2027:latest`.
   Les env vars existantes (DATABASE_URL, ...) sont conservees.
4. `scripts/render-prod-deploy.mjs` detecte le service image-backed et deploie
   normalement desormais.

### 2. Static sites : suivre la branche `deploy`, build vide
Pour chacun de `intranet-allegria-2027-1` (front admin) et `allegria-2027`
(site public), puis `allegria-mobile` quand il sera cree :
- **Settings -> Build & Deploy** : Branch = `deploy`, **Build Command = vide**,
  Publish Directory = `web` / `site` / `mobile` selon le service.
- Ajouter l'env var `SKIP_INSTALL_DEPS=true` (evite tout npm install cote Render).
- Garder la regle de rewrite `/* -> /index.html` (SPA).
`scripts/render-static-deploy.mjs` ne touche qu'aux services deja dans cet etat.

### 3. Service mobile `allegria-mobile`
La PR PWA (#18) est dans `main` : le job build deja `apps/mobile` et le publie sur la branche `deploy`. Reste a creer le service : static site sur la branche
`deploy`, publish dir `mobile`, URL Render par defaut
(`allegria-mobile.onrender.com`). Les previews de PR l'ont deja (script
render-pr-previews).

## Rollback

- **Fronts** : la branche `deploy` garde un commit par push de `main` ; dans le
  dashboard Render, redeployer un commit precedent du static site, ou
  `git revert` cote source puis push (la chaine republie).
- **API** : dashboard Render -> onglet deploys -> redeployer une image
  precedente (tag `<sha>` immutable conserve sur GHCR).
- **Migrations** : pas de rollback automatique (comme avant) ; les migrations
  restent additives.

## Notes

- Le workflow "Prod deploy" peut aussi etre lance a la main (Actions -> Prod
  deploy -> Run workflow) sans rebuild d'image : il redeploie `:latest`.
- `render.yaml` decrit un ancien blueprint de demo sans rapport avec les
  services reels ; il est inerte et laisse tel quel.
- En cas de doute sur l'etat d'un service : le script concerne loggue
  `skipped` avec la raison (`git-backed`, `not-switched`, `missing`).
