# AGENTS.md

## Aperçu du dépôt
- Monorepo **Nx 23** intégré avec 3 projets : `apps/web` (Angular 22), `apps/api` (NestJS 11) et `libs/shared` (lib TypeScript partagée).
- Le frontend et l’API sont **encore très proches du scaffold Nx** : `apps/web/src/app/app.routes.ts` est vide, `apps/web/src/app/app.ts` affiche `NxWelcome`, et `apps/api/src/app/app.service.ts` retourne seulement `{ message: 'Hello API' }`.
- Ne présumez donc pas de couches métier déjà en place : beaucoup de structure est prête, peu de fonctionnalités sont encore implémentées.

## Architecture à connaître
- **API NestJS** : le point d’entrée est `apps/api/src/main.ts`; tout est servi sous le préfixe global `/api` sur le port `3000`.
- `apps/api/src/app/app.module.ts` centralise la composition : `ConfigModule.forRoot({ isGlobal: true })`, `TypeOrmModule.forRootAsync(...)`, puis `CoreModule`.
- `apps/api/src/app/core/core.module.ts` est actuellement vide : c’est l’endroit naturel pour accrocher de futurs modules de domaine plutôt que d’encombrer `AppModule`.
- **Web Angular** : bootstrap standalone via `bootstrapApplication(App, appConfig)` dans `apps/web/src/main.ts`.
- La config Angular est portée par `apps/web/src/app/app.config.ts` (providers) et `apps/web/src/app/app.routes.ts` (routing). Pas de `AppModule` côté web.
- **Code partagé** : exposez tout ce qui doit être consommé par plusieurs projets depuis `libs/shared/src/index.ts`, puis importez-le via l’alias `@mej-allegria/shared` défini dans `tsconfig.base.json`.

## Base de données / TypeORM
- PostgreSQL tourne via `compose.yaml` (service `postgres`, port `5432`, volume `postgres-data`).
- Copiez d’abord `.env.example` vers `.env`; la config DB est lue par `apps/api/src/database/typeorm.config.ts`.
- `synchronize` est **désactivé** à la fois pour Nest et pour le `DataSource` CLI : le schéma doit évoluer via **migrations**, pas par auto-sync.
- Les entités doivent matcher `apps/api/src/**/*.entity.ts`; les migrations vivent dans `apps/api/src/database/migrations/*.ts`.

## Workflows utiles
- Installation et démarrage DB : `npm install`, puis `npm run db:up`.
- Démarrage dev : `npm run serve:web`, `npm run serve:api`, ou `npm run serve` pour lancer les deux.
- L’API est servie via la cible Nx `serve` qui dépend d’un build webpack (`apps/api/project.json` + `apps/api/webpack.config.js`).
- Qualité : `npm test`, `npm run lint`, `npm run format`.
- Ciblage fin par projet : `nx test web`, `nx test api`, `nx build shared`, `nx serve web`, etc.

## Conventions observables
- **NestJS** : controllers minces (`apps/api/src/app/app.controller.ts`), logique dans des services injectables (`apps/api/src/app/app.service.ts`).
- **Angular** : composants standalone, routes dans `app.routes.ts`, providers applicatifs dans `app.config.ts`, styles en **SCSS** (voir `nx.json` et `apps/web/project.json`).
- **Tests** : `apps/api` et `libs/shared` utilisent Vitest explicitement (`import { describe, expect, it } from 'vitest'`), tandis que `apps/web` utilise le runner de test Angular avec `TestBed` dans `apps/web/src/app/app.spec.ts`.
- Le repo n’a pas de projet e2e ; ne cherchez pas de convention Cypress/Playwright déjà établie.

## Conseils spécifiques pour agents
- Quand vous ajoutez du code partagé, exportez-le depuis `libs/shared/src/index.ts` plutôt que d’importer des chemins internes de la lib.
- Quand vous ajoutez du backend persistant, créez l’entité + migration ensemble et utilisez `npm run migration:generate` / `npm run migration:run`.
- Quand vous ajoutez du frontend, partez du fait qu’il n’existe **pas encore** de client API, store global ou structure de feature modules : il faudra les introduire explicitement.
- Avant de conclure une modification, exécutez au minimum les tests/lint du ou des projets touchés plutôt qu’un contrôle générique du workspace entier si le changement est localisé.

