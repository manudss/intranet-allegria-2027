# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

MEJ Allegria intranet — Nx 23 monorepo with three projects:

- `apps/web` — Angular 22 (standalone, zoneless, Taiga UI)
- `apps/api` — NestJS 11 (TypeORM, PostgreSQL)
- `libs/shared` — shared TypeScript library (`@mej-allegria/shared`)

## Commands

```bash
# Database
npm run db:up          # start PostgreSQL 17 in Docker and wait until ready
npm run db:down        # stop the container

# Dev servers
npm run serve          # both web (port 4200) and api (port 3000)
npm run serve:web      # Angular only
npm run serve:api      # NestJS only

# Tests
nx test web            # Angular tests (TestBed + Vitest native runner)
nx test api            # NestJS tests (Vitest)
npm test               # all projects

# Lint / format
nx lint web
nx lint api
npm run lint           # all projects
npm run format         # prettier --write

# Migrations
npm run migration:generate -- migration:generate apps/api/src/database/migrations/<Name>
npm run migration:run
npm run migration:revert

# Seeding
npm run seed:api               # medium profile
npm run seed:api:small
npm run seed:api:large
```

## Architecture

### API (NestJS)

`AppModule` → `CoreModule` → domain modules (one per feature).

All TypeORM entities live in `apps/api/src/app/core/entities/` and are re-exported from its `index.ts`. Each domain module (e.g. `ParticipantsModule`) declares only the entities it needs via `TypeOrmModule.forFeature([...])`, thin controllers, and injectable services. All cross-cutting entities used by multiple services are typically injected via their owning module's export.

**Authentication** is a custom UUID-token scheme — no JWT. `AuthService` issues a `randomUUID()` token on login and stores the session in an in-memory `Map<string, SessionUser>`. The `AuthTokenGuard` resolves each request token against that map (reloading roles from DB on every call). There is no persistent session store; restarting the API invalidates all sessions.

Database config is in `apps/api/src/database/typeorm.config.ts`. `synchronize` is `false` — all schema changes must go through migrations.

### Web (Angular)

Bootstrap: `bootstrapApplication(App, appConfig)` — no `AppModule`.

- `app.config.ts` — providers (zoneless change detection, Taiga UI, HTTP client with interceptors)
- `app.routes.ts` — all routes; all feature pages are lazy-loaded
- `apps/web/src/app/core/` — `AuthService` (signals + localStorage token), `authGuard`, `authInterceptor` (Bearer header), `httpErrorInterceptor`, `roleGuard`
- `apps/web/src/app/services/api.services.ts` — **all** HTTP client services; extend `CrudApi<T, P>` for standard CRUD resources
- `apps/web/src/app/models/models.ts` — **all** frontend interfaces, types, and payload types in one file

### Frontend shared layer

`apps/web/src/app/shared/` contains:

- `SHARED_IMPORTS` — a const array of commonly needed imports; spread it in feature component `imports: [...SHARED_IMPORTS]`
- `DataTableComponent` (`app-data-table`) — the main generic table UI; configured via `DataTableColumn<T>[]` and optional `DataTableAction<T>[]`
- `PageLayoutComponent` — standard page shell with title/description slot and an `actions` content projection slot
- `ui-components.ts` — additional shared presentational components

### Shared library

Expose everything via `libs/shared/src/index.ts`; import with `@mej-allegria/shared`. Use it only for types/DTOs that both `apps/web` and `apps/api` need.

## Key conventions

- **Angular**: signals for state (`signal`, `computed`, `linkedSignal`); Angular Forms Signals API (`form()`, `required()`, `submit()`); no Zone.js.
- **NestJS**: controllers stay thin; all business logic goes in the service layer.
- **Testing**: `apps/api` and `libs/shared` use `import { describe, expect, it } from 'vitest'`; `apps/web` uses Angular TestBed via `@angular/build:unit-test`. There is no e2e setup.
- **Migration-first**: never enable `synchronize: true`. After adding/modifying an entity, generate and run a migration before testing.
- **New API resource**: create entity in `apps/api/src/app/core/entities/` + export from `index.ts`, create domain module + service + controller under `apps/api/src/app/core/<domain>/`, register the module in `CoreModule`, generate a migration.
- **New frontend resource**: add the TypeScript interface and payload type to `models/models.ts`, add a service class to `api.services.ts` (extending `CrudApi` when appropriate), add the route to `app.routes.ts`, create the feature page under `apps/web/src/app/features/<domain>/`.
