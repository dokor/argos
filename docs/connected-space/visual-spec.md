# Contrat visuel Clarté

La [référence figée](reference/README.md) est le point de comparaison.
Le fragment est archivé sans modification ; ses incohérences fonctionnelles
sont résolues dans [decisions.md](decisions.md). Le JavaScript de démonstration
ne sert pas de base technique au frontend.

## Composition et rythme

| Élément | Référence à conserver |
|---|---|
| Shell desktop | Sidebar 212 px, contenu flexible `minmax(0,1fr)`, surfaces distinctes, navigation sélectionnée violet discret |
| Bandeau | Hauteur minimale 66 px, séparation fine, contexte et commandes peu saillantes |
| Contenu | Marges 28 px desktop, 14–15 px mobile ; titre et introduction puis blocs, pas de hero marketing |
| Blocs | Rayon 9 px, bordure 1 px, fond de surface, padding 22 px desktop / 15–18 px mobile, espacement vertical 20 px |
| Grilles | 3 KPI, puis blocs de travail ; gaps 12–20 px ; repli sans masquer une donnée utile |
| Titres | h1 30/36 px desktop, 27 px mobile ; h2 17 px ; corps 14 px, interligne 1,5 ; chiffres tabulaires |
| Actions | Une action principale clairement identifiée par bloc ; hauteur interactive cible 44 px ; libellés explicites |
| Tableaux | URL lisible, statut séparé du score, priorité lisible, métadonnées secondaires ; pas de lignes entièrement ambiguës/cliquables |
| Footer | Délimitation fine, sobre, complet ; visible aussi sur pages compte/admin/intégrations et états vides |

Le cadre arrondi externe et le badge de démonstration de l’aperçu ne font pas
partie de l’application. L’interface peut occuper tout le viewport. Conserver
les proportions internes à largeur de contenu égale pour les comparaisons.

## Couleurs de référence et tokens

| Usage | Clair / sombre du prototype |
|---|---|
| Fond | `#f6f7fb` / `#101624` |
| Surface | `#ffffff` / `#192233` |
| Texte | `#172239` / `#e6edf8` |
| Secondaire | `#58677d` / `#a8b5cb` |
| Bordure | `#dfe5ee` / `#334159` |
| Accent / fond sélection | `#5045dd` / `#efedff` ; sombre `#b6b0ff` / `#2b2950` |
| Succès | `#18674c` sur `#eaf6ef` ; sombre `#8cdbb9` sur `#1b3a32` |
| Alerte | `#80520f` sur `#fff4df` ; sombre `#efd096` sur `#3e3423` |
| Critique | `#ae293c` sur `#fff0f2` ; sombre `#ffa8b5` sur `#402535` |

Mapper ces rôles aux tokens sémantiques `--argos-*` existants. Les tokens
supplémentaires doivent être documentés et limités au shell connecté si leur
changement ferait dériver le public. SCSS Modules exclusivement, typographie
du projet, icônes du système existant. Pas de Tailwind, shadcn ou Radix.
Ne pas importer les centaines de règles globales `.a-*` de la maquette.

## Composants à partager

`AccountShell`, `PageHeading`, `KpiCard`, `Surface`, `StatusBadge`,
`ScoreWithCoverage`, `QuotaSummary`, `DomainCard`, `FindingSummary`,
`AuditPagesTable`, `EmptyState`, `InlineError`, `ConfirmDialog`, `AccountFooter`.
Les noms sont indicatifs ; mutualiser le rendu, pas les autorisations. Séparer
présentation, accès données et transformations testables. Un statut a le même
libellé et la même couleur dans la liste, le détail et le dashboard.

## Responsive, accessibilité et traduction

- Références à 1056 et 390 px ; recette produit à **320, 390, 768, 1056 et 1440 px**.
- Sous environ 620 px, navigation compacte et compte toujours accessible ;
  les grilles passent en colonnes adaptées. Les seuils peuvent être ajustés
  d’après le contenu, pas pour réussir une seule capture.
- Aucun scroll horizontal global. Un tableau dense peut défiler dans une
  région identifiée, avec URL/statut/action accessibles. Préférer des lignes
  adaptées pour les domaines. URL longue et texte anglais sont des cas de test.
- Focus visible, liens/boutons sémantiques, labels visibles, états annoncés
  avec modération, erreurs reliées au champ, un h1 et hiérarchie sans saut.
- Ne pas reproduire les petits textes de 9–10 px là où ils portent une
  information indispensable : remonter la taille et adapter le bloc. La
  lisibilité et le contraste AA priment sur une égalité pixel parfaite.
- FR/EN dans le système i18n existant, nombres/dates localisés, thème clair
  et sombre ; pas de texte métier français dans les composants.

## Validation visuelle

Capturer les mêmes états avec la fixture canonique, date/horloge et fontes
stables. Comparer côte à côte et en superposition : ordre des blocs, densité,
alignements, titres, rayons, couleurs et footer. Un diff pixel automatique
détecte une dérive ; il ne valide pas seul l’UX. Ne pas relever un seuil de
diff ni régénérer une baseline pour masquer un défaut.

Les écarts attendus (KPI corrigés, typographie accessible, vraie couverture,
contrôles administratifs) doivent être listés dans la PR. Une capture du
prototype n’est jamais présentée comme une capture du produit implémenté.
