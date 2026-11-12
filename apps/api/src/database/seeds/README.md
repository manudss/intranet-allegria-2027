# Seed data (Allegria 2027)

Ce dossier contient un script de generation de donnees de test coherentes pour l'API.

## Objectifs

- Produire un jeu de donnees exploitable dans Swagger pour tester tous les endpoints.
- Reproduire des cas reels: equipes pleines, participants non affectes, affectations annulees, donnees sante partielles.
- Offrir plusieurs niveaux de volumetrie proches d'un contexte pre-production.

## Profils disponibles

- `small`: developpement local rapide
- `medium`: validation fonctionnelle complete
- `large`: charge representative avant recette

## Comptes crees

Tous les comptes crees par le seed partagent le meme mot de passe de
demonstration : `demo-only-not-a-secret` (donnees 100 % fictives,
environnements de demo/preview uniquement).

- `admin@allegria.local` (ADMIN)
- `sante@allegria.local` (sante)
- `coordination@allegria.local` (coordination)
- `animator.N@allegria.local` (N = 1..850 en profil medium) : benevoles lies a
  leur fiche, avec le role VOLUNTEERS (acces "Mon espace")
- `logistic.N@allegria.local` : logistique

## Execution

1. Migrations d'abord
2. Seed ensuite

Le script purge puis regenere les donnees (`TRUNCATE ... RESTART IDENTITY CASCADE`).
