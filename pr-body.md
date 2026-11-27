## Objet

Bascule du périmètre d'accès des équipes : la délégation d'une équipe se **déduit de ses membres** (rattachement des personnes), au lieu du lien historique `teams.group_id`. Conforme au plan « Délégations et transports » validé le 27/11 (« Le filtrage actuel s'appuie sur le lien équipe→délégation. Le plan le fait porter par le rattachement des personnes ») et au retour du 27/11 8h20 (« Supprime ce lien, il n'a pas lieu d'être »).

PR distincte de la #55 (groupes de rassemblement) et de la #56 (délégations/transports). **À ne pas fusionner par nous : Emmanuel fusionne.**

## Sémantique appliquée

- **Dérivation** (`team-scope.ts`) : délégations d'une équipe = délégations distinctes de ses membres participants. Les référents bénévoles rejoindront la dérivation quand leur rattachement existera (chantier PR #56 : `volunteers.group_id` absent de `main` à ce jour).
- **Lecture** : une équipe est visible d'un compte limité si au moins un membre est dans sa portée. L'appartenance d'un seul membre ne donne **pas** accès aux personnes des autres délégations : les listes de membres restent filtrées par personne (`getParticipants` filtrait déjà), les effectifs renvoyés sont des agrégats sans identité. Une équipe vide n'est visible qu'en portée « tout ».
- **Écriture (composition, répartition, placement)** : l'équipe doit être dans la portée dérivée **ou vide** — une équipe vide est neutre et rejoint la portée du premier membre rattaché (reproduit le flux « créer puis remplir » sans lien stocké). Un membre ne peut être retiré que s'il est lui-même dans la portée, même dans une équipe mixte.
- **Transition sans casse** : `teams.group_id` reste en base et accepté en écriture (jamais lu pour l'accès) ; `groupId`/`groupName` des listes d'équipes deviennent des champs dérivés dépréciés, complétés par `delegationIds`/`delegationNames`. **Aucune suppression de colonne dans cette PR** (« rien n'est supprimé avant bascule complète ») : le retrait du lien restera un chantier ultérieur, non promis ici.
- **Création d'équipes** : le choix d'une délégation n'est plus exigé pour les comptes limités.

## Preuves de non-régression

- Suite API complète : **667/667**, dont 34 tests nouveaux ou réécrits (helper de dérivation, teams, composition, répartition jeunes, placement, hébergement).
- **Tests négatifs explicites** : équipe entièrement d'une autre délégation invisible (liste + fiche 404) et non modifiable (ajout/retrait/proposition refusés, même avec un membre à soi à ajouter) ; membres d'une autre délégation jamais renvoyés dans une équipe mixte ; relation santé jamais chargée par les listes de membres.
- Équivalence sur les écrans existants : les données seedées (équipes mono-délégation) produisent le même périmètre qu'avant, puisque le lien historique coïncide avec la dérivation.

## Hors périmètre

- Pas de changement UI : la colonne « Groupe » de l'écran Équipes est déjà traitée par la PR #55 (groupes de rassemblement).
- Données de santé : module séparé, jamais exposé (invariant maintenu, test ajouté).
