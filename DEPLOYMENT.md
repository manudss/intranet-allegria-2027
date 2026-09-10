# Deployment

## 1. Prerequis locaux

- Node.js `24.15.0` (voir `.nvmrc`)
- npm `lockfileVersion: 3`
- Docker si vous voulez lancer PostgreSQL localement
- Un projet Neon PostgreSQL
- Un compte Render
- Un compte Cloudflare Pages
- Un dépôt GitHub connecté à Render et Cloudflare

Le dépôt est un **monorepo Nx** avec :

- `apps/api` : backend NestJS 11 + TypeORM + PostgreSQL
- `apps/web` : frontend Angular 22
- `libs/shared` : bibliothèque TypeScript partagée

## 2. Commandes d'installation

```bash
npm ci
copy .env.example .env
npm run db:up
```

Si `npm ci` échoue localement sur Windows à cause d'un verrou sur `esbuild.exe`, fermez les processus Node/Angular encore ouverts puis relancez la commande.

## 3. Commandes de build

```bash
npm run build:web
npm run build:api
npm run build
```

- `npm run build:web` génère le frontend Angular pour Cloudflare Pages
- `npm run build:api` génère le bundle Node de l'API pour Render
- `npm run build` construit les deux applications

Répertoires de sortie utiles :

- Frontend Cloudflare Pages : `dist/apps/web/browser`
- Backend Render : `dist/apps/api`

## 4. Commandes de test

```bash
nx test web
nx test api
npm test
```

## 5. Variables d'environnement locales

Créez un fichier `.env` à partir de `.env.example`.

Variables backend :

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:4200
DATABASE_URL=
DATABASE_URL_DIRECT=
DB_SSL=true
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mej_allegria
DB_USER=mej_user
DB_PASSWORD=mej_password
```

Variable frontend publique pour les builds statiques :

```env
WEB_API_URL=
```

- En local, laissez `WEB_API_URL` vide pour conserver les appels relatifs `/api` via `apps/web/proxy.conf.json`.
- En Cloudflare Pages, définissez `WEB_API_URL` avec l'URL publique Render, par exemple `https://intranet-allegria-api-demo.onrender.com`.

## 6. Creer ou recuperer la base Neon

1. Créez un projet Neon depuis le tableau de bord Neon.
2. Ouvrez la base cible puis la section **Connection Details**.
3. Copiez la **pooled connection string** pour le runtime applicatif.
4. Copiez la **direct connection string** si vous voulez exécuter les migrations hors pooler.

Ne committez jamais ces valeurs dans Git.

## 7. Difference entre `DATABASE_URL` et `DATABASE_URL_DIRECT`

- `DATABASE_URL` : connexion PostgreSQL utilisée par le **runtime** NestJS. Pour Neon, utilisez de préférence la **chaîne poolée**.
- `DATABASE_URL_DIRECT` : connexion PostgreSQL utilisée par les **migrations** TypeORM si vous devez contourner le pooler. Pour Neon, utilisez la **chaîne directe**.

Dans ce dépôt :

- l'API NestJS lit `DATABASE_URL`
- les migrations TypeORM lisent `DATABASE_URL_DIRECT`, puis retombent sur `DATABASE_URL` si la variable directe n'est pas définie

## 8. Execution des migrations

Commandes disponibles :

```bash
npm run migration:generate
npm run migration:run
npm run migration:revert
npm run db:migrate
```

`db:migrate` est un alias de `migration:run`.

Recommandation :

- **développement local** : utilisez votre PostgreSQL local ou un environnement Neon dédié
- **déploiement Render** : fournissez `DATABASE_URL_DIRECT` si Neon exige une connexion directe pour les migrations
- **production de démonstration** : ne lancez pas de seed destructif automatiquement

## 9. Configuration du service Render

Le dépôt versionne `render.yaml` pour rendre le service reproductible.

Paramètres attendus :

| Champ | Valeur |
| --- | --- |
| Service type | `Web Service` |
| Runtime | `Node` |
| Production branch | `main` |
| Root directory | repository root |
| Build command | `npm ci && npm run db:migrate && npm run build:api` |
| Start command | `npm run start:prod` |
| Health check path | `/health` |
| Auto deploy | activé |

Variables à renseigner dans Render :

| Variable | Valeur |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | chaîne Neon **poolée** |
| `DATABASE_URL_DIRECT` | chaîne Neon **directe** si disponible |
| `CORS_ORIGIN` | `http://localhost:4200,https://<votre-projet>.pages.dev` |
| `DB_SSL` | `true` |

Ne définissez pas `PORT` manuellement sur Render : la plateforme l'injecte automatiquement.

## 10. Configuration de Cloudflare Pages

Le frontend Angular est statique et le fallback SPA est versionné via `apps/web/public/_redirects`.

Paramètres attendus :

| Champ | Valeur |
| --- | --- |
| Framework preset | `None` ou configuration manuelle |
| Production branch | `main` |
| Build command | `npm ci && npm run build:web` |
| Build output directory | `dist/apps/web/browser` |

Variables de build publiques à renseigner dans Cloudflare Pages :

| Variable | Valeur |
| --- | --- |
| `WEB_API_URL` | `https://<nom-du-service-render>.onrender.com` |

`WEB_API_URL` ne doit pas inclure `/api`. Le frontend ajoute ensuite les chemins API (`/api/...`) lui-même.

## 11. Configuration CORS

Le backend lit `CORS_ORIGIN` comme une liste séparée par des virgules.

Exemple :

```env
CORS_ORIGIN=http://localhost:4200,https://demo-mej.pages.dev
```

L'authentification actuelle utilise un token envoyé dans l'en-tête `Authorization`, pas des cookies de session.

Conséquences :

- pas de `origin: '*'`
- pas de `credentials: true` nécessaire
- évitez d'écrire les tokens dans les logs applicatifs

## 12. Premier deploiement

1. Poussez le code sur GitHub.
2. Créez la base Neon et récupérez les deux chaînes de connexion.
3. Créez le service Render à partir du dépôt GitHub et laissez Render lire `render.yaml`.
4. Ajoutez les variables Render manquantes.
5. Créez le projet Cloudflare Pages à partir du même dépôt GitHub.
6. Ajoutez `WEB_API_URL` dans Cloudflare Pages.
7. Lancez le premier déploiement.
8. Vérifiez `https://<render-service>.onrender.com/health`.
9. Vérifiez l'application Cloudflare Pages et un rechargement direct d'URL profonde.

## 13. Mise a jour apres un `git push`

- Un push sur `main` déclenche automatiquement :
  - le workflow GitHub Actions de vérification
  - le déploiement Render
  - le déploiement Cloudflare Pages

Si une migration est présente, Render exécute `npm run db:migrate` pendant la phase de build.

## 14. Consultation des logs

- **GitHub Actions** : onglet **Actions**
- **Render** : onglet **Logs** du service web
- **Cloudflare Pages** : onglet **Deployments** puis logs du build
- **Neon** : monitoring et activity depuis le tableau de bord Neon

À vérifier en priorité :

- échec `npm ci`
- échec TypeORM migration
- health check Render en erreur
- erreurs CORS
- `WEB_API_URL` incorrect ou avec `/api` en trop

## 15. Procedure de rollback

1. Identifiez le dernier commit ou le dernier déploiement stable.
2. Sur GitHub, revenez au commit stable via un revert ou un nouveau commit correctif.
3. Laissez GitHub/Render/Cloudflare redéployer automatiquement `main`.
4. Si nécessaire, redeployez manuellement une version précédente depuis Render et Cloudflare Pages.
5. Si une migration a été déployée par erreur, évaluez `npm run migration:revert` uniquement sur un environnement contrôlé et après validation de l'impact sur les données.

Ne faites pas de rollback destructif sur la base de démonstration sans sauvegarde préalable.

## 16. Problemes frequents

### `npm ci` bloque sur Windows

Un binaire comme `esbuild.exe` est verrouillé. Fermez les serveurs de dev, antivirus intrusifs ou terminaux qui gardent `node_modules` ouvert, puis relancez.

### Le frontend appelle la mauvaise API

Vérifiez `WEB_API_URL` dans Cloudflare Pages. La valeur attendue est l'origine Render, sans suffixe `/api`.

### Les routes Angular renvoient 404 apres rechargement

Vérifiez que `_redirects` est bien publié dans `dist/apps/web/browser`.

### Les migrations Neon echouent

Essayez `DATABASE_URL_DIRECT` avec la chaîne directe Neon au lieu de la chaîne poolée.

### Render ne passe pas le health check

Vérifiez les variables `DATABASE_URL`, `CORS_ORIGIN`, la connectivité Neon et les logs de démarrage du service.

## 17. Procedure de suppression de la demo

1. Désactivez ou supprimez le projet Cloudflare Pages.
2. Supprimez le service Render.
3. Supprimez ou suspendez la base Neon.
4. Révoquez les variables et secrets associés dans les plateformes.
5. Supprimez les éventuels domaines personnalisés et règles DNS associés.

## 18. Avertissements sur les donnees personnelles

Cet environnement est prévu **uniquement pour une démonstration**.

- N'y chargez **aucune donnée personnelle réelle**.
- N'y chargez **aucune donnée réelle de mineurs**.
- Utilisez uniquement des données fictives, anonymisées ou spécialement préparées pour la démonstration.
- Si vous devez montrer des parcours réalistes, passez par des jeux de données de démo contrôlés.

La démonstration ne doit pas devenir un environnement de production déguisé.
