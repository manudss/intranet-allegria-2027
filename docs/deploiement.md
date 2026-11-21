# Deploiement production (GitHub Actions -> Render)

`main` reste deploye automatiquement. Les builds sont faits sur GitHub Actions,
les trois fronts sont copies sur les CDN Render du second compte. La copie
consomme peu de minutes, mais pas zero : environ 1 minute observee pour les trois
premiers deploys le 21 novembre 2026. Rester dans les quotas Hobby gratuits,
sans carte ni changement de plan.

## Cibles actuelles

| Surface | URL | Compte Render | Dossier sur deploy |
| --- | --- | --- | --- |
| Site public | https://alegria-live-site.onrender.com/ | second compte | site |
| Intranet | https://alegria-live-web.onrender.com/ | second compte | web |
| Mobile Jour J | https://alegria-live-mobile.onrender.com/ | second compte | mobile |
| API | https://alegria.dss.name/ | premier compte | image GHCR |
| Espace famille | https://alegria.dss.name/familles/espace-famille | premier compte, API | inclus dans l'image |

Les anciens sites statiques du premier compte ne sont plus les cibles du
workflow. Ils ne sont ni supprimes ni reconfigures par cette maintenance.
Le service `iam-demo-apps` du second compte reste independant et inchange.
Aucun deplacement de donnees, de domaine ou de DNS.

## Chaine automatique

1. `Prod image (GHCR)` construit et publie l'image API sur un push sur `main`.
2. `Prod deploy (Render)` conserve ses jobs existants de migrations Neon et
   de deploy API. Cette maintenance ne les modifie pas.
3. Le job statique extrait la revision du run image declencheur (ou celle du
   lancement manuel), construit web/site/mobile et publie les dist sur `deploy`.
4. Les trois services statiques suivent `deploy`, auto-deploy au commit.
   Pas d'appel aux anciens services Render, ni de nouvelle cle API a installer.
5. `check-static-production.mjs` attend au maximum dix minutes : pour chaque
   CDN, le marqueur `deployment.json` doit donner la revision source attendue,
   l'empreinte SHA-256 de l'index doit correspondre, les assets principaux
   doivent etre accessibles et `app-config.json` doit viser l'API existante.
   Les erreurs reseau, une ancienne revision et un fallback HTML ne valent
   pas une livraison reussie. Les lectures sont espacees de quinze secondes.
6. Le job de sante controle l'API, les trois nouvelles URLs et l'espace famille.

Le marqueur expose seulement le nom de l'application, le SHA source et
l'empreinte de l'index. Aucune donnee privee ni aucun secret.

## Configuration Render deja en place

Pour les trois nouveaux services : branche `deploy`, build vide,
`SKIP_INSTALL_DEPS=true`, dossier publie `site`, `web` ou `mobile`,
auto-deploy au commit, rewrite SPA `/*` vers `/index.html`.

Sur le site public, la regle `/api/*` vers
`https://alegria.dss.name/api/*` doit rester avant le fallback SPA : les
formulaires publics utilisent des appels relatifs. L'espace famille redirige
vers l'origine de l'API, pour conserver les cookies sur cette origine.

`CORS_ORIGIN` de l'API inclut les trois nouvelles origines exactes, en plus
des origines historiques. Ne jamais remplacer l'ensemble des variables
d'environnement pour changer une seule valeur.

Les checks attendent l'auto-deploy. Si le webhook Render ne se declenche pas,
le workflow echoue explicitement au lieu de presenter une ancienne version
comme actuelle. Inspecter le service concerne et, si necessaire, lancer son
redeploiement du commit de `deploy` depuis Render, sans lancer un build source.

## Secrets conserves

- `RENDER_API_KEY` reste la cle du premier compte pour le job API uniquement.
- `ALLEGRIA_PROD_DATABASE_URL` reste la connexion de production existante.
- `ALLEGRIA_PROD_DATABASE_URL_DIRECT` reste optionnel pour les migrations.

Aucune nouvelle cle de second compte n'est necessaire pour les fronts.
Ne pas remplacer la cle globale par celle du second compte.

## Retour arriere et limites

- Preferer `git revert` sur une branche, puis PR et fusion par le proprietaire :
  la chaine republie les dist et leurs marqueurs coherents.
- Un rollback manuel dans Render vers un ancien commit reste possible. Un ancien
  commit sans `deployment.json` ne satisfait volontairement pas le nouveau check.
- L'API garde son mecanisme existant de rollback d'image. Les migrations n'ont
  pas de rollback automatique.
- `render-static-deploy.mjs` reste disponible comme ancien outil manuel, mais
  n'est plus appele par le workflow de production.
- `render.yaml` est un ancien blueprint de demo, inerte et laisse en place.
- Les tests de cette maintenance sont locaux et CI, sans creation de service
  preview, sans execution de migration/deploy prod depuis la branche de PR.
  Le premier controle bout en bout du nouveau workflow attend sa fusion.
