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

- `admin@allegria.local` / `Admin#2027!`
- `sante@allegria.local` / `Health#2027!`
- `coordination@allegria.local` / `Coord#2027!`

## Execution

1. Migrations d'abord
2. Seed ensuite

Le script purge puis regenere les donnees (`TRUNCATE ... RESTART IDENTITY CASCADE`).
