Je révise l’architecture autour des composants Taiga UI et des Signal Forms Angular 22. Je vérifie les API réellement installées pour le drawer, la table/virtualisation et `@angular/forms/signals`, afin que le plan n’impose pas des imports inexistants.

# Frontend Angular modulaire avec Taiga UI et Signal Forms

## Résumé

- Migrer vers `AppModule`, `AppRoutingModule` et des feature NgModules lazy-loaded.
- Conserver le layout, le thème, le menu et les URLs actuels.
- Utiliser exclusivement les composants Taiga UI pour les contrôles, retours visuels, dialogues et panneaux.
- Afficher détail et formulaires dans un `TuiDrawer` ouvert à droite de la liste.
- Utiliser les Signal Forms Angular 22 via `@angular/forms/signals`, sans Reactive Forms classiques.
- Gérer les 1 000 à 1 500 lignes avec virtual scroll, sans pagination.

## Architecture et navigation

- Créer `CoreModule` pour auth, guards, interceptors et infrastructure HTTP.
- Créer `SharedModule` exportant les composants communs, Taiga UI et le virtual scroll CDK.
- Lazy-loader les pages existantes :
  - `/rassemblement` → groupes
  - `/participants` → participants et santé
  - `/benevoles` → bénévoles
  - `/equipes-missions` → équipes et membres
  - `/familles` → familles d’accueil
  - `/hebergement` → affectations
- Chaque feature conserve une route unique. L’ouverture d’un élément ou d’un formulaire ne change pas l’URL.
- Protéger le shell interne avec `AuthGuard`; conserver `/login` et `/unauthorized` hors du layout.

## Tables et drawers

- Créer un `DataTableComponent` générique avec `CdkVirtualScrollViewport`, lignes de hauteur fixe, tri local, filtres et sélection.
- Employer les composants Taiga UI pour recherche, filtres, boutons, badges, loaders, messages vides et erreurs.
- Un clic sur une ligne ouvre un `TuiDrawer` avec `direction="right"`.
- Le drawer comporte trois modes pilotés par signals : `detail`, `create`, `edit`.
- Le header contient le titre et la fermeture; le footer contient les actions contextuelles.
- Sur mobile, le drawer devient superposé et pleine largeur; sur desktop, il reste à droite de la liste.
- Les suppressions utilisent un dialogue de confirmation Taiga UI.
- Après sauvegarde, mettre à jour la collection locale et revenir au mode détail sans recharger toute la page.

## Signal Forms et fonctionnalités

- Chaque formulaire possède un modèle fortement typé créé avec `signal()`, puis un arbre `form()` et un schéma de validation `required`, `email`, `min`, `max` ou validation personnalisée.
- Lier les contrôles Taiga UI avec la directive `[formField]`.
- Utiliser `submit()` pour marquer les champs, bloquer les doubles soumissions et appeler le service uniquement si le formulaire est valide.
- Réinitialiser le modèle du formulaire à chaque ouverture du drawer afin d’éviter de conserver l’état d’un élément précédent.
- Implémenter les CRUD complets pour participants, groupes, équipes, bénévoles, familles et affectations.
- Intégrer dans le drawer Équipe les animateurs, le groupe et la gestion des membres, avec badges de capacité `< 5`, `5–10` et dépassement de `maxSize`.
- Intégrer la santé dans le drawer Participant, visible uniquement pour `ADMIN` ou `HEALTH`, avec traçabilité de la dernière modification.
- Charger les listes en mémoire, appliquer filtres et tris localement, et utiliser les filtres API participants lorsqu’ils sont renseignés.

## Modèles, API et authentification

- Créer les interfaces des entités, relations, enums, DTO et réponses d’authentification selon les contrats NestJS.
- Créer les services HttpClient typés pour chaque domaine.
- `AuthService` utilisera des signals pour l’utilisateur, le statut de restauration et l’authentification, avec `currentUser$` conservé si nécessaire pour les consommateurs RxJS.
- Restaurer une session via `/api/users/me`; supprimer tout token refusé.
- `AuthGuard` redirigera vers `/login`; `RoleGuard` contrôlera `ADMIN`/`HEALTH`.
- `AuthInterceptor` ajoutera le bearer token; `HttpErrorInterceptor` centralisera les erreurs 401/403 et les erreurs affichables.
- Ajouter le proxy `/api` vers `http://localhost:3000`.
- Ajouter comme dépendances directes les packages Angular CDK/Taiga nécessaires et compatibles avec les versions Angular 22 et Taiga UI 5 déjà installées.

## Tests et validation

- Tester les services API, guards, interceptors et restauration de session.
- Tester les schémas Signal Forms, champs requis, soumission invalide et prévention des doubles soumissions.
- Tester les transitions du drawer, sa réinitialisation et son comportement mobile.
- Tester virtual scroll, filtres, tris et sélection sur des jeux proches de 1 500 lignes.
- Tester les opérations CRUD, la gestion des membres, les capacités et le RBAC Santé.
- Valider avec `nx test web`, `nx lint web` et `nx build web`.

## Hypothèses

- Le backend et le seed restent inchangés.
- Aucun écran CRUD supplémentaire ni sous-route ne sera créé.
- RxJS reste utilisé pour HttpClient; les composants convertissent les flux en signals lorsque cela simplifie leur état.
- Les pages du menu sans endpoint correspondant sont conservées sans fonctionnalité inventée.
