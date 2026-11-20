# Espace famille et dossiers jeunes

Parcours privé par code e-mail, dossiers séparés par jeune, contacts communs, pages sauvegardées, attestations versionnées, simulation de paiement sans débit et transmission administrative. La session famille est distincte de la session intranet.

## Ouverture réelle

L'installation reste fermée aux envois finaux tant que l'organisation n'a pas configuré les règles, la date de référence des âges et ses modèles. Aucun modèle juridique obligatoire n'est inventé par le code. L'administrateur peut modifier les règles via l'API et la page Inscriptions familles. Un texte modifié doit porter une nouvelle version.

L'accès par e-mail nécessite FAMILY_SMTP_HOST, FAMILY_MAIL_FROM, éventuellement FAMILY_SMTP_PORT (587), FAMILY_SMTP_SECURE, FAMILY_SMTP_USER et FAMILY_SMTP_PASSWORD. Utiliser un transport et une identité d'expéditeur autorisés pour Allegria. Aucun identifiant d'un autre projet ne doit être réutilisé implicitement. Le service refuse de prétendre envoyer un code si la configuration manque. Les tests n'envoient pas de courriels.

Les pièces administratives nécessitent clamdscan et un service ClamAV configuré, joignable et à jour. Le dépôt est bloqué si l'analyse n'aboutit pas. PDF, PNG et JPEG uniquement, 2 Mo maximum. Les téléchargements sont privés, servis en pièce jointe et sans cache. Les pièces médicales ne doivent pas utiliser cette rubrique administrative.

## Santé : verrou de déploiement

PAPER est le mode par défaut. La présence des variables ci-dessous n'est PAS une validation juridique, médicale ou HDS. L'organisation doit d'abord qualifier son statut, ses finalités, le circuit santé, les habilitations, l'hébergement, les durées de conservation et ses obligations éventuelles (analyse d'impact, HDS...). Ne pas activer une collecte réelle sur une simple approbation de maquette.

Activation technique uniquement après cette qualification : FAMILY_HEALTH_APPROVAL_REFERENCE, FAMILY_HEALTH_ENCRYPTION_KEY (32 octets encodés en base64, gérés comme secret), FAMILY_HEALTH_DECLARATION_VERSION et FAMILY_HEALTH_DECLARATION_TEXT. Prévoir sauvegarde et rotation contrôlée de la clé avant toute donnée réelle. Perdre la clé rend les dossiers chiffrés illisibles. Aucune collecte numérique ne doit commencer sans politique de conservation et procédure de suppression validées.

Les réponses structurées sont chiffrées AES-256-GCM avec liaison au jeune et à sa famille. Elles ne sont pas incluses dans le dossier administratif. Les attestations sont simples, ni avancées ni qualifiées. Le contenu signé est figé et son historique chiffré est conservé. Une modification des contacts ou de l'identité invalide l'attestation courante sans effacer les réponses. Le modèle CAMP MEJ 2026 fourni est conservé en tête du PDF, complété par une annexe intégrale. Ses mentions et sa déclaration doivent être revues avant utilisation réelle. Les champs internes de vérification et les observations pendant le séjour ne sont pas inventés.

La vue restauration exige le rôle CATERING. Elle affiche seulement des catégories alimentaires et des fourchettes à partir de cinq dossiers attestés et transmis. Le seuil cinq est une proposition réversible de conception, pas un choix explicite de l’organisation. Ni noms, ni texte libre, ni filtre de petit groupe. Ce seuil réduit certains risques mais ne prouve pas une anonymisation irréversible. Cette synthèse ne remplace pas les consignes individuelles confidentielles.

## Limites à terminer avant activation

- Connecter et éprouver le transport e-mail et le scanner sur l'environnement cible.
- Revue indépendante de sécurité, confidentialité, habilitations et conservation.
- Valider les habilitations réelles des professionnels. La vue HEALTH et les téléchargements sanitaires journalisent chaque consultation et ne montrent que la version transmise, jamais les brouillons ni les corrections non renvoyées.
- Étendre sur environnement cible les tests HTTP locaux déjà passants : cookies, reprise, origine, conflit, isolement des familles, rejet de pièce exécutable et séparation des rôles. Le scanner réel, le transport SMTP et le PDF via un navigateur connecté doivent être éprouvés à l’intégration.
- Faire valider les mentions du modèle sanitaire, son usage et les champs requis par les référents. Le contrôle visuel technique ne constitue pas cette validation.
- Les contacts communs restent modifiables. Chaque envoi conserve son instantané ; une modification pour un autre jeune ne réécrit pas les dossiers déjà transmis.

## Tests et données fictives

Les tests SQL utilisent une base PostgreSQL embarquée jetable, jamais les inscriptions existantes. Les seeds ajoutent un foyer explicitement fictif avec deux brouillons, un modèle de démonstration non obligatoire et le rôle restauration. Ils ne créent pas de session famille valide, n'envoient pas d'e-mail et n'activent pas la santé numérique. Le seed existant reste le seul mécanisme de démonstration.

Le paiement est strictement simulé. Aucun fournisseur bancaire, carte, IBAN, débit ou reçu réel n'est implémenté.

## Vérifications techniques ajoutées

Les tests HTTP lancent Nest sur une adresse locale et utilisent une base PostgreSQL embarquée jetable. Les gardes réels séparent sessions famille, administration, santé et restauration. Le fournisseur d’identité est simulé uniquement dans le test. Les tests de service couvrent le renvoi sur le même participant, les instantanés, les anciennes attestations, les versions de modèles, les origines étrangères et les révisions concurrentes. Les tests du formulaire vérifient qu’une réponse réseau ancienne ne marque pas une saisie plus récente comme enregistrée.

La police Noto Sans sous licence SIL OFL est embarquée pour les caractères usuels. Tout caractère non pris en charge est indiqué explicitement sous forme Unicode dans le rendu et reste intact dans une pièce intégrale UTF-8 attachée au PDF. Le PDF sanitaire porte ses données intégrales et sa preuve dans une annexe JSON UTF-8, à protéger avec la même confidentialité que le document. Les rubriques médicales non renseignées ne sont jamais transformées en réponses négatives.

## Durcissement des habilitations nécessaires

Les créations et affectations de rôles (`POST /roles`, `POST /roles/users/:userId/:roleId`, `DELETE /roles/users/:userId/:roleId`) et les créations/modifications d'utilisateurs (`POST /users`, `PATCH /users/:id`) sont réservées à ADMIN. Un compte ordinaire ne peut donc pas s'attribuer HEALTH ou modifier les accès d'un autre compte. Les lectures déjà nécessaires aux parcours intranet authentifiés restent disponibles. La désactivation d'un compte et la révocation d'un rôle prennent effet sur les requêtes suivantes, même avec un bearer déjà émis. Les tests HTTP incluent les refus VIEWER et le maintien des opérations ADMIN.

## Même origine et déploiement

Le site public statique et l'API n'ont pas le même domaine. Pour ne pas dépendre des cookies tiers, la construction de l'API construit aussi le portail Angular sous `/familles/`. L'image de l'API l'embarque et le sert à `/familles/espace-famille`. La session reste un cookie HttpOnly, Secure en production et SameSite Strict, limité à `/api/public/family-space`. Aucun jeton famille n'est stocké dans localStorage ou sessionStorage.

La configuration publique `SITE_API_URL` (ou le `WEB_API_URL` déjà utilisé en production) conduit le navigateur depuis la page publique `/espace-famille` vers le portail de même origine que l'API. Le script des previews fournit cette URL automatiquement ; la dépendance de build Nx et le Dockerfile incluent le portail automatiquement. Aucun nouveau service ni changement payant n'est requis. Les constructions locales de même origine restent utilisables sans cette URL. Les routes de l'API, les mutations et les fichiers absents ne sont pas masqués par la page Angular.

## Dépendances

L'audit de production local signale 52 avis déjà présents sur la base main (5 critiques, 19 élevés, 27 modérés, 1 faible). Aucun nouvel avis n'est introduit par les dépendances ajoutées de PDF, police et transport e-mail dans cette comparaison. Ce constat ne dispense pas d'un traitement séparé du socle existant ; aucun `npm audit fix` global n'est appliqué dans cette PR.
