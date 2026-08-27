Ajoute les affectations de bénévoles aux shifts.

Utilise :
- volunteers existante ;
- volunteer_shifts ;
- users existante pour identifier l’auteur de l’affectation ;
- les rôles et guards existants.

Crée VolunteerShiftAssignment :

- id integer ;
- volunteerId clé étrangère vers volunteers.id ;
- shiftId clé étrangère vers volunteer_shifts.id ;
- status enum :
  PROVISIONAL,
  CONFIRMED,
  CANCELLED ;
- assignedByUserId clé étrangère vers users.id ;
- notes text nullable ;
- createdAt ;
- updatedAt.

Contraintes :
- empêcher deux affectations identiques pour le même bénévole et le même shift ;
- une affectation CANCELLED ne doit pas compter dans les effectifs actifs ;
- une affectation PROVISIONAL ne doit pas compter dans les effectifs confirmés ;
- signaler les chevauchements horaires d’un bénévole ;
- ne pas bloquer automatiquement un chevauchement sans permettre à ADMIN ou COORDINATOR de forcer l’opération ;
- un bénévole peut être affecté à une mission d’une équipe sans être membre de cette équipe ;
- les affectations sont directes, sans demande de validation par le bénévole.

Permissions :
- ADMIN et COORDINATOR : tout gérer ;
- responsables opérationnels : créer, modifier et annuler les affectations de leur périmètre ;
- VIEWER : lecture seule ;
- aucun bénévole ne peut modifier les affectations.

Ajoute :
- migration ;
- entité ;
- DTOs ;
- endpoints de création, changement de statut et annulation ;
- recherche de bénévoles par nom, compétence, tag, équipe et disponibilité ;
- affichage des affectations dans le détail d’un shift ;
- affichage du planning d’un bénévole ;
- filtres PROVISIONAL, CONFIRMED et CANCELLED ;
- avertissement de chevauchement ;
- tests.

Ne crée aucun nouveau rôle applicatif.
