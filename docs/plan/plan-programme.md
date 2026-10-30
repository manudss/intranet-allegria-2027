Plan — Module "Programme" (planification en chaîne des séquences)

État d'avancement (mis à jour 2026-10-13)

Fait :
- Phase 0 (prototype mocké frontend) entièrement implémentée et testée :
  - Modèles TypeScript (ProgramSequence, ScheduleSimulation, ScheduleChangeLog, previews) dans models/models.ts.
  - ScheduleEngineService (apps/web/src/app/features/programme/schedule-engine.service.ts) : calcul fin de créneau, recalcul de chaîne, simulation insertion 50/50 avec report/erreur, règle de réduction (avance la suite + marge libre fin), figement bloquant. 11 tests unitaires passants (schedule-engine.service.spec.ts).
  - planning-mock-data.service.ts : données mockées Allegria (chaîne J2 exemple).
  - UI du prototype (programme.ts / programme.html / programme.scss) : tui-timeline vertical, KPI, onglets jour/filtres, panneau de simulation, route /programme protégée par roleGuard, entrée menu « Agenda & Ordonnancement » (layout.ts). 4 tests composant passants (programme.spec.ts).
- Correction d'un bug critique de rendu `tui-timeline` (texte pivoté/superposé, conteneur effondré) signalé par l'utilisateur, comparé à l'exemple officiel Taiga UI. Détails techniques capitalisés ci-dessous car réutilisables pour la Phase 4 (drag-and-drop) et pour toute évolution de la frise.
- Vérifications passées après le correctif : `nx build web` OK (seulement warnings préexistants bundle/leaflet), `nx test web` 56/56 OK, `nx lint web` 0 erreur (9 warnings `no-non-null-assertion` préexistants dans les specs).

- Phase 1 entièrement implémentée (2026-10-13) :
  - Entités `ProgramSequence` / `ProgramChangeLog` + enums `ProgramSequenceStatus` / `ProgramChangeLogAction` dans core/entities (exportées via index.ts). IDs en `int` serial (cohérent avec le reste de l'API) ; le front mocké utilise des ids string → à adapter en Phase 2 (`p2-fe-integration`). `ProgramChangeLog` porte en plus une colonne `eventDate` (filtre du journal par jour).
  - Migration `1789200000000-CreateProgram.ts` écrite à la main et exécutée (la génération automatique embarquait de la dérive préexistante : renommage d'index/FK de volunteer_audit_logs, participants, volunteer_applications — non traitée ici, à nettoyer séparément). Note : le script `npm run migration:generate` est figé sur le nom `InitSchema` ; utiliser `npm run typeorm -- migration:generate <chemin>`.
  - `ProgramRecalcService` (apps/api/src/app/core/program/) : port fidèle du moteur front (buildChain, previewInsert, previewResize, applyInsert, applyResize), indépendant de TypeORM via `ProgramSequenceData`. 10 tests Vitest portés (program-recalc.service.spec.ts). `nx test api` 157/157, `nx lint api` et tsc OK.
  - Écarts volontaires vs moteur front : `applyInsert` renvoie `{ updated, followingSequenceId }` (la nouvelle séquence n'a pas d'id avant persistance ; l'appelant la crée puis reconnecte la suivante) ; `freeze`/`unfreeze` ne sont pas dans le moteur mais seront dans le service d'API (auteur + horodatage persistés). `ProgramRecalcService` n'est pas encore déclaré dans un module (fait en Phase 2).

- Phase 2 entièrement implémentée (2026-10-13) :
  - API : `ProgramModule` (enregistré dans CoreModule) — `ProgramController` / `ProgramService` / DTOs (`program.types.ts`) dans apps/api/src/app/core/program/. Routes : GET `/api/program/days/:date`, POST `sequences/:id/insert-after/preview|apply`, PATCH `sequences/:id/resize/preview|apply`, PATCH `sequences/:id/freeze|unfreeze`, GET `change-log?date=`. Mutations réservées ADMIN/COORDINATOR (guard `@Roles`), lecture pour ADMIN/COORDINATOR/HEALTH/ANIMATOR/LOGISTICS/VIEWER.
  - Protection contre la modification concurrente : l'aperçu renvoie une `version` (empreinte de la chaîne) ; l'application la relit sous verrou `pessimistic_write` dans une transaction, recalcule l'aperçu côté serveur (le client n'envoie jamais un diff à appliquer) et répond 409 si la version diffère. Application refusée (400) si outcome `impossible` ou `partial`. Redimensionner une séquence figée → 409.
  - Auteur + horodatage du figement et journal (`ProgramChangeLog` avec snapshots avant/après) sont déjà persistés réellement (une partie de la Phase 3 est donc faite côté serveur).
  - Validation manuelle dans le service (durée entier 1..1440, titre obligatoire, date YYYY-MM-DD), comme le reste de l'API (pas de class-validator).
  - Tests : 12 tests service (DataSource factice en mémoire), 8 tests contrôleur (rôles) ; `nx test api` 177/177. Vérifié aussi en réel via curl (login coordination/santé, aperçu, application, 409 sur version périmée, 403 pour santé sur mutation, journal).
  - Front : `ProgramApiService` dans api.services.ts ; modèles passés en ids `number`, previews avec `version` ; le composant `programme.ts` charge le jour via l'API et recharge après chaque mutation (le serveur est la source de vérité). UI/HTML/SCSS inchangés (seulement libellés).
  - Supprimés : `planning-mock-data.service.ts`, `schedule-engine.service.ts` et son spec (règles et 10 cas portés côté API ; ils restent récupérables via git). Remplacés par `schedule-chain.util.ts` (`buildChain` + `PROGRAM_EVENT_DAYS`). Le décalage d'un jour signalé (J1 = 10-29) venait de `toISOString()` sur une date locale : corrigé (calcul en UTC), J1 = 2027-10-30 = `ALLEGRIA_2027_EVENT_DATES.startDate`.
  - Seed : `seed.ts` crée désormais la chaîne J2 d'exemple (Grand Chapiteau + Salle A/B, un créneau figé) le 2027-10-31. Attention : le seed fait un TRUNCATE complet de la base de dev.
  - `nx test web` 51/51 (7 tests composant avec HttpTestingController + 3 tests util), `nx lint web` OK, `nx build web` OK.
  - Limites connues : il n'existe pas encore d'API pour créer la première séquence d'un jour/lieu vide ni supprimer/éditer une séquence (titre, lieu, équipe, liens) — à traiter en Phase 3 (édition des champs, liens documentaires). Les noms d'équipe (`volunteerTeamName`) viennent de la relation `volunteerTeam` mais le seed ne les renseigne pas.
  - Toujours à faire visuellement : confirmation en navigateur par l'utilisateur (rendu non vérifiable dans cet environnement).

- Phase 3 implémentée (2026-10-29) :
  - Constat avant reprise : Phases 0–2 terminées (non commitées). L'UI est en réalité un calendrier à grille horaire (blocs `sequence-block`, pas `tui-timeline`) avec glisser-déposer vertical déjà branché (déplacer un bloc = aperçu de redimensionnement du prédécesseur, jamais d'application directe) : l'essentiel de la Phase 4 existe donc déjà. Figement/défigement persistant, journal et vérification serveur des rôles étaient déjà faits en Phase 2.
  - API : `POST /api/program/sequences` (1re séquence d'un jour/lieu vide, ou tête de branche via `anchorSequenceId` ; 409 si le lieu contient déjà des séquences), `PATCH /sequences/:id` (titre, notes, équipe, durées/marges min, missions, liens documentaires — URLs http(s) uniquement, 20 max), `DELETE /sequences/:id` (séquence mobile uniquement, suivante reconnectée, 409 si figée ou si des branches y sont rattachées ; les horaires suivants ne sont PAS recalculés). Toutes réservées ADMIN/COORDINATOR et journalisées (nouvelle action `UPDATE` + migration `1789300000000-AddProgramChangeLogUpdateAction`).
  - Front : formulaires « Premier créneau / Nouveau lieu », « Modifier » (titre, équipe, notes, liens documentaires) et « Supprimer » ; filtre de lieu alimenté par les vraies données (branches comprises) ; **vue d'ensemble 4 jours en lecture seule** (jours → lieux → séquences, bouton « Ouvrir » vers l'éditeur).
  - Tests : `nx test api` 184/184 (+ création, édition, suppression, rôles), `nx test web` 55/55, `nx lint api|web` OK, `nx build web` OK.
  - La migration `1789300000000` n'a pas pu être exécutée (PostgreSQL arrêté) : lancer `npm run db:up` puis `npm run migration:run`.

Reste à faire :
- Exécuter la migration `1789300000000` et valider manuellement en navigateur (rendu non vérifiable ici).
- Renseigner `volunteerTeamId` dans le seed : FAIT (2026-10-30, équipes réparties en rotation sur la chaîne J2 ; à vérifier au prochain `npm run seed:api`).
- Édition des horaires de début d'une tête de chaîne et des missions liées (`missionIds` accepté par l'API, pas encore d'UI).
- Suppression : option de refermer l'écart horaire (aujourd'hui l'écart reste visible).
- Phase 4 restante (optionnel) : resize des blocs à la souris (le déplacement vertical existe déjà), réordonnancement par glisser-déposer entre séquences.
- Nettoyage : supprimer les logs à la racine (`build_site*.log`, `lint_site*.log`, `test_site*.log`) avant commit.

Anciennes entrées (obsolètes) :
6. `p3-advanced` — Figement/défigement persistant réel (auteur + horodatage), journal réel, liens documentaires configurables, filtres connectés aux données réelles, frise 4 jours en lecture seule, vérification serveur du rôle sur les mutations.
7. `p4-dragdrop` (optionnel, post-MVP) — Activer resizable/draggable sur tui-timeline, intercepter valueChange pour déclencher preview/apply au lieu d'une mutation directe.

Informations à savoir pour continuer (notamment pour Phase 1 et pour toute évolution de tui-timeline) :
- Convention backend : toute nouvelle entité va dans `apps/api/src/app/core/entities/`, réexportée via `index.ts` ; un module de domaine dédié (service + contrôleur minces) est enregistré dans `CoreModule` ; les migrations sont obligatoires (`synchronize: false`), via `npm run migration:generate` / `npm run migration:run`.
- `ScheduleEngineService` (frontend) sert de spécification exécutable : ses règles et ses cas de test (11 tests) doivent être reportés tels quels côté `ProgramRecalcService` (Vitest apps/api) pour garantir la parité de comportement entre le prototype validé et le moteur réel.
- Détails internes critiques de `tui-timeline` (Taiga UI ^5.16.0), à connaître avant toute modification de la frise ou activation du drag-and-drop en Phase 4 :
  - Sélecteurs : composant `tui-timeline`, item `label[tuiTimelineItem]` (doit être un `<label>` littéral).
  - Le host `tui-timeline` a `transform: translateZ(0)` (crée un contexte de positionnement pour les enfants absolus) mais aucune taille explicite : il faut fixer une hauteur/largeur en pixels explicite sinon le conteneur s'effondre. Dans le prototype, hauteur calculée via `timelineHeightPx` (minutes × 2.5px, plancher 480px), cohérente avec `timelineMax` (bornes de la frise).
  - `tui-timeline[data-orientation=vertical]` a `writing-mode: vertical-lr`, hérité par les enfants. Les propriétés logiques (`inline-size`, `inset-inline-start`) de `label[tuiTimelineItem]` se résolvent donc selon ce writing-mode hérité (inline-size→hauteur, inset-inline-start→offset haut) : NE PAS réinitialiser le writing-mode sur le label lui-même, seulement sur le contenu interne (notre `.sequence-card`), comme dans la démo officielle Taiga.
  - `pointer-events: none` est hérité depuis l'item host : tout contenu interactif interne doit avoir `pointer-events: auto` explicite.
  - La hauteur d'un item est strictement proportionnelle à sa durée (% du conteneur) : pour éviter le chevauchement sur des créneaux courts, on applique un plancher CSS `min-inline-size: 11rem` sur `label[tuiTimelineItem]` et `overflow: hidden` sur le contenu de carte (dégradation gracieuse plutôt que superposition).
- Problème mineur non résolu, à vérifier si levé par l'utilisateur ou pertinent lors du câblage des vraies dates en Phase 1/2 : léger décalage potentiel d'un jour entre `PROGRAM_EVENT_DAYS`/`dayOffset()` dans `planning-mock-data.service.ts` et `ALLEGRIA_2027_EVENT_DATES.startDate` ('2027-10-30' attendu vs J1 affiché '2027-10-29').
- Limitation d'environnement : impossible de rendre/visualiser l'application dans ce contexte d'exécution ; toute vérification de rendu passe par build/test/lint + relecture manuelle du CSS, une confirmation visuelle en navigateur par l'utilisateur reste nécessaire après chaque évolution de la frise.

Problème
Il n'existe aujourd'hui qu'un programme statique en dur (apps/site/.../programme.content.ts), sans notion de créneaux chaînés, de recalcul automatique, ni de figement. Le besoin décrit (squelette métier joint) demande un module de planification interne (intranet, équipe de coordination uniquement) permettant de :

modéliser le programme de 4 jours comme des chaînes de séquences par lieu, avec branches parallèles rattachées à un repère commun ;
insérer un créneau en répartissant l'impact sur les deux voisins (sauf créneaux figés) ;
modifier une durée en répercutant l'écart sur la suite flexible (réduction ⇒ on avance la suite et on laisse une marge libre en fin de programme, règle retenue pour le MVP) ;
figer explicitement un créneau (action réservée coordination, horodatée, traçable) ;
prévisualiser («avant / après») tout recalcul avant application ;
journaliser chaque changement (auteur, date, séquences affectées) ;
lier chaque séquence à des missions/responsables et à des documents de l'espace partagé (simple lien URL, pas de stockage de fichiers) ;
restreindre l'édition à l'équipe de coordination (rôle COORDINATOR/ADMIN), lecture ouverte aux autres rôles pertinents.
Hors périmètre MVP (explicitement reporté) : optimisation automatique globale, notifications avancées, gestion disponibilité/affectation bénévoles, exports personnalisés par équipe (l'export existant du dashboard opérationnel n'est pas étendu ici).

Approche
Nouveau domaine program suivant le pattern établi (apps/api/src/app/core/<domain>/ + entités dans core/entities/ + module enregistré dans CoreModule), avec la logique de recalcul isolée dans un service dédié testable unitairement (indépendant de la couche HTTP), et un flux preview → confirm → apply côté API pour que le frontend affiche systématiquement l'aperçu avant validation (jamais d'application directe sans preview côté UI).

Frontend : nouvelle feature features/programme/ dans apps/web (distincte du site public), route protégée par roleGuard (coordination), avec un éditeur de journée en liste ordonnée pour le MVP (pas de drag-and-drop dans un premier temps — le réordonnancement se fait via formulaire et boutons monter/descendre), puis une frise 4 jours en lecture pour la vue d'ensemble. Le drag-and-drop (mentionné à titre d'inspiration FullCalendar dans le brief) est une amélioration UI de confort, pas un prérequis de la logique métier ; il est repoussé en fin de plan pour ne pas bloquer la livraison du moteur de recalcul.

Modèle de données (entités)
ProgramSequence : id, eventDate (YYYY-MM-DD), location (texte libre ou lien vers lieu existant si disponible), title, startTime, durationMinutes, endTime (calculé, persistant pour requêtes simples), status (MOBILE | FROZEN), minDurationMinutes (nullable), minMarginMinutes (nullable), previousSequenceId (chaîne principale, nullable = tête de chaîne du jour), anchorSequenceId (repère commun pour les branches parallèles, nullable), volunteerTeamId (nullable, FK équipe responsable), missionIds (relation vers VolunteerMission, optionnelle), documentLinks (jsonb, liste d'URLs + libellés), notes, frozenByUserId, frozenAt, createdAt, updatedAt.
ProgramChangeLog : id, action (INSERT | RESIZE | MOVE | FREEZE | UNFREEZE | DELETE), authorUserId, createdAt, affectedSequenceIds (jsonb), beforeSnapshot (jsonb), afterSnapshot (jsonb), comment (nullable).
Moteur de recalcul (service)
Un ProgramRecalcService pur (sans dépendance HTTP) expose :

previewInsert(dayDate, afterSequenceId, newSequenceDraft) → calcule le partage 5/5 min (ou report total sur le seul voisin disponible, ou statut "impossible sans décision manuelle" si aucun voisin ne peut absorber compte tenu des durées minimales/figement) et retourne un objet de diff (séquences touchées, anciennes/nouvelles durées, nouvelle heure de fin).
previewResize(sequenceId, newDurationMinutes) → agrandissement : répartit le delta sur les créneaux flexibles suivants les plus proches (jamais sur un figé, jamais en remontant avant la séquence modifiée) ; réduction : avance la suite flexible et laisse une marge libre en fin de journée (règle actée pour le MVP), s'arrête au premier créneau figé rencontré et le signale.
previewMove (changement d'ordre/d'ancrage) → même logique de diff, réservé à une itération ultérieure si le temps du MVP ne suffit pas (cf. todos optionnels en fin de liste).
apply(previewToken | previewPayload) → relit l'état courant (protection contre une modification concurrente), applique les changements en transaction, écrit un ProgramChangeLog.
Toute méthode qui rencontre un créneau figé s'arrête à cette frontière et renvoie les options possibles (reporter sur l'autre voisin, décaler la suite, échec explicite) plutôt que de modifier silencieusement le figé.

API (contrôleur program)
GET /api/program/days/:date — chaîne complète du jour (branches incluses).
POST /api/program/sequences/:id/insert-after/preview et /apply
PATCH /api/program/sequences/:id/resize/preview et /apply
PATCH /api/program/sequences/:id/freeze / /unfreeze (COORDINATOR/ADMIN uniquement, horodatage + auteur stockés)
GET /api/program/change-log?date=... — journal des changements
Toutes les routes de mutation protégées par un guard de rôle (réutiliser le pattern des guards existants, restreindre à ADMIN/COORDINATOR), lecture ouverte aux rôles qui ont déjà accès au dashboard opérationnel.
Frontend
models/models.ts : ProgramSequence, ProgramSequenceStatus, ProgramChangeLogEntry, types de preview (ProgramInsertPreview, ProgramResizePreview).
services/api.services.ts : ProgramApiService (pas un CrudApi standard — actions métier dédiées preview/apply/freeze).
features/programme/ :
programme-day-editor : liste ordonnée des séquences d'un jour/lieu, édition par formulaire (heure, durée, figé, lieu, mission/équipe, liens documentaires), boutons insérer/supprimer, bouton figer/défiger (rôle coordination).
programme-preview-dialog : tableau avant/après (séquences touchées, anciennes/nouvelles durées, nouvelle heure de fin, conflits) avec confirmation/annulation avant apply.
programme-frise (vue d'ensemble) : 4 jours navigables, lieux en lignes, lecture seule pour le MVP, lien de navigation vers l'éditeur de jour/lieu concerné.
programme-changelog : liste du journal des changements (auteur, date, séquences).
Route programme dans app.routes.ts, protégée par roleGuard (édition : COORDINATOR, ADMIN ; lecture : ajouter les rôles qui consultent déjà jour-j/suivi-operationnel).
Design UI — réutilisation de tui-timeline (Taiga UI)
Le composant @taiga-ui/kit tui-timeline (+ label[tuiTimelineItem]) est disponible dans la version installée (@taiga-ui/kit ^5.16.0) et correspond exactement au besoin : orientation vertical, items avec value: [start, end], options draggable/resizable, min/max par item. On l'utilise comme colonne vitrine de la chaîne séquentielle (au lieu de cartes DOM libres façon mockup Tailwind), ce qui nous évite de réimplémenter à la main le rendu temporel et nous donne gratuitement une base pour le glisser-déposer différé (todo program-fe-dragdrop).

Mapping écran (reprend l'intention du mockup fourni, pas ses couleurs en dur) :

Topbar / sidebar : réutiliser le Layout existant de l'intranet (pas de nouvelle topbar bordeaux ni sidebar orange custom — on reste cohérent avec equipes-operationnelles, jour-j, etc.). Nouvelle entrée de menu « Agenda & Ordonnancement » sous une section « Jour J & pilotage » si une telle hiérarchie de menu existe déjà, sinon entrée plate.
En-tête de page : PageLayoutComponent (titre « Planning & Ordonnancement », description, slot actions : « Journal des modifications », « Exporter » (plus tard), bouton primaire « Nouveau créneau »).
Onglets jour (J1..J4) + filtres lieu/branche : tui-tabs (ou segmented control Taiga) + tui-select ; valeur réactive en signal(), pas de tabs custom en CSS.
Cartes KPI (séquences / mobiles / figées / branches / décalage simulé / fin conforme) : petits composants tui-card/tui-badge réutilisant --tui-positive (fin conforme), --tui-warning (figées, décalage), --tui-info/--tui-primary (mobiles), pas de bleu/jaune codés en dur comme dans le mockup.
Chaîne séquentielle (colonne gauche ~70%) : tui-timeline en orientation verticale ; un tuiTimelineItem par séquence de la chaîne principale, value dérivée de [startMinutes, endMinutes], min/max dérivés de minDurationMinutes et de l'heure de fin du jour. Contenu projeté dans chaque item : réutilisation de sequence-status-badge (mobile / figé), lieu, responsable, documents (sequence-documents), et pour « Ateliers thématiques par branche » un sous-bloc parallel-branches avec le badge « N voies parallèles » rattaché au même point d'ancrage (le modèle anchorSequenceId du plan précédent sert ici de point de rattachement visuel des branches sur la frise verticale).
MVP : resizable/draggable désactivés (lecture + formulaire d'édition uniquement) pour ne pas mélanger manipulation directe du DOM et flux preview/apply côté métier.
Itération ultérieure (todo program-fe-dragdrop) : activer resizable sur les items mobiles ; intercepter valueChange pour déclencher previewResize/previewInsert au lieu de laisser le composant muter l'état directement, puis n'appliquer qu'après confirmation dans le panneau de droite (jamais d'application silencieuse, conforme à la règle de figement).
Zone de simulation d'insertion : un item spécial injecté temporairement dans la timeline (style pointillé, token --tui-warning/--tui-info selon statut), visible uniquement tant que currentSimulation() est non nul.
Panneau de droite (aperçu du recalcul, ~30%, sticky) : tui-card sticky (position: sticky en SCSS, pas de composant Taiga dédié au sticky) contenant la règle appliquée, un schedule-comparison-table (tableau simple, pas besoin de @taiga-ui/addon-table pour 2-3 lignes), des bandeaux de statut (tui-notification inline ou bandeau custom avec --tui-positive/--tui-warning/--tui-negative), et les deux boutons d'action (tui-button primaire « Confirmer et appliquer », secondaire « Annuler »).
Journal des modifications : tui-dialog (ou route dédiée) listant ProgramChangeLog.
Toast de confirmation : service tui-alert/TuiAlertService existant de Taiga plutôt qu'un composant toast custom.
Cette approche conserve l'esprit du mockup (densité d'info, hiérarchie claire, panneau de simulation fixe à droite, indicateurs de statut immédiatement lisibles) tout en restant dans le design system déjà en place (SHARED_IMPORTS, tokens --tui-*), sans dupliquer une charte graphique bordeaux/orange parallèle à celle de l'intranet.

Plan progressif d'implémentation
Le prompt de prototype fourni (mock complet, sans backend, avec ScheduleEngineService testable) est une excellente étape intermédiaire : il permet de valider les règles métier et l'UX avec la coordination avant d'investir dans entité/migration/API. On l'intègre donc comme Phase 0 du plan, directement dans apps/web (pas un projet à part), de façon à ce que le code produit soit réutilisable (même structure de composants, même nommage de types) pour les phases suivantes — le ScheduleEngineService mocké de la phase 0 devient la spécification exécutable du ProgramRecalcService backend de la phase 1 (mêmes cas de test portés côté Vitest API).

Phase 0 — Prototype interactif mocké (frontend only)

Composants listés dans le brief (planning-page, sequence-chain via tui-timeline, recalculation-preview, schedule-comparison-table, etc.), données en dur (planning-mock-data.service), ScheduleEngineService avec la logique complète d'insertion répartie 50/50 + cas d'erreur, mais sans appel réseau.
Objectif : valider l'ergonomie (timeline verticale, panneau sticky, badges figé/mobile, simulation avant/après) et figer les règles de calcul par des tests unitaires avant de les committer côté API.
Pas de route protégée par rôle à ce stade si le prototype est de démonstration isolée ; sinon rattacher directement à /programme derrière roleGuard dès cette phase pour éviter un deuxième emplacement de code à migrer ensuite.
Phase 1 — Moteur de recalcul backend + modèle de données

Porter ScheduleEngineService en ProgramRecalcService NestJS (mêmes règles, mêmes tests portés en Vitest apps/api), entités ProgramSequence/ProgramChangeLog, migration.
Le frontend ne change pas encore de comportement visible ; c'est un travail d'alignement backend sur la spécification validée en phase 0.
Phase 2 — API + branchement du frontend

Contrôleur program (CRUD lecture + preview/apply + freeze/unfreeze + change-log), DTOs.
Remplacement de planning-mock-data.service par ProgramApiService (HTTP réel) dans les composants de la phase 0, sans réécrire l'UI — seule la source de données change.
Tests API (contrôleur + service), tests frontend mis à jour avec un service HTTP mocké (HttpTestingController) à la place du mock data service.
Phase 3 — Fonctionnalités de coordination avancées

Figement/défigement persistant avec auteur + horodatage réels (plus mock), journal des modifications réel, liens documentaires réellement configurables par séquence, filtres lieu/branche connectés aux données réelles, frise 4 jours en lecture (vue d'ensemble).
Restriction d'édition stricte par rôle (roleGuard + vérification serveur) sur toutes les mutations.
Phase 4 — Confort d'édition (optionnel, post-MVP)

Activation de resizable/draggable sur tui-timeline avec interception valueChange pour déclencher preview/apply au lieu d'une mutation directe ; drag-and-drop de réordonnancement.
Todos
(voir table SQL todos pour le suivi ; résumé ci-dessous dans l'ordre de dépendance/phase)

Phase 0 — Prototype mocké

Modèles TypeScript du prototype (ProgramSequence, ScheduleSimulation, ScheduleChangeLog, etc.) dans models/models.ts.
ScheduleEngineService mocké (calcul fin, recalcul chaîne, simulation insertion 50/50 avec reports/erreurs, verrou) + tests Vitest/TestBed complets.
planning-mock-data.service (données Allegria mockées : chaîne J2 de l'exemple).
UI du prototype : tui-timeline vertical (chaîne), KPI, onglets jour/filtres, panneau de simulation sticky, dialogues (journal, nouvelle séquence), toasts — route /programme derrière roleGuard coordination.
Phase 1 — Moteur + modèle de données backend

Entités ProgramSequence + ProgramChangeLog + enums, portage des règles validées en phase 0.
Migration TypeORM.
ProgramRecalcService NestJS (mêmes règles que le service mocké) + tests Vitest portés.
Phase 2 — API + branchement réel

Module program (contrôleur + DTOs preview/apply/freeze/change-log), enregistrement dans CoreModule, tests API.
ProgramApiService frontend, remplacement du mock data service dans les composants de la phase 0 (HttpTestingController dans les tests).
Phase 3 — Fonctionnalités avancées

Figement/défigement, journal, documents et filtres connectés aux données réelles ; frise 4 jours en lecture seule ; vérification serveur du rôle coordination sur les mutations.
Phase 4 — Confort (optionnel, post-MVP)

resizable/draggable sur tui-timeline avec interception valueChange → preview/apply.
Notes et décisions prises en compte
Règle de réduction de durée retenue pour le MVP : avancer les créneaux flexibles suivants et laisser une marge libre en fin de programme (plus prévisible, pas de redistribution surprise).
Le figement est une action explicite réservée à la coordination ; toute action de recalcul qui bute sur un figé s'arrête et propose des choix plutôt que de l'altérer.
Les documents restent dans l'espace partagé externe ; le programme ne stocke que des liens.
Seule l'équipe de coordination (COORDINATOR/ADMIN) peut modifier le programme ; les autres rôles concernés ont un accès en lecture seule.
Le drag-and-drop n'est pas un prérequis du moteur de recalcul ; il est repoussé en fin de plan pour ne pas retarder la livraison des règles métier (insertion, redimensionnement, figement, journal).
