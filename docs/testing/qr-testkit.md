# Kit de tests QR, données fictives uniquement

Créé par les scripts existants `npm run seed:api:small`, `seed:api` et `seed:api:large`.
Ces scripts réinitialisent la base. Ne jamais les lancer sur une base réelle. Cette PR ne lance aucun reseed ni déploiement à distance.

Mot de passe commun de démonstration : `demo-only-not-a-secret` (valeur publique de démo, jamais pour un compte réel).

| Compte | Rôle | Cas attendu |
| --- | --- | --- |
| admin@allegria.local | ADMIN | Tous réglages, badges, scan, suivi |
| qr.manager@allegria.local | BADGE_MANAGER | Génération/impression/attribution/suivi, pas le mode scanner |
| qr.scanner.a@allegria.local | SCANNER | Scanner A, toutes zones |
| qr.scanner.b@allegria.local | SCANNER | Scanner B, toutes zones |
| qr.zone@allegria.local | SCANNER | Restauration seulement |
| qr.expired@allegria.local | SCANNER | Habilitation expirée, session refusée |
| qr.revoked@allegria.local | SCANNER | Habilitation retirée, session refusée |
| qr.no-grant@allegria.local | SCANNER | Aucun grant, session refusée |
| qr.no-role@allegria.local | Aucun | Ni scan ni gestion badges |

Les habilitations utilisables commencent la veille du seed et durent 30 jours, pas à la date future du rassemblement. Les sessions précréées servent aux tests de collecte ; elles n'ouvrent pas automatiquement un téléphone. Démarrez une session depuis chaque appareil.

## Personnes faciles à retrouver

Rechercher `QR-DEMO` dans les participants. Lot de badges : `QR-TESTKIT`. Codes opaques aléatoires à chaque reseed, pas d'informations personnelles dans le QR.

- Jeune QR-DEMO-Valide, Animateur QR-DEMO-Valide, Benevole QR-DEMO-Valide : trois types, badges actifs.
- SansBadge QR-DEMO-AAttribuer : pas de badge ; génération/attribution à tester.
- Repas QR-DEMO-DejaServi : repas déjà accepté pour le service `repas-midi`.
- Badge QR-DEMO-Remplace : ancien badge perdu, nouveau actif ; repas précédent conservé par personne.
- Badge QR-DEMO-Revoque : badge révoqué, affectation close, pas de badge actif.
- Affectation QR-DEMO-Expiree : affectation close mais badge non perdu, pour vérifier le refus d'une ancienne table.
- Presence QR-DEMO-Sorti : entrée puis sortie.
- Presence QR-DEMO-Reentre : entrée, sortie, nouvelle entrée.
- Doublon QR-DEMO-AVerifier : un repas accepté, un doublon ouvert, un doublon déjà vérifié/clos.
- Tardif QR-DEMO-AVerifier : scan reçu depuis une session expirée, ambigu exclu des repas servis.

## Points et scénarios

Porte A et Porte A (sortie), Réfectoire midi, sas backstage (adultes uniquement, validation en ligne), appel quotidien, bus aller et point inactif. Pour les compteurs de présence choisir ENTREE et SORTIE, pour les repas REPAS. Les dates par défaut du suivi sont celles du jour du test.

1. Imprimer des badges disponibles, vérifier qu'ils sont inconnus tant qu'ils ne sont pas attribués.
2. Imprimer les trois personnes valides, scanner entrée/sortie, repas et sas backstage. Le jeune est refusé au sas.
3. Deux scanners : démarrer A et B, couper le réseau de B, remplacer un badge via le gestionnaire, scanner son ancien code sur B, rétablir le réseau. L'ancien scan doit rester lié à l'ancienne affectation et remonter à vérifier.
4. Servir le même repas sur A et B hors ligne : le doublon local ne peut pas être garanti entre deux téléphones déconnectés. Après upload un seul verdict serveur accepté et un doublon. Examiner/clore avec note sans changer le verdict.
5. Couper le réseau, scanner, recharger puis quitter : une file non envoyée ne doit jamais être effacée. Reconnecter, envoyer, puis quitter.
6. Retirer le rôle ou le grant, laisser expirer la clé et la session : plus de nouvelle table/clé autorisée ; collecte des scans anciens conservée.
7. Réimprimer un participant déjà badgé : même code, aucune nouvelle affectation. Pour un participant sans badge : une seule attribution, y compris avec deux préparations simultanées.

## Limites honnêtes

Un seed serveur ne simule ni un téléphone déconnecté ni sa caméra. Le test réel papier/caméra, l'impression à 100 %, le contraste et les deux appareils sont à exercer avant usage. L'application ne peut pas forcer une imprimante physique : elle prépare la page, puis ouvre l'impression du navigateur ou l'enregistrement PDF. Les statistiques restent des estimations sur scans reçus, pas un décompte d'évacuation.


## Sélection comme les affectations

Les routes `GET /api/access-control/printing/selection/participants` et `.../volunteers` réutilisent les services des affectations, avec les mêmes filtres. Leurs routes `/filters` fournissent les valeurs de filtres. Ces routes sont en lecture seule, ADMIN/BADGE_MANAGER, limitées à 100 résultats par page ; les noms des mineurs restent masqués.

Le pool distingue les identifiants participants et bénévoles. `POST .../printing/participants/prepare` accepte `participantIds` et/ou `volunteerIds`, au maximum 100 références au total. Un bénévole sans fiche participant peut être sélectionné ; sa projection BENEVOLE n'est créée qu'à la génération, sans l'affecter à une équipe. Un badge déjà actif est réutilisé. La fixture `BenevoleSansFiche QR-PRINT-DEMO` couvre ce chemin. La CI teste deux générations concurrentes, le mélange des deux identifiants d'une même personne et l'absence d'affectation créée par impression.

## Interface génération / impression

Page `/acces/impression`, menu Contrôle d'accès, ADMIN et BADGE_MANAGER.

1. Participants et badges : filtres identiques aux affectations, pool commun jeunes/animateurs/bénévoles, pagination et « Tout ajouter ». Limite explicite de 100 personnes par génération, pas de troncature silencieuse. Aucun badge ni fiche bénévole créé pendant la sélection.
2. Récapitulatif en lecture seule : liste et compte des badges existants/nouveaux. Confirmation distincte pour générer et attribuer. Réessayer après une réponse incertaine réutilise le badge actif, sans remplacement.
3. QR noirs avec repères rouges, favicon central, correction H et marge libre de 4 modules. Bandeaux TA rouge, ES turquoise, animateurs en nuances foncées, bénévoles jaune. Logos TA/ES fournis par l'utilisateur. Pas de JT ; aucune branche déduite de l'âge. Branche absente : bandeau neutre explicite.
4. Impression A4, 12 badges/page, taille 100 %, sans en-têtes/pieds navigateur. Activer les arrière-plans pour les bandeaux. « Enregistrer en PDF » passe par la boîte d'impression du navigateur. Mode noir/blanc sans logo disponible en secours. Les noms de famille des jeunes ne sont ni rendus ni imprimés.
5. Stock : génération de 1 à 100 codes opaques avec lot, sélection/pagination, revalidation du statut avant préparation. Les codes d'un enregistrement au résultat incertain sont conservés pour une nouvelle tentative identique. Pas d'impression des badges perdus/révoqués.

Tests visuels effectués sur le build réel : parcours mixte sur ordinateur et mobile390px, aperçu et document imprimable PDF. Décodage automatisé des QR du PDF par un décodeur indépendant ; cela ne remplace pas un essai téléphone + papier. Les captures de validation utilisent uniquement des données fictives.
