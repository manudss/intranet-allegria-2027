# Groupes attendus : modèle de données (étape 2)

Cette étape prépare les données et leurs requêtes. Aucun écran ni endpoint de
modification de groupe n'est encore livré. Cette migration seule ne change pas
les décisions de scan. Le scan demeure individuel. Le besoin demandé inclut
maintenant un refus hors groupe avec dérogation tracée : son autorisation et sa
politique hors ligne restent à préciser avant implémentation.

## Tables

- `access_expected_groups` : nom, archivage, version et auteur.
- `access_expected_group_sources` : union de sources. Chaque ligne référence
  exactement une équipe de participants, un type de personne, une personne ou
  un bénévole. Les sources sont uniques au sein d'un groupe.
- `access_expected_passages` : rattachement à un point, type de scan, service
  éventuel et fenêtre temporelle `[début, fin[`, avec fuseau d'affichage. Les
  fenêtres sont bornées à 31 jours, comme le reporting existant.

La composition est actuelle, pas une photographie historique. Les sources
équipes incluent leurs participants et leurs responsables bénévoles principal
et secondaire. Les équipes bénévoles logistiques sont un autre objet et ne
sont pas implicitement assimilées aux équipes de participants.

Les sources dynamiques sont une proposition de fonctionnement, à confirmer avec
la maquette avant leur exposition en modification. L'historique sur composition
actuelle et le scan individuel ont été demandés explicitement.

## Identité et confidentialité

Les participants confirmés sont éligibles. Les bénévoles sans projection de
participant restent présents dans les listes d'attendus. Une lecture ne crée
jamais une projection, un badge ou une affectation. Leur clé de lecture
`volunteer:<id>` ne change pas lorsqu'une projection est ensuite créée. Les
projections existantes et bénévoles sont dédupliqués. Le nom des jeunes n'est
pas renvoyé. Les événements continuent de suivre leur personne d'origine,
indépendamment des remplacements de badge.

## État d'un passage attendu

Pour le point, type, service et fenêtre du rattachement :

1. `CONFIRMED` : au moins un événement `ACCEPTED`, sans `needs_review`.
2. `REVIEW_ONLY` : aucun passage confirmé et au moins un événement ambigu.
3. `NOT_CONFIRMED` : le reste, y compris sans badge, sans scan reçu ou refus.

Ces états sont disjoints et leur somme égale l'effectif actuel attendu. Un
passage confirmé l'emporte sur une autre tentative ambiguë du même service.
Un refus, un doublon seul, un mauvais point ou un autre service ne valide pas
le passage. Une clôture de vérification conserve le verdict et l'ambiguïté.
Les scans hors ligne non reçus ne peuvent pas être comptés. Ces listes ne
constituent pas une preuve d'absence, une recherche de personne ou un décompte
d'évacuation.

## Implémenté dans la PR32 (non déployé)

- Gestion API des groupes, sources et rattachements avec audit transactionnel et
  contrôle de version ; validation point/type/service, fenêtre et fuseau.
- Refus hors groupe et dérogation transactionnelle : droit explicite par point,
  motif obligatoire, connexion requise, ajout pour ce passage seulement, choix
  du groupe par le contrôleur. Aucun contournement de badge révoqué/inconnu,
  doublon de repas ou restriction de sécurité. Le refus initial reste inchangé.
- Trace auteur, date, motif, session, événements initial et accepté, opération
  idempotente. L'exception est distincte de l'état du passage.
- Parcours mobile V5 et lectures web V5 exceptions / non scannés, avec compteurs,
  filtres, recherche et pagination serveur. Les noms des jeunes restent masqués.
- Les lectures de listes et compteurs utilisent un même snapshot transactionnel.

## Suite avant utilisation

- Vérifier le parcours intégré sur une vraie base et plusieurs appareils,
  les reprises réseau et un essai papier/caméra. Les contrôles de rendu locaux
  utilisent des données fictives et ne remplacent pas ces essais.
- Obtenir validation des autres écrans V3/V4 avant toute UI correspondante.
- Ne pas additionner les effectifs de groupes qui se recoupent. Le bloc impact
  V5 concerne seulement le passage sélectionné, pas un total intergroupes.
- Pour une même personne attendue à plusieurs points du même service, signaler
  la contradiction à l'admin, ne pas choisir silencieusement.

Les migrations ne sont pas appliquées à une preview par ce commit. Aucun merge
ni nouvelle preview sans demande.

## Activation et appareils hors ligne

Créer un rattachement active durablement `expected_online_required` sur le point.
Archiver ses groupes ne réactive pas le mode hors ligne. Les nouvelles sessions,
les deltas et le choix d'un point reflètent cette politique. Un ancien appareil
déjà déconnecté ne peut pas recevoir un changement : l'activation opérationnelle
exige reconnexion et redémarrage de ses sessions avant le service. Ne pas annoncer
une révocation instantanée hors réseau. Les scans non envoyés restent conservés.

## Essai preview via seed QR

Le reseed existant crée un point séparé `QR-DEMO · Groupe attendu (en ligne)`
avec son groupe de 5 membres normaux et une exception préenregistrée. Les
compteurs initiaux sont 6 attendus effectifs, 2 confirmés, 1 à vérifier seul et
3 sans confirmation. Le passage et le droit de dérogation expirent sept jours
après le seed. Aucun point repas existant n'est modifié par ce scénario.

- `qr.scanner.a@allegria.local` : peut confirmer une exception sur ce point.
- `qr.scanner.b@allegria.local` : peut scanner, sans droit de dérogation.
- `Animateur` : membre normal, badge valide, à scanner.
- `Presence Sorti` / `Presence Reentre` : hors de ce groupe, badges valides,
  disponibles pour essayer une nouvelle dérogation avec motif.
- `Badge Revoque` : ne doit pas être accepté par exception.

Se connecter à l'administration avec le compte de démo pour consulter les
listes et préparer les badges du lot `QR-TESTKIT`. Le seed est le seul mécanisme
de création de ces données. La base preview/pr-32 est distincte des autres PR
et de production ; un reseed efface ses essais précédents.

## Dashboard et détail par point (suite V3, non redéployée)

Les routes `/acces/dashboard` et `/acces/scannes` lisent les compteurs et le
journal paginé. Le dashboard s'actualise toutes les 15 secondes seulement
quand l'onglet est visible, sans requête en cours et sans filtre en cours
d'édition. Pause/reprise et actualisation manuelle sont disponibles. En cas
d'échec, les résultats précédents et leur heure restent affichés avec alerte.
Les filtres de période/type de scan sont transmis au lien Détails du point.
Le détail sépare personnes acceptées, toutes les tentatives et scans à vérifier.
La pagination/recherche sont côté serveur ; les compteurs ne sont pas une
preuve d'absence. Les autres pages d'historique et gestion restent à compléter.

### Historique individuel

Écran `/acces/historique-personne` : recherche paginée indépendante du passage attendu, y compris personnes sans badge et bénévoles sans projection ; événements paginés par participant sur 1 à 31 jours, filtres point/type/verdict indépendants. Les liens depuis les détails par lieu ne transmettent que l’identité. Tous les verdicts et vérifications restent visibles après remplacement d’un badge. Aucun nouveau participant ni badge n’est créé par la consultation.

### Historique groupe

`/acces/historique-groupe` consulte la composition actuelle d'un groupe attendu, indépendamment d'un passage précis. Journal de toutes les tentatives reçues des membres actuels, liste des membres et membres sans accepté sans ambiguïté. Les exceptions de passage seules ne changent jamais cette composition et restent consultables dans le suivi du passage. Les compteurs membres utilisent la période et le point, tous résultats confondus ; le filtre verdict ne concerne que le journal. Recherche de groupes, journal et membres paginés côté serveur. Le statut sans accepté n'affirme ni absence physique ni défaut de droit.

### Gestion V4 des groupes et rattachements

`/acces/groupes` gère nom/état, union des sources équipe/type/personne, composition enregistrée paginée et rattachements par groupe. Les noms des jeunes sont masqués dans les libellés des sources. Les doublons de sources ne sont pas ajoutés dans le formulaire ; le serveur déduplique les personnes à la résolution. Un brouillon n'est jamais présenté comme une nouvelle composition calculée. Les modifications de groupe et passage portent leur version ; un conflit conserve les champs et demande un rechargement explicite.

Les rattachements reprennent obligatoirement le type et le service du point actif. Dates saisies explicitement en Europe/Paris ; les heures ambiguës/inexistantes du changement d'heure sont refusées. Le formulaire rappelle l'obligation en ligne activée sur le point et conservée après archivage, ainsi que l'absence de création de badge ou de droit d'accès. Liens de suivi résolus par identifiant exact de passage, y compris au-delà de la première page de la liste, sans substitution silencieuse si ce passage manque.
