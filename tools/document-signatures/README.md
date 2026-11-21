# Signatures multi-format, outil local facultatif

DSS 6.5.1 (Commission européenne, LGPL 2.1+) réutilisé, pas de cryptographie maison. Sources et comparaison dans `docs/inscriptions/revue-signatures.md`.

## Périmètre exact

- PAdES Baseline B : signature intégrée au PDF.
- XAdES Baseline B : XML enveloppé.
- CAdES Baseline B : contenu binaire encapsulé, sortie `.p7m`, pour PDF/JPEG/PNG/DOCX ou tout fichier binaire. Le document original ne devient pas pour autant un PDF signé.
- JAdES Baseline B : JSON encapsulé dans un conteneur JWS JSON.
- Contrôle de l'intégrité cryptographique des conteneurs produits. Sans contenu détaché externe, sans validation de confiance, révocation, horodatage qualifié ou niveau juridique. Une intégrité valide ne certifie jamais l'identité du signataire.

Ce n'est pas un service déployé et le bouton famille ne l'appelle pas. Aucun certificat de test n'est distribué ni activé. Le parcours famille garde une attestation simple avec preuve, et offre téléchargement PDF et dépôt administratif externe à vérifier humainement. Les documents sanitaires ne passent pas par le dépôt administratif.

## Usage opérateur

Java 11+ et Maven 3.6.3+ installés localement. Aucun service ni abonnement payant. Le logiciel ne fournit pas de certificat d'identité gratuit. Les dépendances sont téléchargées à la construction, pas les documents.

```sh
npm run signatures:build
npm run signatures -- verify /chemin/prive/document-signe.pdf
# Deux chemins locaux privés, jamais le mot de passe lui-même dans les arguments.
export ALLEGRIA_SIGN_P12_FILE=/chemin/coffre/certificat.p12
export ALLEGRIA_SIGN_PASSWORD_FILE=/chemin/coffre/mot-de-passe
npm run signatures -- sign PADES /chemin/prive/original.pdf /chemin/prive/signe.pdf
```

Le certificat doit contenir exactement une clé, appartenir au signataire autorisé et être fourni par le circuit d'identité retenu. Un certificat d'organisation signe au nom de l'organisation, jamais du parent. Le mot de passe vient d'un fichier privé autorisé, pas du dépôt, des logs ou du navigateur. Ne pas fournir de vraies données avant qualification du circuit et autorisation. Fichiers limités à10Mio, sortie nouvelle en0600, pas d'écrasement. AIA/révocation/timestamp en ligne non utilisés. Les références XML externes ne sont pas résolues par les résolveurs DSS par défaut.

## Tests

```sh
npm run signatures:test
```

Le test crée un certificat RSA jetable explicitement TEST, signe puis contrôle les4formats, refuse l'altération XML, l'absence de signature, l'écrasement et un format inconnu. Il détruit ses fichiers privés en fin de test. Le glob Node déjà exécuté en CI construit DSS puis exécute ce test (Java et Maven requis). Dans le glob des tests Node sans construction Java, le test s'annonce explicitement ignoré, pas réussi.

## Limites

Pas de PAdES-LT/LTA, TSA, liste de confiance européenne, OCSP/CRL, signature qualifiée, prise en charge universelle de tous les formats bureautiques, sélection automatique de certificat ni import automatique de résultat dans une attestation parent. Le choix d'identité et le niveau juridique restent à valider avant cette intégration. Aucun élément graphique ni champ PDF n'est placé automatiquement.
