# Analyse du dépôt existant — préparation module planification de missions bénévoles

## Problème et approche

Le besoin est de préparer l’ajout d’un module de planification de missions bénévoles en **réutilisant l’existant** (utilisateurs, bénévoles, auth, rôles, RBAC, UI) sans modifier le schéma DB à ce stade.

Approche suivie : cartographier l’architecture web/api, les entités cœur (User, Role, Volunteer, Team, Participant), les mécanismes d’authentification et de récupération utilisateur courant, les conventions de migrations/tests/nommage, puis proposer une arborescence cible et les décisions techniques à trancher avant codage.

## 1) Résumé de l’architecture existante

- Monorepo Nx 23 avec `apps/web` (Angular standalone + Taiga UI + signals), `apps/api` (NestJS + TypeORM + PostgreSQL), `libs/shared`.
- Web :
  - Routing centralisé dans `apps/web/src/app/app.routes.ts`, lazy-loading des pages/features.
  - `authGuard` appliqué sur le layout principal ; `roleGuard` existe mais n’est pas branché sur les routes.
  - Services HTTP centralisés dans `apps/web/src/app/services/api.services.ts`.
  - Modèles front centralisés dans `apps/web/src/app/models/models.ts`.
  - Composants UI partagés dans `apps/web/src/app/shared/`.
- API :
  - Préfixe global `/api`, Swagger sous `/api/docs` (`apps/api/src/main.ts`).
  - Composition `AppModule -> CoreModule -> modules métier`.
  - Modules existants : auth, groups, participants, teams, team-participants, volunteers, host-families, assignments, participant-health.
  - Pattern backend : contrôleur mince, logique dans service, TypeORM via repository injection.

## 2) Fichiers importants à réutiliser

- **Frontend structure/auth**
  - `apps/web/src/app/app.routes.ts`
  - `apps/web/src/app/app.config.ts`
  - `apps/web/src/app/core/auth.service.ts`
  - `apps/web/src/app/core/auth.guard.ts`
  - `apps/web/src/app/core/role.guard.ts`
  - `apps/web/src/app/core/auth.interceptor.ts`
  - `apps/web/src/app/core/http-error.interceptor.ts`
- **Frontend data/services/UI**
  - `apps/web/src/app/services/api.services.ts`
  - `apps/web/src/app/models/models.ts`
  - `apps/web/src/app/shared/data-table.ts`
  - `apps/web/src/app/shared/ui-components.ts`
  - `apps/web/src/app/shared/shared-imports.ts`
- **Backend core/auth/entities**
  - `apps/api/src/app/core/core.module.ts`
  - `apps/api/src/app/core/entities/index.ts`
  - `apps/api/src/app/core/entities/user.entity.ts`
  - `apps/api/src/app/core/entities/role.entity.ts`
  - `apps/api/src/app/core/entities/volunteer.entity.ts`
  - `apps/api/src/app/core/entities/team.entity.ts`
  - `apps/api/src/app/core/entities/participant.entity.ts`
  - `apps/api/src/app/core/auth/auth.service.ts`
  - `apps/api/src/app/core/auth/auth-token.guard.ts`
  - `apps/api/src/app/core/auth/role.guard.ts`
  - `apps/api/src/app/core/auth/roles.decorator.ts`
  - `apps/api/src/app/core/auth/users.controller.ts`
- **DB / migrations / seed**
  - `apps/api/src/database/typeorm.config.ts`
  - `apps/api/src/database/migrations/*.ts`
  - `apps/api/src/database/seeds/seed.ts`

## 3) Entités et services existants à étendre

- Entités à **référencer** (pas recréer) pour le futur module :
  - `User` + `Role` + `UserRole` (RBAC existant),
  - `Volunteer` (profil bénévole, lien optionnel vers User),
  - `Team` (encadrement/groupement),
  - `Participant` (contexte mission possible),
  - éventuellement `Group` pour contexte diocèse/rassemblement.
- Services backend candidats à extension :
  - `VolunteersService` (sélection des bénévoles mobilisables),
  - `TeamsService` (liens équipe/encadrement),
  - `ParticipantsService` (si planification dépend des participants).
- Côté frontend :
  - ajouter un nouveau service API dans `api.services.ts` selon le pattern `CrudApi`.
  - ajouter types dans `models/models.ts`.
  - réutiliser `DataTableComponent` et `PageLayoutComponent` pour l’UI planning.

## 4) Risques d’intégration

- **Auth session en mémoire** (`Map` dans `AuthService` backend) : perte de session au restart API ; pas de persistance inter-instance.
- **Sécurisation hétérogène** : RBAC strict observé sur `participant-health`, moins visible ailleurs ; risque d’incohérence sur le nouveau module si non standardisé.
- **roleGuard front non branché dans le routing** : possible divergence UX vs autorisations backend.
- **Historique migrations chargé / redondant** : plusieurs `InitSchema*.ts` proches ; risque de confusion d’ordre réel appliqué.
- **Modèle bénévoles/équipes mixte** : `Volunteer.team` (texte libre) coexiste avec relation `Team` ; nécessite une source de vérité claire pour la planification.

## 5) Proposition d’arborescence pour le futur module (sans implémenter)

- Backend (dans `apps/api/src/app/core/`)
  - `missions/`
    - `missions.module.ts`
    - `missions.controller.ts`
    - `missions.service.ts`
    - `missions.types.ts`
    - (plus tard) entité(s) dédiée(s) dans `entities/` + migration associée
- Frontend (dans `apps/web/src/app/`)
  - `features/missions/`
    - `missions.ts` (page liste + filtres + drawer)
    - `missions.spec.ts`
  - extension de :
    - `services/api.services.ts` (ex: `MissionsApiService`)
    - `models/models.ts` (types `Mission`, payloads)
    - `app.routes.ts` (route lazy-load)
