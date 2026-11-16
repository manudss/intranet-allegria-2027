# Phase 2 - retouches et missions liées

## Modèle
- Les missionIds existants restent la source des liens. Une phase absente reste « À classer ».
- La phase appartient au lien événement/mission. Chaque créneau bénévole a au plus un événement pilote.
- Début/fin du créneau se règlent sur le début ou la fin de l'événement, avec décalages explicites et configurables. Aucun décalage de 30 minutes imposé.
- Les horaires passent par un aperçu partagé et une application transactionnelle avec version des entrées, détection de conflits et audit. Le changement de pilote exige l'identité explicite de l'ancien pilote.
- Les retouches descriptives, liens et horaires ont des validations distinctes, signalées dans l'interface.

## Vérifications locales
- Migration additive exécutée sur PostgreSQL 14 isolé, puis seed existant `seed:api:small`.
- API : 449 tests ; web : 186 ; mobile : 64 ; site : 53 ; shared : 1. Tous verts sur la révision testée.
- Builds production API et web réussis ; lint API/web sans erreur (avertissements existants).
- API réelle : classement, aperçu/application du pilotage, refus d'ancien pilote incorrect, refus du retrait de mission pilotée, propagation depuis le prédécesseur, version périmée, autorisation lecture seule et audit.
- Base réelle : modification directe d'un créneau piloté refusée ; écriture concurrente bloquée par le verrou transactionnel ; rollback restaure les horaires.
- Navigateur réel : fiche groupée et panneau desktop/mobile ; menu Taiga au-dessus du panneau ; annulation conserve les retouches ; inspection des captures après corrections d'empilement et largeur mobile.

## Limites et précautions
- La tête de chaîne ne déplace pas son propre début ; réduction et allongement ne sont pas des inverses garantis du moteur existant.
- Les documents restent des URL. Aucun travail dans le module Consignes/documents.
- Aucun déploiement de branche ni merge effectué. Installation vide conservée : la migration ne crée aucune donnée métier.
- La création/liaison de mission puis son classement sont deux appels ; si le classement échoue, le lien reste visible « À classer » et l'erreur est affichée.
- Les budgets de taille web signalent des avertissements ; ils ne bloquent pas le build.
