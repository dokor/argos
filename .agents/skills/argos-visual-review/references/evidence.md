# Compte rendu de revue UI

Copier et renseigner les rubriques utiles dans `outputs/ui-review/<sujet>/review.md` ; supprimer les exemples, pas les limites. Le compte rendu contient des observations, jamais une liste de cases cochées par défaut.

## Contexte

- Révision de départ et changements examinés :
- Tâche de l'utilisateur et critère attendu :
- Pages/composants et consommateurs partagés concernés :
- Fixture fictive, état et environnement utilisés :
- Référence : rendu avant correction, maquette fournie ou aucune référence disponible.
- Outil navigateur, scans et tests réellement exécutés :

## Couverture observée

| Route ou composant | État / geste | Dimensions (largeur × hauteur) | Langue / thème | Résultat | Preuve |
|---|---|---|---|---|---|
| À renseigner | À renseigner | À renseigner | À renseigner | Vérifié / défaut / non vérifié | Capture, mesure DOM ou sortie de test |

Nommer les captures de façon identifiable, par exemple `report-partial-fr-dark-390-after.png`. Pour une comparaison visuelle, conserver la même fixture et les mêmes dimensions avant/après. Ne pas rendre partageables des captures d'un rapport utilisateur privé.

## Constats et corrections

Pour chaque défaut : localisation, geste de reproduction, observation, impact sur la tâche, correction, résultat de la revérification. Une hypothèse (« cette hiérarchie pourrait faciliter la lecture ») reste distincte d'un fait (« le bouton sort du viewport à 390 px »).

Séparer :

- les défauts introduits ou corrigés par cette modification ;
- les défauts préexistants hors périmètre ;
- les contrôles non exécutés et leur cause.

## Bilan à reporter dans la PR

Changement visible ; parcours et variantes effectivement vérifiés ; tests et résultats ; emplacement des preuves ; limites restantes. Indiquer explicitement si les preuves ne sont accessibles que sur le poste local.

Une erreur connue ou une étape non vérifiée ne devient pas un succès parce que le build passe. Ne pas annoncer un score de qualité ou un taux de conformité à partir de cet échantillon.
