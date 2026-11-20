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

La vue restauration exige le rôle CATERING. Elle affiche seulement des catégories alimentaires et des fourchettes à partir de cinq dossiers attestés. Ni noms, ni texte libre, ni filtre de petit groupe. Ce seuil réduit certains risques mais ne prouve pas une anonymisation irréversible. Cette synthèse ne remplace pas les consignes individuelles confidentielles.

## Limites à terminer avant activation

- Connecter et éprouver le transport e-mail et le scanner sur l'environnement cible.
- Revue indépendante de sécurité, confidentialité, habilitations et conservation.
- Achever la vue santé pour les seuls professionnels habilités et son audit de consultation, distincte du suivi administratif.
- Tester le parcours HTTP complet (cookies, origine, téléversement et PDF), pas seulement les services SQL et les écrans simulés.
- Valider le remplissage visuel de toutes les pages du modèle sanitaire avec des cas longs et signés.
- Les contacts partagés deviennent non modifiables lorsqu'un dossier du foyer a été envoyé. Une évolution par instantanés de contacts par dossier permettrait des corrections plus fines sans réécrire les dossiers transmis.

## Tests et données fictives

Les tests SQL utilisent une base PostgreSQL embarquée jetable, jamais les inscriptions existantes. Les seeds ajoutent un foyer explicitement fictif avec deux brouillons, un modèle de démonstration non obligatoire et le rôle restauration. Ils ne créent pas de session famille valide, n'envoient pas d'e-mail et n'activent pas la santé numérique. Le seed existant reste le seul mécanisme de démonstration.

Le paiement est strictement simulé. Aucun fournisseur bancaire, carte, IBAN, débit ou reçu réel n'est implémenté.
