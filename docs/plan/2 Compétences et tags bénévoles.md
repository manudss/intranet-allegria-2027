Ajoute la gestion des compétences et tags libres aux bénévoles existants.

Utilise la table volunteers existante.
Ne crée pas de table profiles.
Ne duplique pas les informations firstName, lastName, phone ou email.

Crée :

1. VolunteerSkill

- id integer ;
- volunteerId clé étrangère vers volunteers.id ;
- skill enum avec exactement :
  SECURITY,
  ANIMATION,
  LITURGY,
  LOGISTICS,
  HEALTH,
  RECEPTION,
  TRANSPORT,
  ACCOMMODATION,
  COMMUNICATION,
  CATERING,
  CLEANING,
  MISCELLANEOUS,
  OTHER ;
- createdAt.

2. VolunteerTag

- id integer ;
- volunteerId clé étrangère vers volunteers.id ;
- value text non nul ;
- createdAt.

Contraintes :

- un bénévole ne peut pas avoir deux fois la même compétence ;
- les tags sont libres et non limités en nombre ;
- supprimer un bénévole supprime ses compétences et tags ;
- normaliser les tags pour éviter les doublons uniquement si cela respecte les conventions existantes ;
- ne jamais stocker les compétences sous forme de texte concaténé.

Ajoute :

- migrations ;
- entités ;
- DTOs ;
- endpoints pour lire et modifier les compétences et tags ;
- recherche de bénévoles par compétence ;
- recherche par tag ;
- édition depuis la fiche bénévole ;
- filtres Angular par compétence et tag ;
- tests.

Permissions :

- ADMIN et COORDINATOR : modification globale ;
- HEALTH : modification uniquement si le bénévole est concerné par une mission santé, sauf règle contraire déjà existante ;
- ANIMATOR : modification des données de bénévoles du périmètre animation ;
- LOGISTICS : modification des données du périmètre logistique ;
- VIEWER : lecture seule.

Respecte les rôles existants et les guards existants.
