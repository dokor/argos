---
name: argos-art-direction
description: Concevoir ou améliorer l’UI des pages Argos avec une direction artistique sobre, éditoriale et centrée sur les données. Utiliser pour les changements visuels du frontend, pas pour les modifications backend seules.
---

# Direction artistique Argos

Argos est un outil de diagnostic : le visiteur doit comprendre ce qui a été mesuré, ce qui mérite son attention et comment agir. Donner à chaque écran une composition intentionnelle, plutôt qu’une collection de cartes interchangeables.

## Parti pris

- Utiliser des surfaces neutres, une typographie nette et une seule couleur de marque indigo. Réserver rouge, ambre et vert aux statuts et mesures, accompagnés de texte.
- Favoriser les séparateurs, les listes et l’espace pour organiser l’information. Garder les cartes pour des unités autonomes ou des choix cliquables. Éviter les panneaux imbriqués, les ombres répétées, les fonds à pois et les dégradés sans fonction.
- Aligner à gauche les contenus explicatifs. Limiter les paragraphes à environ 65–75 caractères par ligne. Créer une hiérarchie perceptible entre titre, résultat, action et métadonnées.
- Réutiliser la police du document ; chiffres tabulaires pour les scores et compteurs. Les textes de travail doivent rester lisibles sur mobile ; ne pas employer une taille de légende pour une recommandation.
- Préférer des textes précis et des symboles sobres aux slogans génériques et aux emojis décoratifs.

## Cohérence des composants

- Dans un même groupe d’actions, les CTA voisins ont la même hauteur, la même typographie, les mêmes espacements verticaux et des icônes alignées. La couleur et le traitement de bordure expriment la priorité ; une action secondaire ne doit pas être plus petite par accident. Partager la géométrie via `apps/console-web/src/styles/_controls.scss`, plutôt que répéter des valeurs dans chaque bouton.
- Aligner les champs et leur bouton lorsqu’ils partagent une ligne ; garder des zones tactiles d’au moins 44 px. Autoriser un empilement sur mobile sans tronquer les libellés ni imposer une hauteur qui coupe un texte sur deux lignes.
- Conserver le rythme des espacements, les rayons et les bordures entre composants comparables. Vérifier les bords communs, les alignements de texte et les dimensions des icônes, pas seulement la palette.
- Les états chargement, succès et erreur ne doivent pas déplacer les CTA voisins. Réserver une place aux icônes et placer les messages hors du bouton ; garder un focus visible sans masquer le contenu.
- Vérifier la graisse réellement rendue des titres : le reset global neutralise les styles natifs des titres et des listes. Définir explicitement la hiérarchie dans les modules (`editorial.headings` pour les ressources) et restaurer les puces ou la numérotation des listes de prose.
- Aligner les bords extérieurs du contenu avec les gouttières de navigation ; ne pas ajouter une seconde marge mobile à une section déjà contenue dans une grille. Réserver une seule séparation entre deux sections et contrôler les cartes aux largeurs intermédiaires, où un score peut repousser un libellé.
- Sur les lignes de constats, donner au titre une largeur lisible : les badges et chevrons passent sur une ligne distincte quand ils compriment le texte. Un écran sans débordement peut néanmoins avoir des mots coupés presque lettre par lettre ; vérifier la capture, pas seulement `scrollWidth`.
- Adapter les marges d’ancrage à la hauteur réellement rendue des en-têtes fixes, y compris leurs deux lignes sur mobile. Les introductions publiques partagent `editorial.anchors`.

## Mise en pratique

Lire les composants concernés, `apps/console-web/src/styles/_tokens.scss` et `apps/console-web/src/app/globals.css`. Examiner le rendu avant une refonte. Formuler un bref parti pris pour l’écran puis implémenter dans les SCSS Modules existants. Les pages de ressources utilisent le mixin `styles/_editorial.scss` pour harmoniser les introductions.

Conserver les tokens sémantiques `--argos-*`, les thèmes clair/sombre, l’i18n FR/EN et les liens localisés. Ne pas introduire Tailwind, shadcn ou Radix. Une demande de design n’autorise ni une modification du scoring ni une publication.

## Rapport

Conserver les trois modes de lecture du rapport : vue d’ensemble, plan d’action et constats techniques. L’identité, le périmètre, le score et la couverture donnent le contexte commun ; les actions et leurs liens ouvrent le constat canonique correspondant. Prévoir des liens d’accès direct aux sections. Garder les informations de couverture et les scores indisponibles visibles ; ne pas présenter l’absence de mesure comme un zéro ou une réussite.

Les compteurs proviennent des constats canoniques construits depuis `report.issues`, les actions de `summary.priorities`. Respecter le classement du modèle courant, avec trois actions dans la vue d’ensemble et au plus six dans le plan d’action. Les gains sont théoriques : garder leur libellé et leurs limites à proximité. Les détails peuvent être repliés, mais le titre et l’impact de l’action restent visibles.

Valider la composition au moyen du skill `argos-visual-review` lorsqu’il est disponible, sinon avec une inspection équivalente du navigateur. Signaler les limites de vérification effectivement rencontrées.
