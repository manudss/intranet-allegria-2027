Crée le tableau de bord opérationnel jour J dans l’application existante.

Ne crée pas de nouveau système d’authentification.
Utilise les rôles existants :

- ADMIN ;
- COORDINATOR ;
- HEALTH ;
- ANIMATOR ;
- LOGISTICS ;
- VIEWER.

Backend :
crée des endpoints de synthèse performants et filtrables :

1. Vue globale du jour

- date ;
- nombre de missions ;
- nombre de shifts ;
- shifts TODO ;
- shifts ASSIGNED ;
- shifts IN_PROGRESS ;
- shifts DONE ;
- shifts CANCELLED ;
- shifts NOT_DONE ;
- shifts sans affectation confirmée ;
- shifts sous-dotés ;
- bénévoles affectés ;
- bénévoles avec affectation PROVISIONAL.

2. Vue par équipe opérationnelle

- équipe ;
- nombre de missions ;
- shifts par statut ;
- capacité totale ;
- bénévoles confirmés ;
- bénévoles provisoires ;
- alertes.

3. Vue par lieu

- lieu ;
- shifts en cours ;
- shifts à venir ;
- bénévoles affectés ;
- alertes de sous-effectif.

4. Vue “Qui fait quoi”

- recherche par nom de bénévole ;
- missions ;
- shifts ;
- horaires ;
- lieux ;
- équipe opérationnelle ;
- statut de l’affectation ;
- statut du shift.

5. Vue “À faire”

- missions obligatoires non terminées ;
- shifts non commencés ;
- shifts sans effectif confirmé ;
- shifts facultatifs séparés.

Les requêtes doivent être paginées lorsque nécessaire et utiliser des indexes adaptés.

Frontend Angular :
crée une page responsive “Tableau de bord jour J” avec :

- cartes de synthèse ;
- filtres date, équipe, lieu et statut ;
- onglet “Missions et shifts” ;
- onglet “Équipes” ;
- onglet “Lieux” ;
- onglet “Qui fait quoi” ;
- onglet “Alertes” ;
- actualisation manuelle ;
- actualisation automatique configurable ;
- affichage mobile lisible ;
- actions rapides autorisées selon le rôle.

Permissions :

- ADMIN et COORDINATOR : vue complète ;
- HEALTH : vue limitée aux missions santé ;
- ANIMATOR : vue limitée aux missions animation ;
- LOGISTICS : vue limitée aux missions logistiques ;
- VIEWER : lecture seule selon son périmètre.

Ne pas exposer les données médicales des participants dans ce tableau de bord.
Ajoute les tests backend et frontend.
