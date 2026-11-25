# Signatures, comparaison et décision technique du20novembre2026

## Recommandation

Réutiliser DSS6.5.1 pour l'outil local de signatures standard multi-format. Garder la distinction avec l'attestation simple du parcours public. Une bibliothèque n'attribue pas magiquement une identité certifiée à chaque parent.

Le parcours gratuit immédiatement utilisable permet : lecture de la version intégrale, nom/qualité/accord explicite au clavier, preuve liée à l'accès e-mail et document figé ; ou téléchargement PDF puis dépôt administratif d'un exemplaire signé avec son propre outil. Le dépôt PDF/JPEG/PNG est reçu pour contrôle humain, ne devient pas une signature cryptographique validée et ne remplace pas automatiquement une attestation requise. Une fiche médicale n'y est jamais déposée.

## Solutions comparées

| Solution | Licence et état constaté | Formats réels | Coût/prérequis et choix |
|---|---|---|---|
| DSS Commission européenne | LGPL2.1+,6.5.1 publiée le14octobre2026 ; version confirmée sur MavenCentral | PAdES/PDF, XAdES/XML, CAdES/binaire, JAdES/JSON et autres profils disponibles dans la bibliothèque | Logiciel libre local, Java11+ et Maven pour cet outil. Certificat et accès à sa clé nécessaires pour signer. Pas de certificat d'identité fourni ni d'hébergement gratuit garanti. Recommandé pour le besoin multi-format |
| @signpdf | MIT, dépôt actif et versions publiées | PDF avec emplacements préparés et signature détachée PKCS#7, options PAdES | Local Node, certificat P12 et mot de passe. Plus léger mais ne traite pas XML/JSON/binaire comme DSS. Non retenu pour un gestionnaire multi-format |
| signature_pad | MIT, dépôt et documentation de distribution actuels | Dessin exporté PNG/JPEG/SVG | Pas de certificat, mais ce n'est pas une signature cryptographique. Non retenu comme réponse à « signatures numériques dans différents formats » |

Les projets ont des publications et contributeurs observables, ce qui n'est ni une garantie de support futur ni une certification de sécurité. Aucun service commercial ou essai impliquant un abonnement n'a été activé. Le coût d'un certificat ou d'un futur prestataire n'a pas été accepté ou présumé nul.

## Implémentation et validation

`tools/document-signatures` et `npm run signatures` :4profils Baseline B. Signature locale avec PKCS#12 fourni explicitement ; contrôle d'intégrité cryptographique, sans réseau de confiance/OCSP/CRL/TSA. Le JSON de résultat indique que l'identité, la confiance et le statut qualifié ne sont pas évalués. Le format CAdES enveloppe le fichier original dans un `.p7m` ; il ne signe pas nativement tous les formats bureautiques. Le profil choisi n'est pas LT/LTA.

Le certificat de test n'existe que pendant les tests et porte une identité TEST sans lien avec une personne. Il n'est ni commité ni activé dans le portail. Aucun service Java, clé de production ou endpoint DSS externe n'est ajouté au déploiement public. Les tests vérifient les4formats, une altération XML, le refus d'un document non signé, d'un format inconnu et de l'écrasement d'un fichier.

Le vérificateur contrôle les octets couverts par chaque signature. Il ne remplace pas un rapport complet de validation de confiance, un contrôle du contenu visible d'un PDF, des modifications ultérieures ou de la qualité juridique d'une signature importée. Aucun import n'est approuvé automatiquement sur ce seul résultat.

## Décision restant à prendre

Si une signature cryptographique directement utilisable par chaque parent est nécessaire, retenir un circuit concret d'identité, certificat, conservation, validation et éventuel prestataire. Un certificat Alegria ne serait qu'une signature/cachet Alegria, jamais la signature personnelle du parent. Aucun choix de cette nature n'est pris ici. L'attestation simple et le dépôt externe ne sont pas présentés comme leur équivalent qualifié.

## Sources lues

- DSS, code officiel et licence : https://github.com/esig/dss
- Versions DSS : https://github.com/esig/dss/releases
- Documentation officielle, profils, tokens PKCS#11/12 et validation : https://ec.europa.eu/digital-building-blocks/DSS/webapp-demo/doc/dss-documentation.html
- Présentation européenne : https://ec.europa.eu/digital-building-blocks/sites/spaces/DIGITAL/pages/467109107/Digital+Signature+Service+-+DSS
- Publication Maven vérifiée : https://repo.maven.apache.org/maven2/eu/europa/ec/joinup/sd-dss/dss-pades/maven-metadata.xml
- @signpdf, licence, packages, restrictions et PAdES : https://github.com/vbuch/node-signpdf
- Versions @signpdf : https://github.com/vbuch/node-signpdf/releases
- signature_pad, API PNG/JPEG/SVG et licence : https://github.com/szimek/signature_pad
- Règlement eIDAS, types de signatures et certificats : https://eur-lex.europa.eu/eli/reg/2014/910/oj/eng

La démo publique DSS n'a reçu aucun document du projet. Cette note technique n'est pas un avis juridique sur le niveau de signature exigé pour Alegria.
