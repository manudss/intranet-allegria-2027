# AGENTS.md

## Aperçu du dépôt
- Monorepo **Nx 23** intégré avec 3 projets : `apps/web` (Angular 22 standalone zoneless), `apps/api` (NestJS 11) et `libs/shared` (lib TypeScript partagée).
- Le frontend est **bien développé** : `apps/web/src/app/app.routes.ts` contient ~12 routes lazy-loaded, `app.config.ts` configure zoneless change detection + Taiga UI + interceptors, services et guards d'auth en place.
- Le backend suit une **architecture modulaire claire** : `CoreModule` importe 12 modules de domaine (participants, groupes, bénévoles, missions, etc.), chacun avec entités TypeORM + services + contrôleurs minces.
- Utilisez les patterns établis plutôt que de partir de zéro : réutilisez `CrudApi`, `DataTableComponent`, `SHARED_IMPORTS`, et la structure d'entités `apps/api/src/app/core/`.

## Architecture à connaître
- **API NestJS** : le point d’entrée est `apps/api/src/main.ts`; tout est servi sous le préfixe global `/api` sur le port `3000`.
- `apps/api/src/app/app.module.ts` centralise la composition : `ConfigModule.forRoot({ isGlobal: true })`, `TypeOrmModule.forRootAsync(...)`, puis `CoreModule`.
- **CoreModule** importe 12 modules de domaine : `AuthModule`, `GroupsModule`, `ParticipantsModule`, `TeamsModule`, `VolunteersModule`, `VolunteerTeamsModule`, `VolunteerMissionsModule`, `VolunteerShiftAssignmentsModule`, `VolunteerSkillsModule`, `HostFamiliesModule`, `AssignmentsModule`, `ParticipantHealthModule`. Toutes les entités résident dans `apps/api/src/app/core/` et sont ré-exportées via `index.ts`.
- **Auth** : schéma UUID-token personnalisé (pas JWT). `AuthService` émet un token `randomUUID()` au login, stocké en mémoire dans une `Map<string, SessionUser>`. `AuthTokenGuard` valide à chaque requête. Redémarrer l'API invalide toutes les sessions.
- **Web Angular** : bootstrap standalone via `bootstrapApplication(App, appConfig)` dans `apps/web/src/main.ts`.
- **app.config.ts** configure : zoneless change detection, Taiga UI (`provideTaiga()`), routeur, HttpClient avec interceptors (authInterceptor, httpErrorInterceptor).
- **app.routes.ts** (~12 routes) : toutes lazy-loaded, routes publiques (login) et routes protégées (authGuard) avec enfants imbriqués; certains enfants ont roleGuard (`equipes-operationnelles`, `missions-benevoles`).
- **Core Angular** (`apps/web/src/app/core/`) : `AuthService` (signaux + localStorage token), `authGuard`, `roleGuard`, `authInterceptor` (Bearer header), `httpErrorInterceptor`.
- **Modèles et services** : tous les DTOs/interfaces dans `apps/web/src/app/models/models.ts` (1 fichier); tous les services HTTP dans `apps/web/src/app/services/api.services.ts`, étendant classe abstraite `CrudApi<T, P>` pour les ressources CRUD standard.
- **Couche partagée frontend** (`apps/web/src/app/shared/`) : `SHARED_IMPORTS` (const importée dans les feature components), `DataTableComponent` (`app-data-table`, avec `DataTableColumn<T>[]` et optionnel `DataTableAction<T>[]`), `PageLayoutComponent` (shell de page standard), `ui-components.ts` (composants présentationnels additionnels).
- **Code partagé** : exposez tout ce qui doit être consommé par plusieurs projets depuis `libs/shared/src/index.ts`, puis importez-le via l'alias `@mej-allegria/shared` défini dans `tsconfig.base.json`.

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
- **Angular** : composants standalone, zoneless (pas de Zone.js), changement de détection par signaux. Utilisez `signal()`, `computed()`, `linkedSignal()` pour l'état réactif; Angular Forms Signals API (`form()`, `required()`, `submit()`) pour les formulaires. Styles en **SCSS** (voir `nx.json` et `apps/web/project.json`).
- **UI Frontend** : Taiga UI (`@taiga-ui/*`, v5.16.0) est la librairie standard. Utilisez `SHARED_IMPORTS` dans les imports de composants pour accéder à Taiga, CommonModule, FormField, DataTableComponent, PageLayoutComponent, etc. Ne pas redéclarer ces dépendances fréquemment.
- **Modèles consolidés** : tous les DTOs, interfaces, enums dans **un seul fichier** `apps/web/src/app/models/models.ts`. Quand vous ajoutez un nouveau type côté frontend, ajoutez-le là, pas dans des fichiers dispersés.
- **Services HTTP consolidés** : tous les services API dans **un seul fichier** `apps/web/src/app/services/api.services.ts`. Héritez de `CrudApi<T, P>` pour les ressources CRUD, surchargez `protected abstract readonly path` et ajoutez des méthodes métier si besoin. Exemple : `class ParticipantsApiService extends CrudApi<Participant, ParticipantPayload>`.
- **Tests** : `apps/api` et `libs/shared` utilisent Vitest explicitement (`import { describe, expect, it } from 'vitest'`), tandis que `apps/web` utilise le runner de test Angular avec `TestBed` dans `apps/web/src/app/app.spec.ts`.
- Le repo n'a pas de projet e2e ; ne cherchez pas de convention Cypress/Playwright déjà établie.

## Conseils spécifiques pour agents
- **Ajout de ressource API** : créez l'entité dans `apps/api/src/app/core/entities/`, créez un module de domaine avec service + contrôleur sous `apps/api/src/app/core/<domain>/`, enregistrez le module dans `CoreModule`, générez une migration. Suivez le pattern des modules existants (ex: `ParticipantsModule`).
- **Ajout de ressource frontend** : (1) ajoutez l'interface + payload type dans `models/models.ts`, (2) créez le service en étendant `CrudApi` dans `api.services.ts`, (3) ajoutez la route dans `app.routes.ts`, (4) créez la page feature sous `features/<domain>/`, (5) réutilisez `SHARED_IMPORTS` + `DataTableComponent` pour le rendu.
- **Partage de code** : exportez depuis `libs/shared/src/index.ts`, puis importez via `@mej-allegria/shared`. Limitez à DTOs/types que **les deux côtés** (web + api) consomment réellement.
- **Composants réutilisables** : préférez étendre `PageLayoutComponent` pour les pages standard (titre + slot actions), utiliser `DataTableComponent` pour les listes, ajouter les nouveaux composants à `SHARED_IMPORTS` s'ils sont fréquemment réutilisés.
- **Seeding en dev** : `npm run seed:api` (profil medium), `npm run seed:api:small`, `npm run seed:api:large`. Les seeders vivent dans `apps/api/src/database/seeds/seed.ts`.
- Quand vous ajoutez du code partagé, exportez-le depuis `libs/shared/src/index.ts` plutôt que d’importer des chemins internes de la lib.
- Quand vous ajoutez du backend persistant, créez l’entité + migration ensemble et utilisez `npm run migration:generate` / `npm run migration:run`.
- Quand vous ajoutez du frontend, partez du fait qu’il n’existe **pas encore** de client API, store global ou structure de feature modules : il faudra les introduire explicitement.
- Avant de conclure une modification, exécutez au minimum les tests/lint du ou des projets touchés plutôt qu’un contrôle générique du workspace entier si le changement est localisé : `nx test api`, `nx lint web`, etc.
