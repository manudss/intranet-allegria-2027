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

## Suite avant utilisation

- Valider la maquette V5 et les paramètres de dérogation : contrôleurs autorisés,
  motif obligatoire ou non, portée permanente ou par passage et mode hors ligne.
- Ajouter un refus hors groupe attendu et une dérogation transactionnelle qui
  conserve le refus initial et crée le passage accepté avec statut exception.
  Cette exception ne doit pas contourner les badges révoqués, codes inconnus,
  repas déjà servis et restrictions de sécurité.
- Étendre le modèle par la trace des exceptions (qui, quand, pourquoi, passage,
  événement initial, événement accepté et clé idempotente). La portée reste
  proposée par passage et ne doit pas être codée comme une décision acquise.
- Endpoints administrateurs de gestion, audit transactionnel et contrôle de
  version pour éviter les écrasements concurrents.
- Valider les correspondances point/type/service et les fuseaux côté API.
- Listes, filtres et totaux cohérents dans un snapshot de lecture.
- Ne pas additionner les effectifs de groupes qui se recoupent : dédupliquer par
  personne et passage attendu au niveau des agrégats dashboard.
- Pour une même personne attendue à plusieurs points du même service, signaler
  la contradiction à l'admin, ne pas choisir silencieusement.

La migration n'est pas appliquée à une preview par ce commit. Ses montées et
descentes sont testées dans PostgreSQL/PGlite sans modifier les scans existants.


## Activation et appareils hors ligne

Créer un rattachement active durablement `expected_online_required` sur le point.
Archiver ses groupes ne réactive pas le mode hors ligne. Les nouvelles sessions,
les deltas et le choix d'un point reflètent cette politique. Un ancien appareil
déjà déconnecté ne peut pas recevoir un changement : l'activation opérationnelle
exige reconnexion et redémarrage de ses sessions avant le service. Ne pas annoncer
une révocation instantanée hors réseau. Les scans non envoyés restent conservés.
