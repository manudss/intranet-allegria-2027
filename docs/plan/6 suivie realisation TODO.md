Ajoute le suivi opérationnel des missions et shifts.

Les statuts existants sont :

Mission :
- DRAFT
- TODO
- IN_PROGRESS
- DONE
- CANCELLED
- NOT_DONE

Shift :
- TODO
- ASSIGNED
- IN_PROGRESS
- DONE
- CANCELLED
- NOT_DONE

Implémente :
- endpoint PATCH /volunteer-shifts/:id/status ;
- endpoint PATCH /volunteer-missions/:id/status ;
- validation des transitions côté backend ;
- journalisation de chaque changement ;
- recalcul ou projection du statut de mission depuis ses shifts ;
- possibilité pour ADMIN et COORDINATOR de forcer un statut.

Transitions recommandées pour un shift :
- TODO → ASSIGNED ;
- TODO → IN_PROGRESS ;
- ASSIGNED → IN_PROGRESS ;
- ASSIGNED → CANCELLED ;
- IN_PROGRESS → DONE ;
- IN_PROGRESS → NOT_DONE ;
- IN_PROGRESS → CANCELLED ;
- DONE → NOT_DONE uniquement pour ADMIN ou COORDINATOR ;
- toute transition doit être auditée.

Ajoute les endpoints de synthèse :
- compteurs par statut ;
- missions à faire ;
- shifts en cours ;
- shifts terminés ;
- shifts non faits ;
- shifts annulés ;
- missions facultatives séparées des missions obligatoires.

Frontend Angular :
- actions rapides sur les shifts ;
- vue “À faire” ;
- vue “En cours” ;
- vue “Fait” ;
- vue “Non fait” ;
- vue “Annulé” ;
- affichage distinct des éléments facultatifs ;
- mise à jour optimiste uniquement si elle est sûre, sinon rechargement après succès ;
- interface utilisable sur mobile.

Respecte les rôles existants et ajoute des tests sur toutes les transitions.
