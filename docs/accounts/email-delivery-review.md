# Recette e-mails — 17 octobre 2026 (#634)

La PR #688 a livré les six événements FR/EN. Cette recette complète les
[aperçus du 16 octobre](email-review.md) et distingue trois preuves : le rendu
HTML local, le transport SMTP applicatif et la réception externe. L’issue
reste ouverte tant que la matrice des clients mail n’est pas exécutée.

## Correction et contrôles locaux

Le retrait des styles du document et de l’attribut `style` de `body` reproduisait
une perte de typographie : Times New Roman et interligne navigateur par défaut.
La police et l’interligne essentiels sont maintenant déclarés dans les trois
cellules du message ; le bouton déclare également sa police. La palette, les
textes et les parcours existants sont conservés.

`scripts/e2e/account-email-previews.mjs` contrôle les 12 variantes à
320/390/768/1440 px en clair, sombre et avec uniquement les styles inline
(144 combinaisons). Il vérifie débordement, lisibilité du texte principal,
hauteur des actions, destinations du bouton/lien de secours et intégrité du
code copiable. Toutes les requêtes réseau de ces pages sont bloquées.
Ce test Chromium ne simule aucun moteur de client mail.

Les 144 combinaisons passent. Les captures représentatives ont été examinées :
[FR mobile sans styles globaux](email-previews/screenshots/email-verify-fr-320-inline.png),
[code EN mobile sombre](email-previews/screenshots/email-reauth-en-320-dark.png),
[réinitialisation EN desktop](email-previews/screenshots/email-reset-en-1440-light.png).
Le premier cas montre aussi le repli du bouton sur deux lignes ; le code long
reste lisible et entier dans le deuxième. Le navigateur intégré n’a pas réussi
à attacher sa fenêtre ; ces preuves viennent du navigateur de test local.

Depuis la racine, après installation des dépendances de `apps/playwright-service`
et de son navigateur Playwright :

```sh
cd apps/api-backend
mvn -Dtest=AccountEmailTest,SmtpAccountMailTest -Daccount.mail.preview.dir=../../outputs/account-email-preview test
cd ../..
node scripts/e2e/account-email-previews.mjs
```

Le rapport JSON et les captures synthétiques vont dans
`outputs/ui-review/account-email/`. Les tests SMTP utilisent l’adaptateur
`SmtpAccountMail` et un serveur TCP éphémère sur loopback. Ils vérifient
l’enveloppe, l’objet UTF-8, Date/Message-ID, les alternatives texte/HTML reçues,
le refus de transmettre sans STARTTLS exigé et la remontée d’un rejet SMTP.
Ils n’attestent pas une négociation TLS avec OVH.

Résultats locaux : 7 tests e-mails/SMTP réussis, 144 rendus réussis,
`node --check` et `git diff --check` réussis. La suite Java complète exécute
966 tests, avec 1 échec, 2 erreurs et 1 ignoré : deux timeouts dans
`ResourcePoolTest` et une assertion de délai dans `SslLabsClientTest`.
Une relance isolée de ces deux classes échoue encore (un timeout ResourcePool,
un timeout SSL et l’assertion de délai SSL). Ces classes et leur code métier
ne sont pas modifiés par cette PR ; la suite complète locale n’est pas verte.

## Réception externe effectuée

Avec l’autorisation de l’utilisateur, une boîte jetable a été créée via
[Mail.tm](https://docs.mail.tm/). Deux envois ont été déclenchés par le parcours
normal de l’application **déployée**, sans modification de sa configuration :

| Message reçu | Observation |
|---|---|
| Vérification FR | Objet localisé, texte et HTML présents ; lien de vérification consommé par POST avec succès |
| Réinitialisation EN | Objet localisé, texte et HTML présents ; demande anglaise reçue, lien non consommé |

Les deux messages montrent un passage par OVH, une mention TLS dans la chaîne
Received et une signature DKIM avec `d=lelouet.fr`. Cela atteste une réception
sur cette boîte à cet instant, sans garantir le placement en boîte principale
chez Gmail/Outlook ni le transport de la version candidate de cette PR.
Les mentions TLS portent sur les sauts Received observés, sans attester à elles
seules le chiffrement du premier saut applicatif.

La source reçue ne contient pas `Authentication-Results`. La présence d’une
signature DKIM ne prouve donc pas sa validation cryptographique ni le succès
SPF/DMARC. Aucun verdict `pass` n’est attribué à partir de sa seule présence.
La [preuve structurée expurgée](email-previews/delivery-2026-10-17.json)
ne contient ni adresse destinataire, mot de passe, cookie, source MIME ni jeton.

La boîte jetable a été supprimée. **Nettoyage restant :** le compte synthétique
nommé `Recette e-mails 634` a été créé et vérifié, mais son archivage a échoué
(`confirmation_required`) : la requête de recette omettait `confirmed: true`.
Ses identifiants étaient conservés en mémoire seulement et ne sont plus
disponibles. Un administrateur doit retrouver ce compte par son nom et
l’archiver. Aucun compte réel n’a été utilisé pour ces essais.

## DNS de l’expéditeur observé

Le 17 octobre, la lecture TXT de `lelouet.fr` retourne
`v=spf1 include:mx.ovh.com ~all`. La requête TXT `_dmarc.lelouet.fr` retourne
NXDOMAIN avec le résolveur local et avec Google Public DNS (statut 3, autorité
`lelouet.fr`). **Aucun enregistrement DMARC n’a été trouvé lors de ces lectures.**
Le DNS n’a pas été modifié.

Avant validation de la délivrabilité, l’opérateur doit inventorier les
expéditeurs légitimes du domaine, préparer sa politique DMARC selon le
[guide OVHcloud](https://docs.ovhcloud.com/fr/guides/web-cloud/domains/dns-zone-dmarc),
puis contrôler les verdicts et l’alignement dans de nouveaux messages reçus.
La publication d’une politique ne remplace pas ce contrôle. Voir aussi les
[consignes d’expédition Gmail](https://support.google.com/mail/answer/81126?hl=fr).

## Matrice restant à exécuter sur la version candidate

Apple Mail est un client : noter également le fournisseur de la boîte utilisée.
Pour chaque ligne, tester les six événements en FR/EN et conserver date,
version du client/OS, mode clair/sombre, largeur et résultat. Les imports `.eml`
peuvent vérifier le rendu ; seuls des messages reçus via OVH peuvent vérifier
leur authentification et leur placement. Ne pas transférer les messages pour
cette dernière vérification.

| Client | Statut | Contrôles |
|---|---|---|
| Gmail web et application mobile | Non exécuté | Objet/aperçu, accents, texte, contraste, bouton et lien avec fragment |
| Outlook classique Windows | Non exécuté | Conteneur 600 px, police, bouton, code/URL longs ; contrôle à 100 % et 125 % de mise à l’échelle |
| Nouvel Outlook / Outlook web | Non exécuté | Mêmes contrôles, notamment liens réécrits et mode sombre |
| Apple Mail macOS et iOS | Non exécuté | Mêmes contrôles, code copiable entier et largeur mobile |

Contrôler aussi images distantes bloquées, texte seul et zoom à 200 %. Aucun
asset distant n’est requis. Depuis chaque boîte, ouvrir le lien puis vérifier
que le fragment est conservé jusqu’à la page Argos, qu’un GET ne consomme rien
et que seul le POST explicite réalise l’action. Utiliser exclusivement des
comptes synthétiques identifiés et prévoir leur archivage avec
`{ "confirmed": true }` après réauthentification.

Relever le verdict d’authentification du serveur destinataire de confiance :
`spf`, `dkim`, `dmarc`, domaines d’enveloppe/From/signature et alignement,
date de réception, dossier d’arrivée et éventuel rejet. Exporter seulement les
résultats expurgés ; ne pas versionner le MIME d’un compte actif. Les six
événements doivent conserver texte exploitable, action/code correct et durée
conforme à la configuration. Les notifications de rapport #97 sont hors périmètre.
