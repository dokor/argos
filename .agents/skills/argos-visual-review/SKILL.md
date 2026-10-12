---
name: argos-visual-review
description: "Vérifier et corriger le rendu et les parcours Argos après un changement UI/UX : comparaison avant/après, responsive, thèmes, langues et accessibilité avec preuves. Ne pas activer pour une modification backend sans effet visuel ni pour la seule édition de documentation."
---

# Revue visuelle Argos

Inspecter les écrans réellement rendus. Un build réussi ne valide pas une composition, et une capture seule ne valide pas un parcours.

## Préparer une vérification proportionnée

Lire les instructions du dépôt et de l'outil navigateur disponible. Identifier les pages et composants touchés, le défaut à reproduire et les consommateurs d'un style partagé. Une modification locale ne demande pas une revue intégrale du produit ; une modification de navigation ou de tokens demande un échantillon de ses consommateurs, dont accueil et rapport.

Pour démarrer le frontend et choisir les données, lire [l'aperçu local](references/preview.md). Utiliser uniquement des données fictives pour les preuves partageables. Ne pas exposer de token privé ou de données de compte réelles dans les captures ou les logs.

Avant une refonte ou la correction d'un défaut visuel, conserver l'état initial lorsque l'environnement le permet. Reprendre les mêmes dimensions, langue, thème et fixture après correction. Si la référence manque, le signaler.

## Attendre l'état visible et exercer le parcours

Inspecter le DOM rendu pour choisir les contrôles par rôle et nom accessible. Attendre le contenu pertinent : titre affiché, chargement terminé, dialogue ouvert ou résultat de filtre. Ne pas imposer `networkidle` à un écran qui effectue du polling ; une attente réseau globale ne prouve pas que l'état attendu est affiché.

Utiliser les fonctionnalités autorisées par l'outil navigateur courant. Ne pas substituer un accès CDP, un script injecté ou une autre bibliothèque à une capacité interdite. Pour les tests du dépôt, réutiliser les scripts E2E appropriés et leurs prérequis indiqués dans [l'aperçu local](references/preview.md).

Choisir la couverture avant de commencer :

- Pages modifiées : desktop et mobile autour de 390 px ; 320 px lorsque navigation, titres ou actions sont serrés.
- Grilles et changements de layout : largeur intermédiaire autour de 768 px, abords des breakpoints concernés et zoom texte/page à 200 % si l'outil le permet.
- Interactions modifiées : clair/sombre, FR/EN, clavier, état nominal et états d'erreur ou de données absentes pertinents.
- Styles partagés : un consommateur représentatif de chaque usage affecté.

Le relevé doit nommer les combinaisons effectivement exercées, sans laisser croire que tout le produit ou tout le produit cartésien a été testé.

## Examiner en deux passes

**Parcours et sens.** Exécuter la tâche principale et les chemins de reprise concernés. Vérifier les filtres actifs, le résultat vide, les accordéons, les ancres et les retours de traitement. Distinguer absence de problème et absence de mesure. Une action du plan doit ouvrir le bon constat. Contrôler les erreurs console et requêtes en échec liées au parcours si l'outil les expose.

**Composition et accès.** Examiner captures et éléments rendus :

- Débordement de page, textes tronqués, mots comprimés, hiérarchie, contrastes et densité. Un tableau peut défiler dans son conteneur.
- CTA voisins et champs associés : hauteur rendue, typographie, alignement et centrage des icônes ; mesurer les rectangles DOM si nécessaire. Un même `min-height` ne garantit pas une géométrie identique.
- Espacements, rayons, bords communs, poids réel des titres et marqueurs de listes ; vérifier après succès de copie et avec les libellés longs.
- Focus visible et non masqué par l'en-tête, noms accessibles, titres et états exposés. Tester l'ouverture et la fermeture clavier des menus/dialogues, dont le retour du focus, quand ils sont concernés.
- Ancres sous en-tête fixe et adaptation à ses deux lignes mobiles ; respect du mouvement réduit pour les animations concernées.

Un scanner d'accessibilité disponible apporte des constats automatiques ; il ne remplace pas le clavier, l'examen visuel ni les tests avec technologies d'assistance. L'arbre d'accessibilité seul ne démontre pas ce qu'un lecteur d'écran annonce.

## Corriger et revérifier

Classer les constats par impact : tâche bloquée, information trompeuse ou illisible, friction d'usage, finition. Attacher à chacun un état reproductible et une preuve ; séparer un défaut observé d'une hypothèse de design. Traiter la cause dans le composant ou le style partagé, puis rejouer le scénario et vérifier un consommateur voisin si nécessaire.

Exécuter les tests pertinents pour les comportements changés et le build frontend quand le code frontend a changé. Un changement de documentation ou de skill seul demande une validation de ses instructions et liens, pas un build de l'application. Ne pas écrire de tests qui recopient simplement les valeurs CSS.

## Livrer avec les preuves

Utiliser le [format de compte rendu](references/evidence.md). Conserver les captures disponibles et le relevé dans `outputs/ui-review/<sujet>/`, puis reporter le bilan dans la PR ; ce dossier est ignoré par Git. Joindre les artefacts à la PR ou à la CI si ce mécanisme est disponible, sinon donner leur chemin local sans promettre qu'un reviewer distant y a accès.

Si le navigateur, une capture ou une mesure manque, continuer les vérifications possibles et indiquer précisément la limite. Une vérification non exécutée reste « non vérifiée ». Ne jamais annoncer une validation visuelle complète, une amélioration mesurée de l'utilisabilité ou une conformité WCAG sur la seule base d'une lecture de code ou d'un scanner.
