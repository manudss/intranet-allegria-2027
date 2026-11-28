# Transports pendant le rassemblement

État : implémenté (PR en cours), maquette validée par Emmanuel le 28/11/2026 à 15h41 (WhatsApp : « Oui c'est bien, tu peux faire cela »).
Maquette de référence : https://files.instinct.com/pitykg2ufhdm-maquette-transports-du-rassemblement (privée).

## Ce que fait l'écran

Page « Transports » (`/transports`, droit TRANSPORT existant, inchangé) :

- **Panneau gauche : groupes et lieux à desservir** — groupes d'hébergement (avec leurs familles d'accueil et hébergements collectifs) et hébergements collectifs hors groupe, avec l'effectif logé (affectations famille d'accueil non annulées).
- **Panneau droit : cars** — nom, jauge facultative, dates de circulation, arrêts, personnes ajoutées/retirées.
- **Sélection puis affectation** : on sélectionne des groupes/lieux à gauche, on sélectionne un car à droite, puis « Affecter ». Glisser-déposer possible sur bureau (les boutons restent l'alternative, mobile compris).
- Un car peut desservir **plusieurs** groupes/lieux ; un groupe/lieu n'est desservi que par **un** car (contrainte unique en base).
- **Mobile : deux étapes** — un onglet « À desservir » / « Cars » en haut d'écran, l'affectation se fait par les boutons.

## Règles de la maquette : implémentées comme PROPOSITIONS

La validation de la maquette valait périmètre d'écran, pas décision métier. Ces règles sont codées comme proposées, à confirmer par Emmanuel :

1. **Arrêts multiples avec horaires** — un car a une liste ordonnée d'arrêts (libellé + heure facultative).
2. **Dates de circulation du car** — liste de dates ISO ; vide = non précisé.
3. **Groupes ET exceptions par personne** — une personne peut être ajoutée à un car qui ne dessert pas son lieu, ou retirée d'un car qui le dessert.
4. **Jauge facultative et non bloquante** — jauge vide = sans limite ; dépassement = avertissement, jamais de blocage.
5. **Nouvelle table** séparée des trajets délégués — les cars du rassemblement ne touchent ni les trajets délégations, ni leurs exceptions, ni leurs notes.

Non touché (comme annoncé dans la maquette) : trajets des délégations, exceptions et notes de trajets, droits (TRANSPORT scope ALL existant).

## Modèle de données

Migration `1791300000000-GatheringCars` :

- `gathering_cars` : name, capacity (null = sans jauge), service_dates (text[] ISO, null = non précisé), notes.
- `gathering_car_stops` : car_id, order_index, label, time (null).
- `gathering_car_assignments` : car_id, target_type (HOSTING_GROUP | HOST_FAMILY), hosting_group_id / host_family_id ; index unique partiel = un car par cible.
- `gathering_car_persons` : car_id, participant_id, kind (ADDED | REMOVED).

L'effectif d'un car = somme des effectifs logés des cibles + ajouts − retraits. Avertissement si dépassement de jauge, pas de blocage.

## API

Module `GatheringTransportsModule` (`apps/api/src/app/core/gathering-transports/`), routes sous `/gathering-transports`, gardées par `@AccessModule('TRANSPORT')` (scope ALL : ADMIN/COORDINATOR/LOGISTICS + COORDINATION/LOGISTIQUE_TRANSPORTS — aucun droit nouveau).

- `GET /gathering-transports/board` — cibles + cars en une réponse.
- CRUD cars : `POST/GET/PATCH/DELETE /gathering-transports/cars[/:id]`.
- `PUT /cars/:id/stops` — remplace la liste d'arrêts.
- `PUT /cars/:id/assignments` — remplace les cibles du car (409 si une cible est déjà desservie ailleurs).
- `POST /cars/:id/persons`, `DELETE /persons/:id` — exceptions individuelles.

## Web

`apps/web/src/app/pages/transports.{ts,html,scss}` (page réécrite), `transports-api.service.ts`, `transports-board.logic.ts` (+ spec). Réutilise `ConfirmDialogService`, `PersonPickerComponent`, `SelectFieldComponent`, `ALLEGRIA_2027_EVENT_DATES`, styles `shared/crud.scss` (jauge-bar).

## Seeds

`apps/api/src/database/seeds/seed.ts` : 4 cars fictifs couvrant tous les cas — car avec 2 arrêts horaires, car plein à la jauge avec retrait individuel, car sans affectation avec ajout individuel, navette ciblant un hébergement collectif. Joué par le seed standard (lancé sur /preview).

## Continuité

- Branche `feat/transports-rassemblement` créée depuis `origin/main` (PR55+PR56 mergées). Aucun recouvrement de fichiers avec PR58 (`feat/delegations-finition`) hormis aucun : `entities/index.ts` et `core.module.ts` sont touchés ici mais pas par PR58 ; si PR58 merge d'abord, aucun conflit attendu.
- L'agent correcteur de PR58 possède `gathering-dispatch.page.*` (correctif mobile) : ne pas y toucher ici.
- Tests : `gathering-transports.service.spec.ts` (API), `transports-board.logic.spec.ts` (web).
