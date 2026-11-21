# Preview PR42 sur le compte Render Lyam

La preview actuelle est https://al-pr42-api-hz8q.onrender.com/familles/espace-famille .
Admin : https://al-pr42-api-hz8q.onrender.com/inscriptions-familles .

Le service gratuit image `srv-dc06l5mc6qcc73b9ar00` utilise le compte des démos Lyam, sans modifier `iam-demo-apps`. Le secret `RENDER_LYAM_PREVIEW_API_KEY` est distinct du secret Render historique. API, intranet et portail famille sont construits par GitHub, puis Render tire un digest immuable. Aucun build Render. Les pushes ne déploient pas.

## Déployer cette PR, avant fusion

Utiliser uniquement le label `deploy-preview-lyam` sur PR42 : le retirer puis le remettre et fermer le sélecteur de labels pour enregistrer. Vérifier ensuite le run « PR42 Lyam free preview », le déploiement Render réellement live et `/api/public/family-space/rules`. Le workflow est limité à la PR interne42 et à sa branche `feat/family-registration`. Il ne lance aucun workflow de production, n'écrit pas le tag `latest` et refuse un service existant non gratuit ou non image.

**Ne pas utiliser `/preview` ni `reseed-preview` pour cette bascule.** Le workflow historique est encore lu depuis `main` tant que cette PR n'est pas fusionnée. Il vise l'ancien compte et peut faire tourner les identifiants de la base Neon. Une modification de `main` n'est pas incluse dans cette opération. Les deux anciens circuits et la nouvelle preview ne doivent pas être lancés simultanément. L'ancienne preview n'est pas supprimée implicitement.

La base reste la branche Neon existante `preview/pr-42`. Le nouveau workflow retrouve son URI courante en lecture seule, sans branche supplémentaire, migration, seed, reset ou rotation de mot de passe. Les données de démonstration existantes sont conservées. Les changements du seed dans cette PR serviront aux prochains seeds expressément demandés, pas à cette bascule.

## Garde-fous

Données fictives seulement, aucun paiement réel. La santé numérique reste PAPER, sans clé de collecte. La vue staff sanitaire peut donc refuser l'accès tant que le circuit n'est pas qualifié, même pour HEALTH. Les tests de la vue complète utilisent des données fictives isolées.

Le mail réel de code est activé uniquement vers `emmanueldesaintsteban@gmail.com`, avec le transport Alegria dédié. Aucun e-mail d'essai supplémentaire n'est envoyé par le workflow. La clé et le From mail ont été configurés séparément sur ce seul service. Les prochains déploiements mettent à jour chaque variable voulue, sans remplacer la liste ni effacer la clé mail.

## Fermeture de la PR

Le job `cleanup` se déclenche uniquement à la fermeture de PR42, vérifie l'ID, le propriétaire, le nom, le runtime image et le plan gratuit avant de supprimer ce seul service. Aucune suppression n'est exécutée tant que la PR reste ouverte. La base Neon garde son cycle de vie historique par PR. Les démos Lyam et la production ne sont pas ciblées.

## Contrôle et retour

Vérifier le service dans https://dashboard.render.com/web/srv-dc06l5mc6qcc73b9ar00 . En cas de régression, conserver le digest précédent disponible dans GHCR et déployer ce digest par l'API Render ; ne pas relancer un build source Render. Ne pas modifier le service Lyam ni le secret Render global pour corriger cette preview.
