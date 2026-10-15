---
name: argos-art-direction
description: "Concevoir ou améliorer une page ou un composant Argos : parcours, hiérarchie, états et composition dans le système visuel existant. Utiliser pour les changements UI/UX du frontend, pas pour le backend seul ni une simple recherche documentaire."
---

# Direction artistique Argos

Argos aide à comprendre ce qui a été mesuré, ce qui mérite une intervention et comment agir. Adapter la composition à cette tâche et au niveau de lecture de l'écran.

## Cadrer avant de coder

- Lire les composants concernés, les tokens et les styles globaux. Vérifier la stack dans le `package.json` courant ; les versions mentionnées dans les documents peuvent être anciennes.
- Examiner le rendu existant avant une refonte. Pour un défaut local, reproduire le défaut et identifier le composant partagé responsable avant de modifier les styles.
- Formuler un bref contrat dans la mise à jour de travail : qui utilise cet écran, quelle décision ou action il doit permettre, quel contenu doit dominer, quels états changent et comment le résultat sera vérifié. Déduire ces éléments du contexte disponible ; ne poser une question que si une information manquante change réellement la solution.
- Distinguer les surfaces : l'accueil explique l'audit et permet de le lancer ; le rapport guide une décision ; l'administration facilite un travail répété. Une même grille de cartes ne répond pas nécessairement aux trois besoins.
- Pour un nouveau parcours, prévoir l'entrée, l'action, le résultat et la reprise après erreur. Pour une retouche de bouton, une phrase suffit : ne pas imposer une phase de conception complète.

## Choisir une référence et réutiliser

Lire [les repères Argos](references/patterns.md) pour choisir un composant ou une composition. Ils désignent des points de réutilisation, pas des écrans certifiés sans défaut.

Si l'utilisateur fournit une capture ou une maquette, relever sa hiérarchie, ses proportions, ses états et ses contraintes responsive ; comparer ensuite le rendu aux mêmes dimensions. Une référence externe apporte des principes, pas une nouvelle identité imposée à Argos. Si Figma est disponible et demandé, récupérer le contexte et la capture du même nœud ; traduire le résultat en SCSS Modules et composants existants. Une maquette inaccessible reste une limite à signaler, pas une invitation à inventer ses détails.

## Parti pris Argos

- Surfaces neutres, police du document, indigo de marque ; rouge, ambre et vert pour les statuts accompagnés de texte. Conserver les tokens sémantiques `--argos-*`, les thèmes clair/sombre, FR/EN et les liens localisés.
- Donner la priorité au contenu : titre, résultat, prochaine action puis métadonnées. Aligner les explications à gauche, viser environ 65–75 caractères par ligne et utiliser des chiffres tabulaires pour les mesures.
- Préférer listes, séparateurs et espace aux panneaux imbriqués. Les cartes servent des unités autonomes ou des choix cliquables. Les décorations, animations et nouvelles polices doivent servir un besoin explicite.
- Écrire des libellés qui décrivent l'action et garder le même vocabulaire jusqu'au retour de succès. Un état vide, une erreur et une absence de mesure demandent des explications différentes.
- Implémenter dans les SCSS Modules existants. Ne pas introduire Tailwind, daisyUI, shadcn ou Radix pour appliquer une référence. Ne pas changer le scoring ou publier à l'occasion d'une retouche de design.

## Définir les états utiles

Pour chaque interaction modifiée, identifier les états pertinents : repos, focus, traitement, succès, erreur, désactivation ou données absentes. Préciser ce qui déclenche la transition, ce que l'utilisateur voit et comment il peut continuer. Ne pas ajouter artificiellement tous ces états à un élément statique.

Réserver l'espace nécessaire aux retours de traitement, conserver les saisies après un échec quand le flux le permet, et éviter les confirmations qui déplacent les boutons. Une action désactivée doit avoir une raison compréhensible. L'information indispensable et les actions doivent rester accessibles sans survol.

## Implémenter puis critiquer

Faire une première passe fonctionnelle avec les contenus réels ou les fixtures contrôlées, puis examiner le rendu :

1. La tâche principale et le prochain geste sont-ils identifiables ?
2. Les groupes, alignements, tailles de texte et espacements rendent-ils la hiérarchie lisible ?
3. Les états et le passage au mobile conservent-ils le sens, les contrôles et les informations de couverture ?

Corriger le défaut observé de plus fort impact, puis vérifier à nouveau la zone et ses consommateurs si un style partagé a changé. Ne pas masquer un défaut de grille par `overflow-x: hidden`, une police minuscule ou une cascade d'overrides. Les détails de géométrie et les invariants des rapports figurent dans [les repères Argos](references/patterns.md).

Terminer avec [argos-visual-review](../argos-visual-review/SKILL.md), ou une inspection équivalente si ce skill n'est pas disponible. Ne déclarer le rendu validé qu'avec les preuves correspondantes.

## Entretien du skill

Pour réviser cette méthode, consulter [la sélection communautaire](../../../docs/ux/design-skills.md) et [les scénarios d'évaluation](../../../docs/testing/design-skills.md). Ces documents ne sont pas à charger pour une retouche UI ordinaire.
