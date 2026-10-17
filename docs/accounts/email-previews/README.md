# Aperçus des e-mails de compte

Ouvrir la [galerie interactive](index.html) dans un navigateur : les six messages
sont disponibles en FR/EN, en HTML ou texte seul, avec une largeur ordinateur,
mobile ou petit mobile et les apparences claire/sombre. Le fichier est autonome,
fonctionne hors ligne et ne nécessite aucun service applicatif. Les liens dans
les e-mails y sont désactivés. Sur un écran plus étroit, la largeur est limitée
à l’espace disponible et la largeur réellement affichée est indiquée.

HTML et texte générés par `AccountEmailTest.exportPreviewsWhenRequested`, sans
donnée réelle. Les liens `argos.example` et codes synthétiques sont inactifs.
Le HTML est celui envoyé par SMTP ; la première ligne des fichiers texte donne
l’objet. Les durées sont celles de la configuration par défaut (24 h / 30 min).

| Message | Français | English |
|---|---|---|
| Vérification / bienvenue | [HTML](verify-fr.html), [texte](verify-fr.txt) | [HTML](verify-en.html), [text](verify-en.txt) |
| Réinitialisation | [HTML](reset-fr.html), [texte](reset-fr.txt) | [HTML](reset-en.html), [text](reset-en.txt) |
| Code de confirmation | [HTML](reauth-fr.html), [texte](reauth-fr.txt) | [HTML](reauth-en.html), [text](reauth-en.txt) |
| Mot de passe modifié | [HTML](password_changed-fr.html), [texte](password_changed-fr.txt) | [HTML](password_changed-en.html), [text](password_changed-en.txt) |
| Moyen ajouté | [HTML](method_added-fr.html), [texte](method_added-fr.txt) | [HTML](method_added-en.html), [text](method_added-en.txt) |
| Moyen retiré | [HTML](method_removed-fr.html), [texte](method_removed-fr.txt) | [HTML](method_removed-en.html), [text](method_removed-en.txt) |

Voir les [instructions de régénération et les limites de recette](../emails.md).
Le même export produit des `.eml` importables dans une boîte de test, sous
`outputs/account-email-preview/`. Après régénération, copier les fichiers
HTML/texte dans ce dossier pour actualiser les aperçus versionnés.

Après actualisation des fichiers HTML/texte, reconstruire la galerie depuis
la racine du dépôt :

```sh
node scripts/build-account-email-gallery.mjs
```

Le générateur embarque les exports sans réécrire leurs contenus. L’apparence
choisie dans la galerie active ou désactive uniquement la media query sombre
existante dans l’aperçu affiché ; les fichiers source restent inchangés. Ce
rendu navigateur ne remplace pas une recette dans les clients mail, décrite
dans la [matrice de validation](../email-delivery-review.md).
