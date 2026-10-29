# Hébergement : groupes d'hébergement et placement des jeunes

Page : `/hebergement/placement` (onglet « Placement » de la page Hébergement).

## Modèle

- **Équipe de rassemblement** (`teams`) : les jeunes y sont toujours rattachés (`team_participants`).
- **Groupe d'hébergement** (`hosting_groups`, nouveau) : ensemble de familles d'accueil. Une équipe et une famille ont chacune au plus un groupe (`hosting_group_id`).
- **Placement** : une affectation existante `participant_host_family_assignments`. Règle : la famille doit être dans le groupe d'hébergement de l'équipe du participant.

Chaîne : équipe → groupe d'hébergement → familles du groupe.

## Écran

1. Étape 1 : glisser une équipe ou une famille dans un groupe (ou utiliser le menu « Groupe » de la carte, utile sur téléphone). Chaque groupe affiche personnes / places.
2. Étape 2 : choisir un groupe, puis glisser un jeune vers une famille, ou toucher le jeune puis « Placer ici ». Retirer : le glisser vers « À placer » ou « Retirer de sa famille ».
3. Placement automatique : calcule une proposition (visible en pointillés, rien n'est enregistré), puis « Appliquer » crée des affectations `PENDING` (« à confirmer »).

## Règles et limites

- Capacité (`maxCapacity`), mineurs (`maxUnder18`, mineur à la date d'arrivée) et animateurs (`maxAnimators`) sont contrôlés côté API, avec un verrou de ligne sur la famille : des placements simultanés ne dépassent jamais la capacité. Seules les affectations qui chevauchent les dates du séjour comptent.
- Règles NON confirmées par l'organisation, à choisir explicitement avant le placement automatique : les animateurs comptent-ils dans la capacité, et la mixité filles/garçons (aucune règle, éviter, interdire). L'API refuse d'appliquer sans ces deux choix. Le placement manuel contrôle la capacité en comptant les animateurs sauf indication contraire.
- Dates du séjour : celles de l'événement configurées dans l'application web, sinon le séjour déjà enregistré, sinon les dates du groupe de rassemblement.
- Le placement automatique ne déplace jamais une affectation existante. Les affectations existantes incohérentes avec équipe → groupe → famille sont listées, pas corrigées.
- Changer le groupe d'une équipe ou d'une famille, ou supprimer un groupe, est refusé tant que des personnes y sont placées.
- Les champs libres `constraints` et `tags` des familles ne sont pas interprétés : la famille est marquée « à relire ».
- Écriture réservée à `ADMIN`, `COORDINATOR`, `LOGISTICS`. Lecture : ADMIN, COORDINATOR, HEALTH, VOLUNTEERS, LOGISTICS, VIEWER.

## Groupes d'hébergement, hébergements collectifs, préparation du transport

- Un groupe a un type (`ZONE`, `PAROISSE`/`PARISH`, `OTHER`) et une couleur. Il est visible sur la carte (contour coloré, légende filtrante). Regroupement depuis la carte : sélection (cartes ou maisons), « Affecter », « Retirer du groupe », « Créer et affecter », « Regrouper par paroisse » (champ libre paroisse, sans déplacer une famille déjà groupée).
- API : `GET /hosting/groups` (liste légère), `PUT /hosting/families-group` (tout ou rien : 400 liste vide, 404 famille inconnue, 409 si déplacement d'une famille déjà placée), `POST /hosting/groups/from-parishes` (idempotent).
- Type d'hébergement : `FAMILY` ou `COLLECTIVE` (internat, plus grande capacité). Mêmes contrôles de capacité, mineurs et animateurs que pour une famille ; ce point reste à confirmer.
- Transport (page non construite) : une future table de transport référencera `hosting_group_id` (donc zone ou paroisse via `kind`), avec la distance au lieu de rassemblement déjà calculée côté carte, pour affecter un car à un groupe éloigné.

## Vérification

`node scripts/check-hosting-placement.mjs` (API et base réelles, données fictives du seed) : exécuté en CI après le test d'authentification.
