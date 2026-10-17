# Galerie des e-mails de compte — #634

La refonte des six envois et de leurs contenus FR/EN a été fusionnée dans les
PR #688 et #699. La [galerie](email-previews/index.html) permet maintenant de
les consulter ensemble : objet, aperçu, contenu HTML, texte seul, largeur
d’affichage et apparence. Elle utilise les exports synthétiques du moteur de
production, sans changer les modèles envoyés ni ajouter de route applicative.

## Vérifications du 18 octobre 2026

- `AccountEmailTest` et `SmtpAccountMailTest` : 7 tests réussis. Le premier
  lancement dans le bac à sable a échoué sur les connexions SMTP locales ;
  la relance avec accès loopback autorisé passe intégralement.
- Les 24 fichiers HTML/texte versionnés correspondent aux exports fraîchement
  générés, après normalisation des fins de ligne Windows.
- Matrice existante : 144 rendus Chromium réussis, six événements, deux langues,
  quatre largeurs et trois modes (clair/sombre/styles inline seulement).
- Galerie dans le navigateur intégré : les douze variantes sélectionnées,
  passage HTML/texte, objet et contenu correspondant ; bouton de démonstration
  actionné sans navigation. Géométrie sans débordement mesurée à
  320/390/768/1280 px ; captures examinées sur ordinateur avec un message
  de 680 px en clair et de 390 px en sombre.
- Générateur sans dépendance : syntaxe JavaScript valide, reconstruction
  identique à partir des mêmes sources, `git diff --check` réussi.

Les contrôles de largeur ont conduit à actualiser automatiquement l’indication
de largeur réellement affichée lorsque le conteneur change de taille.
La galerie conserve les libellés accessibles, l’état du message sélectionné,
le focus visible et un iframe titré. Les modèles d’e-mail gardent leur propre
document et leur langue. Aucun build Next supplémentaire n’est nécessaire :
la galerie est un document de recette local indépendant du frontend.

## Captures synthétiques

- [Galerie FR, vérification, apparence claire](email-previews/screenshots/gallery-fr-desktop.jpg).
- [Galerie EN, réinitialisation à 390 px, apparence sombre](email-previews/screenshots/gallery-reset-en-dark.jpg).

Tous les contenus sont fictifs (`argos.example`, jetons synthétiques). La
galerie embarque les messages, scripts et styles ; aucun chargement distant
n’est nécessaire. L’ouverture `file:` n’a pas été exécutée par l’outil de
navigateur, qui interdit ce protocole. La revue s’est faite via un serveur
statique limité à loopback ; le fichier peut être conservé et ouvert localement.

## Limites et suivi de l’issue

La galerie ne simule aucun moteur de client mail. Les validations Gmail,
Outlook classique/web et Apple Mail restent à exécuter selon la
[matrice existante](email-delivery-review.md). Cette PR ne clôture donc pas
#634. Le suivi antérieur de délivrabilité et de nettoyage du compte synthétique
reste dans cette même note ; aucune nouvelle réception externe, modification
DNS ou opération sur un compte n’a été effectuée dans cette tâche.
