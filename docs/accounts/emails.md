# E-mails de compte — #634

Le modèle reprend Clarté : fond `#f6f7fb`, surface blanche, texte `#172239`,
secondaire `#58677d`, bordure `#dfe5ee`, action `#5045dd`, rayon 9 px. La palette
sombre reprend aussi `Connected.module.scss`. Typographie système compatible
mail, contenu aligné à gauche, séparateurs, bouton explicite de 44 px minimum.
Aucune police distante, image, script ou mesure d’ouverture.

## Inventaire et parcours

| Événement existant | Contenu et action | Durée par défaut |
|---|---|---|
| Inscription / renvoi / confirmation après connexion sociale | Bienvenue et vérification d’adresse ; `/account/verify#token=…` | 24 h |
| Mot de passe oublié | Choisir un nouveau mot de passe ; `/account/reset#token=…` | 30 min |
| Confirmation d’une opération sensible | Code à copier dans la fenêtre où il a été demandé ; aucun bouton de validation | 30 min |
| Réinitialisation ou définition du mot de passe | Alerte et lien vers les réglages de sécurité | Pas de jeton |
| Association d’un fournisseur de connexion | Alerte et lien vers les moyens de connexion | Pas de jeton |
| Retrait d’un moyen de connexion | Alerte et lien vers les moyens de connexion | Pas de jeton |

Les chemins anglais sont préfixés `/en`. Il n’existe pas d’envoi distinct de
bienvenue après vérification, ni d’e-mail de fermeture : aucun nouvel événement
n’est ajouté. Les notifications de rapport (#97) restent hors périmètre.

`AccountSettings.tokenTtl` fournit **la même durée** au jeton DB et au texte.
Chaque lien/code est à usage unique ; un renvoi invalide le précédent. Un GET
n’effectue pas la confirmation. Les règles de consommation, CSRF, transaction,
session et révocation restent celles d’`AccountAuthService`.

La langue vient du parcours courant, normalisée FR/EN par le BFF. Pour OAuth,
elle vient de la destination conservée dans le cookie HttpOnly. Les services
appelés sans langue explicite restent français ; aucune préférence personnelle
n’est ajoutée en base. Les objets, aperçus, aides et pieds de page sont localisés.

## Transport et aperçus

`SmtpAccountMail` envoie un `multipart/alternative` UTF-8, texte puis HTML.
Tables de présentation, styles essentiels inline, conteneur fluide borné à
600 px et largeur conditionnelle Outlook ; les media queries améliorent le
mobile/sombre, sans porter l’information indispensable. Le lien complet reste
lisible et copiable si le bouton n’est pas rendu. Le code long peut se replier.
Le SMTP de production est celui d’OVH, confirmé par l’opérateur le 16 octobre.

Les [aperçus HTML et texte](email-previews/README.md) sont générés avec les
mêmes fonctions que les envois. Données et jetons exclusivement fictifs.

Depuis `apps/api-backend`, régénérer les 12 variantes et leurs fichiers `.eml` :

```sh
mvn -Dtest=AccountEmailTest -Daccount.mail.preview.dir=../../outputs/account-email-preview test
```

Ouvrir les fichiers HTML localement. Les `.eml` permettent l’import dans une
boîte de recette, sans expédier de vrai jeton. Ne jamais envoyer ces aperçus
aux utilisateurs ou ajouter une route d’aperçu publique en production.

## Vérifications et limites

Les tests relisent le MIME sérialisé, contrôlent le texte/HTML UTF-8, les six
événements FR/EN, l’échappement et les durées configurées. Les tests BFF/client
couvrent la transmission de la langue, y compris le retour OAuth.

La recette navigateur est décrite dans [la note visuelle](email-review.md).
La [recette complémentaire du 17 octobre](email-delivery-review.md) documente
le test du transport SMTP, la matrice de rendu local, deux réceptions externes
via OVH et l’absence de DMARC observée sur le domaine d’expédition. Elle fournit
la matrice Gmail, Outlook et Apple Mail restant à exécuter. Le rendu navigateur
et la réception jetable ne valident pas ces clients ni leur placement antispam.
