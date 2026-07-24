# MEJ Allegria

Monorepo intégré Nx pour l’intranet événementiel MEJ Allegria : Angular 22, NestJS,
PostgreSQL/TypeORM et Vitest.

## Création du workspace

Pour reproduire l’initialisation dans un nouveau dossier :

```bash
npx create-nx-workspace@latest mej-allegria --preset=apps --workspaceType=integrated
cd mej-allegria
npm install -D @nx/angular @nx/nest @nx/js @nx/vitest prettier
```

La version actuelle du CLI installe Nx 23.1 et Angular 22. Les générateurs utilisés sont :

```bash
nx generate @nx/angular:app apps/web --name=web --style=scss --routing --strict --unitTestRunner=vitest-angular --e2eTestRunner=none
nx generate @nx/nest:app apps/api --name=api --strict --linter=eslint --unitTestRunner=none --e2eTestRunner=none
nx generate @nx/vitest:configuration --project=api --uiFramework=none --testEnvironment=node --coverageProvider=v8
nx generate @nx/nest:module apps/api/src/app/core/core --module=apps/api/src/app/app.module.ts
nx generate @nx/js:lib libs/shared --name=shared --importPath=@mej-allegria/shared --linter=eslint --unitTestRunner=vitest
```

Angular 21+ utilise ici son intégration Vitest native (`@angular/build:unit-test`). L’API et la
librairie partagée utilisent le plugin `@nx/vitest`. AnalogJS n’est donc pas nécessaire.

## Base de données

```bash
npm install @nestjs/typeorm typeorm pg @nestjs/config
copy .env.example .env
npm run db:up
npm run migration:generate
npm run migration:run
```

`npm run db:up` démarre PostgreSQL 17 dans Docker et attend que la base soit prête. Les données
sont conservées dans le volume `postgres-data`. Utilisez `npm run db:down` pour arrêter le service.

Adaptez `.env` à votre instance PostgreSQL. `synchronize` reste désactivé : le schéma est géré
par migrations.

## Développement et qualité

```bash
nx serve web
nx serve api
nx run-many --target=serve --projects=web,api

nx test web
nx test api
nx run-many --target=test --all

nx lint web
nx lint api
nx run-many --target=lint --all

nx format:write --all
nx format:check --all
```

Les mêmes opérations sont disponibles via `npm run serve`, `npm test`, `npm run lint` et
`npm run format`.

## Import partagé

Les applications peuvent importer les types et DTO exposés par `libs/shared/src/index.ts` :

```ts
import type { Shared } from '@mej-allegria/shared';
```
