# Placement du « Le saviez-vous ? »

Revue du build de production local avec le backend de démonstration en lecture seule. Les noms, domaines, comptes, scores et crédits visibles sont fictifs.

## Résultat

- Espace connecté : un seul conseil après le titre et l’introduction ; suppression du conseil du pied de page.
- Rapports : conseil après l’identité de la page et avant le score, y compris les rapports intégrés à l’espace personnel. L’exemple public et l’impression restent sans conseil.
- Lancement d’une analyse d’URL ou de domaine : conseil dans la colonne de droite sur ordinateur, puis après le formulaire sur écran étroit.
- Fond indigo léger et lien de source conservés en français/anglais et en clair/sombre ; les styles de prose des pages d’administration ne modifient plus l’espacement du conseil.

## Parcours effectivement contrôlés

À 1280 px : nouvelle analyse, découverte de domaine, vue d’ensemble, sites, historique d’une URL, domaines, offre et quotas, compte, intégrations, mesure produit, traitement des retours et rapport complet. Vérification du nombre de conseils, de leur position, de l’absence de conseil dans le pied de page et des débordements horizontaux.

Fenêtres de revue contenant les pages réelles : formulaire d’analyse FR à 390 px, EN à 320 px, découverte de domaine FR à 768 px, rapport partiel EN à 320 px. Le navigateur réserve une gouttière de défilement ; la largeur disponible pour le contenu est donc légèrement inférieure à ces valeurs. Les formulaires précèdent bien le conseil et aucun débordement de page n’a été mesuré.

Les captures couvrent les thèmes clair et sombre. Les contrôles des formulaires sont restés en lecture ; aucune analyse n’a été lancée et aucune donnée réelle n’a été modifiée.

Limite : la fixture de la liste des utilisateurs d’administration ne fournit pas l’objet `usage` attendu par son tableau et déclenche une erreur déjà présente dans les données de démonstration. Ce tableau n’a pas été validé visuellement ; les pages de mesure produit et de retours ont été contrôlées. La revue n’évalue pas les autorisations de production.

## Captures

- [Analyse sur ordinateur, FR clair](desktop-analysis-fr-light.png)
- [Après le formulaire sur mobile, FR sombre](mobile-analysis-fr-dark.png)
- [Rapport complet, FR clair](desktop-report-fr-light.png)
- [Rapport partiel sur mobile, EN sombre](mobile-report-en-dark.png)

## Vérifications

- `npm test -- --reporter=dot --maxWorkers=4` : 134 fichiers, 1 203 tests réussis, plus 3 tests du contrôle éditorial, après intégration de `main`.
- `npm run check:editorial` : structure FR/EN valide.
- `npm run build -- --webpack` : compilation, TypeScript et génération des pages réussis, après le dernier ajustement SCSS.
- `npm run lint` : aucune erreur ; un avertissement existant dans `ReportPriorityList.tsx`, fichier non modifié.
