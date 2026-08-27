Ajoute la gestion des disponibilités des bénévoles existants.

Crée l’entité VolunteerAvailability :

- id integer ;
- volunteerId clé étrangère vers volunteers.id ;
- volunteerTeamId nullable, clé étrangère vers volunteer_teams.id ;
- startAt timestamptz ;
- endAt timestamptz ;
- comment text nullable ;
- createdAt ;
- updatedAt.

Règles :
- endAt doit être postérieur à startAt ;
- volunteerTeamId est nullable ;
- un bénévole peut avoir plusieurs disponibilités ;
- les disponibilités doivent être filtrables par période, bénévole et équipe ;
- ne pas créer de gestion de versions ;
- ne pas créer de workflow de validation.

Permissions :
- ADMIN et COORDINATOR : accès complet ;
- responsables opérationnels : lecture et modification des bénévoles de leur périmètre ;
- VIEWER : lecture seule ;
- un bénévole connecté peut consulter ses disponibilités ;
- si l’application existante permet l’auto-édition du profil, autoriser le bénévole à modifier ses propres disponibilités uniquement.

Ajoute :
- migration ;
- entité ;
- DTOs ;
- validation ;
- endpoints CRUD ;
- vérification des permissions au niveau service ;
- onglet Angular “Disponibilités” sur la fiche bénévole ;
- vue calendrier ou liste mobile ;
- filtres par date et équipe ;
- tests backend et frontend.

Réutilise les composants UI et la gestion des rôles déjà présents.
