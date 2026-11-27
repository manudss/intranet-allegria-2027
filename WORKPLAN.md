# Plan de travail — Groupes de rassemblement (PR unique)

Repo: /home/sandbox/alegria (clone manudss/intranet-allegria-2027, main 19162ef0)
Branche: feat/groupes-rassemblement
PAT: /home/sandbox/.vault/github-pat-allegria-code-2027-01-01-a7da16/password (sandbox-approved)
Règle: une seule PR (instruction utilisateur 23:12 vérifiée), périmètre = les 4 lots du plan validé, sans réduction. PR non fusionnée (l'utilisateur merge lui-même). Tests verts + lint avant push. Preview à la demande via commentaire /preview2 (compte Render secondaire).

## En parallèle
- Build File page plan: filebuild-01M8CYD85R9M945AHXMDPN7HCM (wake wakeschedule-01M8CXKKKQH5F0MSY29N0DEM3P, 15 min). Quand SUCCEEDED: preview check cloud browser, file read génération, publish (operation-id alegria-groupes-plan-pub2, 4 preview images), report lien+preuve. NE PAS publier l'ancien build obsolète filebuild-01M8CX744QTTJA5SS7R5M6R6N0.

## Tranches internes
1. [ ] Entités + migration: gathering_repartitions (id, name, program_sequence_id nullable, allow_overflow bool, count_animators bool, notes), gathering_groups (id, repartition_id, name, category TA/ES/COMMON, capacity_persons int null, location text null, notes), gathering_group_teams (group_id, team_id unique par répartition), gathering_group_volunteer_teams (group_id, volunteer_team_id), gathering_group_managers (group_id, user_id) ; team.track TA/ES/COMMON (défaut COMMON? à décider: seeds le fixent)
2. [ ] Droits: module GATHERING_GROUPS dans access-modules + defaults (ADMIN/COORDINATOR G, autres rien), garde fermée par défaut, portée "ses groupes" via gathering_group_managers (nouvelle mécanique scope)
3. [ ] API: CRUD répartitions + groupes, dispatch (assign/unassign équipe entière, contrôle piste, jauge, dépassement bloquant + dérogation MANAGE), proposition auto, duplication, fiche groupe (équipes, personnes prénoms seulement mineurs, bénévoles distincts, liens), alertes (autre piste, chevauchement, équipe modifiée, presque complet), tests Vitest PGlite
4. [ ] Web: page centrale /groupes-rassemblement (par jour/temps + bloc autonome), dispatch board (pattern hosting-placement), fiche groupe, intégration fiche événement + planning, menu + page-help + glossaire
5. [ ] Renommage UI: groupes diocésains → "Délégations" (libellés, menu, page-help, glossaire, person-picker "Groupe de rassemblement" → "Délégation")
6. [ ] Seeds: pistes TA/ES équipes, répartitions + groupes démo (jeu en 3 groupes, repas par lieux, groupe autonome), responsables démo
7. [ ] nx test api, nx test web, lint, build web+api, push, PR (titre/desc FR, réf. plan), /preview2, report parent

## Conventions repo
- Entités dans apps/api/src/app/core/entities + index.ts; module domaine sous core/<domain>; enregistrer dans CoreModule; migration dans apps/api/src/database/migrations (npm run migration:generate possible si DB locale, sinon écrire à la main en suivant les existantes)
- Web: modèles dans models/models.ts; services dans services/api.services.ts (CrudApi); features/<domain>/; SHARED_IMPORTS; PageLayoutComponent; DataTableComponent; Taiga UI v5; signaux; SCSS
- Droits: @AccessModule('CODE') + @AccessLevelRequired, gardes AuthTokenGuard+RoleGuard; portée groupes via @GroupScopeAware + @AccessScope()
- FR partout, dates jj/mm/aaaa, 24h, J1–J4 = 31/10–03/11, nom "Alegria"
- Style: cartes à ombres (pas de bordures), menu jaune, bandeau rose, skeletons Taiga
- Mineurs: prénom seulement; contacts derrière droits PARTICIPANTS
- Couleurs pistes: TA #fe0002, ES #00b2b2, COMMON #6b5f52; logos /assets/branches/ta.jpg, es.jpg
