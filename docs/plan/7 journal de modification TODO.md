Ajoute un journal des modifications pour le module bénévoles.

Crée VolunteerAuditLog :

- id integer ;
- userId clé étrangère vers users.id ;
- action enum :
  CREATE,
  UPDATE,
  DELETE,
  STATUS_CHANGED,
  ASSIGNMENT_CHANGED ;
- entityType varchar(100) ;
- entityId integer ;
- beforeData jsonb nullable ;
- afterData jsonb nullable ;
- createdAt timestamptz.

Trace les modifications sur :

- volunteers si le module les modifie ;
- volunteer_teams ;
- volunteer_team_memberships ;
- volunteer_skills ;
- volunteer_tags ;
- volunteer_availabilities ;
- volunteer_missions ;
- volunteer_shifts ;
- volunteer_shift_assignments.

Ne trace pas :

- les lectures ;
- les mots de passe ;
- passwordHash ;
- les tokens ;
- les données de santé des participants ;
- les données sans rapport avec la modification.

Implémente un mécanisme cohérent avec l’architecture existante :

- interceptor NestJS ;
- subscriber TypeORM ;
- ou service d’audit centralisé.

Le journal doit conserver :

- l’utilisateur à l’origine de l’action ;
- l’entité ;
- l’identifiant ;
- l’action ;
- les données avant ;
- les données après ;
- la date.

Permissions :

- ADMIN : lecture complète ;
- COORDINATOR : lecture complète ;
- autres rôles : aucun accès au journal, sauf règle existante explicitement prévue.

Ajoute :

- migration ;
- entité ;
- service ;
- endpoint paginé ;
- filtres par période, utilisateur, action et type d’entité ;
- écran Angular réservé à ADMIN et COORDINATOR ;
- tests.
