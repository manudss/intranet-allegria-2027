Je finalise l’implémentation Swagger + seed volumétrique et je te laisse les commandes prêtes pour tester.
Intégrer Swagger UI dans l’API Nest
Documenter les endpoints principaux (tags + opérations + schémas DTO)
Ajouter des scripts de seed multi-profils (small|medium|large)
Générer des données cohérentes avec cas variés + volumétrie
Vérifier build/lint/tests + migration + seed en local
Ce qui est en place
Swagger activé dans apps/api/src/main.ts avec UI sur \/api/docs`` + auth Bearer.
DTOs documentés pour OpenAPI (classes avec @ApiProperty*) dans :
apps/api/src/app/core/participants/participants.types.ts
apps/api/src/app/core/groups/groups.types.ts
apps/api/src/app/core/teams/teams.types.ts
apps/api/src/app/core/team-participants/team-participants.types.ts
apps/api/src/app/core/host-families/host-families.types.ts
apps/api/src/app/core/assignments/assignments.types.ts
apps/api/src/app/core/participant-health/participant-health.types.ts
apps/api/src/app/core/volunteers/volunteers.types.ts
apps/api/src/app/core/auth/auth.types.ts
Controllers annotés Swagger (@ApiTags, @ApiOperation, queries, bearer santé) sur les modules core.
Seeder complet ajouté :
Script: apps/api/src/database/seeds/seed.ts
Doc seed: apps/api/src/database/seeds/README.md
Profils : small, medium, large
Cas couverts : participants non affectés, équipes partiellement pleines, affectations annulées/historisées, données santé partielles, rôles RBAC multiples.
Scripts npm ajoutés dans package.json :
seed:api:small
seed:api
seed:api:large
Compatibilité tooling corrigée :
tsconfig.json ajouté pour exécution CLI TypeORM/decorators.
tsx ajouté pour exécuter le seed de façon fiable.
Vérifications exécutées
nx build api ✅
nx test api ✅
nx lint api ✅
migration:run ✅
seed:api:small ✅
(450 participants, 60 équipes, 120 familles, 365 affectations, 258 dossiers santé)
Commandes utiles (copier-coller)
Set-Location "C:\Users\A740550\WebstormProjects\intranet-allegria-2027"
npm run db:up
npm run migration:run
npm run seed:api:small
npm run serve:api
Set-Location "C:\Users\A740550\WebstormProjects\intranet-allegria-2027"
npm run seed:api
npm run seed:api:large
Ensuite ouvre http://localhost:3000/api/docs et teste avec un des comptes de
demo (mot de passe commun : `demo-only-not-a-secret`) :
admin@allegria.local (ADMIN), sante@allegria.local, coordination@allegria.local,
animator.1@allegria.local (benevole, acces Mon espace), logistic.1@allegria.local.
Si tu veux, je peux maintenant ajouter des exemples de payload/réponse plus riches par endpoint dans Swagger (@ApiResponse, exemples d’erreurs métier).
Je peux aussi ajouter un script seed:api:reset (drop + migrate + seed en une commande).
