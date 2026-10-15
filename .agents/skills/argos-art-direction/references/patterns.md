# Repères de composition et de réutilisation Argos

Chemins de code ci-dessous relatifs à la racine du dépôt. Lire le composant concerné et ses consommateurs avant de l'étendre ; ces repères ne sont pas des captures approuvées.

## Choisir selon la tâche

| Surface | Ordre de lecture recherché | Points de réutilisation |
|---|---|---|
| Accueil et ressources | Proposition concrète, preuve ou explication, action pertinente | `src/components/site/SiteDocument.tsx`, `SiteNav.tsx`, `SiteFooter.tsx` et `src/styles/_editorial.scss` dans `apps/console-web/` |
| Rapport privé | Identité et périmètre, mesure et couverture, actions, preuves | `apps/console-web/src/components/report/ReportSummary.tsx`, `ReportNavigation.tsx`, `PriorityCards.tsx`, `IssuesByCategory.tsx` |
| Administration | Objet recherché, filtres, résultats comparables, détail et action | Explorer `apps/console-web/src/app/(fr)/account/admin/`, `apps/console-web/src/app/en/account/admin/` et leurs imports ; conserver pagination, permissions et accès au rapport |

La navigation publique reste cohérente entre les pages. Un tableau de travail peut garder une densité plus élevée qu'une introduction publique sans réduire la lisibilité ni les cibles interactives.

## Sources du système existant

- Couleurs résolues par thème : `apps/console-web/src/app/globals.css`.
- Espacements, rayons, typographie et largeurs : `apps/console-web/src/styles/_tokens.scss`.
- Géométrie des CTA voisins : `apps/console-web/src/styles/_controls.scss`, mixin `cta-geometry`.
- Introductions, titres et ancres des ressources : `apps/console-web/src/styles/_editorial.scss`.
- Conventions publiques : [public-design.md](../../../../docs/ux/public-design.md) et [spacing.md](../../../../docs/ux/spacing.md).

Lire les valeurs à leur source. Ne pas créer une seconde palette ou recopier une échelle chiffrée dans ce document. `ShareReportButton`, `RelaunchButton`, `StatusBadge` et `ScoreChip` sont des composants existants à examiner selon le besoin ; ne pas supposer l'existence d'un composant générique `Button`.

## Géométrie et contenu

- Dans un même groupe d’actions, les CTA voisins ont la même hauteur, la même typographie, les mêmes espacements verticaux et des icônes alignées. La couleur et le traitement de bordure expriment la priorité ; une action secondaire ne doit pas être plus petite par accident. Partager la géométrie via `apps/console-web/src/styles/_controls.scss`, plutôt que répéter des valeurs dans chaque bouton.
- Aligner les champs et leur bouton lorsqu’ils partagent une ligne ; garder des zones tactiles d’au moins 44 px. Autoriser un empilement sur mobile sans tronquer les libellés ni imposer une hauteur qui coupe un texte sur deux lignes.
- Conserver le rythme des espacements, les rayons et les bordures entre composants comparables. Vérifier les bords communs, les alignements de texte et les dimensions des icônes, pas seulement la palette.
- Les états chargement, succès et erreur ne doivent pas déplacer les CTA voisins. Réserver une place aux icônes et placer les messages hors du bouton ; garder un focus visible sans masquer le contenu.
- Vérifier la graisse réellement rendue des titres : le reset global neutralise les styles natifs des titres et des listes. Définir explicitement la hiérarchie dans les modules (`editorial.headings` pour les ressources) et restaurer les puces ou la numérotation des listes de prose.
- Aligner les bords extérieurs du contenu avec les gouttières de navigation ; ne pas ajouter une seconde marge mobile à une section déjà contenue dans une grille. Réserver une seule séparation entre deux sections et contrôler les cartes aux largeurs intermédiaires, où un score peut repousser un libellé.
- Sur les lignes de constats, donner au titre une largeur lisible : les badges et chevrons passent sur une ligne distincte quand ils compriment le texte. Un écran sans débordement peut néanmoins avoir des mots coupés presque lettre par lettre ; vérifier la capture, pas seulement `scrollWidth`.
- Adapter les marges d’ancrage à la hauteur réellement rendue des en-têtes fixes, y compris leurs deux lignes sur mobile. Les introductions publiques partagent `editorial.anchors`.

## Exemples de décisions

- Un titre de constat devient une colonne de quelques caractères à 390 px : redistribuer badge et chevron, puis relire le titre sur la capture. Cacher le débordement ne corrige pas la compression.
- Un bouton de copie change de largeur au succès : conserver sa géométrie et placer le retour dans une zone dédiée, puis vérifier focus et annonce. Ne pas simuler seulement le libellé initial.
- Une recommandation est importante : sa formulation et sa position portent la hiérarchie ; un fond coloré supplémentaire ne doit pas être le seul signal.
- Une ressource contient une procédure : garder une liste ordonnée et ses marqueurs visibles. Une liste de sujets sans ordre logique ne nécessite pas de numérotation décorative.

## Invariants du rapport

Conserver les trois modes de lecture du rapport : vue d’ensemble, plan d’action et constats techniques. L’identité, le périmètre, le score et la couverture donnent le contexte commun ; les actions et leurs liens ouvrent le constat canonique correspondant. Prévoir des liens d’accès direct aux sections. Garder les informations de couverture et les scores indisponibles visibles ; ne pas présenter l’absence de mesure comme un zéro ou une réussite.

Les compteurs proviennent des constats canoniques construits depuis `report.issues`, les actions de `summary.priorities`. Respecter le classement du modèle courant, avec trois actions dans la vue d’ensemble et au plus six dans le plan d’action. Les gains sont théoriques : garder leur libellé et leurs limites à proximité. Les détails peuvent être repliés, mais le titre et l’impact de l’action restent visibles.

## Références visuelles

Lors d'une refonte, conserver une capture de départ et de résultat avec route, état, thème, langue et dimensions. Une capture existante documente un rendu, elle ne vaut pas approbation de ce rendu. N'appeler « référence validée » qu'un visuel explicitement validé par l'utilisateur ; l'associer à son contexte et à la PR plutôt que créer une collection d'images sans provenance.
