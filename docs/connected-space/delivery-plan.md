# Plan de réalisation et suivi

L’[epic #550](https://github.com/dokor/argos/issues/550) pilote la réalisation.
Le registre [issues.json](issues.json) contient les numéros GitHub et les
dépendances ; les [fiches de lots](issues/) portent les critères versionnés.
L’epic GitHub lié dans ce registre est le suivi vivant des statuts. Ce dossier
ne clôture aucune de ces fonctionnalités et n’a pas commencé leur développement.

## Ordre d’intégration conseillé

| Lot | Issue |
|---|---|
| F01 contrats/modèle | [#551](https://github.com/dokor/argos/issues/551) |
| F02 shell | [#552](https://github.com/dokor/argos/issues/552) |
| F03 URL/diagnostic | [#553](https://github.com/dokor/argos/issues/553) |
| F04 compte | [#554](https://github.com/dokor/argos/issues/554) |
| F05 quotas | [#555](https://github.com/dokor/argos/issues/555) |
| F06 découverte | [#10](https://github.com/dokor/argos/issues/10) |
| F07 lots | [#12](https://github.com/dokor/argos/issues/12) |
| F08 synthèses | [#556](https://github.com/dokor/argos/issues/556) |
| F09 interface domaine | [#557](https://github.com/dokor/argos/issues/557) |
| F10 dashboard | [#558](https://github.com/dokor/argos/issues/558) |
| F11 administration | [#559](https://github.com/dokor/argos/issues/559) |
| F12 retrait ancien | [#516](https://github.com/dokor/argos/issues/516) |
| F13 recette | [#560](https://github.com/dokor/argos/issues/560) |
| F14 preuves | [#538](https://github.com/dokor/argos/issues/538) |

| Vague | Lots | Résultat contrôlable |
|---|---|---|
| 1 | F01 contrats/modèle | Types et schéma propres, frontières et ownership vérifiés |
| 2 | F02 shell, F06 découverte, F14 preuves | Composants fidèles et services indépendants prêts ; coordination des travaux existants |
| 3 | F04 compte, F05 usage | Identité, sessions et réservations réutilisées dans la nouvelle UI |
| 4 | F03 URL/rapport, F07 lots | Deux parcours d’analyse reposant sur le même moteur et registre |
| 5 | F08 synthèses, F11 administration | Agrégats fiables, droits et modifications atomiques |
| 6 | F09 domaine, F10 dashboard | Parcours complets sur données réelles et captures comparables |
| 7 | F12 retrait ancien, F13 recette | Espace connecté propre, documentation à jour, runbook vérifié |

Les dépendances détaillées du registre priment sur les vagues : une vague
n’est pas une autorisation de contourner une dépendance. La préparation UI
peut utiliser la fixture canonique, mais une issue n’est pas terminée tant
que l’API réelle attendue n’est pas raccordée.

## Réutilisation des tickets existants

- F06 reprend [#10](https://github.com/dokor/argos/issues/10), découverte/crawler borné.
- F07 reprend [#12](https://github.com/dokor/argos/issues/12), analyse par lots.
- F12 reprend [#516](https://github.com/dokor/argos/issues/516), retrait legacy,
  avec D-06 qui remplace le besoin de coexistence de l’ancienne proposition.
- F14 reprend [#538](https://github.com/dokor/argos/issues/538), preuves réelles.
- Coordonner les contrats compte/auth #444/#8 et le travail LinkedIn #548 ;
  ne pas recopier ni écraser les changements en cours.
- #28/#29 (API/CI), #470 (équipes), #530 (suivi clients) restent hors lot.

Les tickets réutilisés conservent leur contexte historique et reçoivent une
section Clarté faisant autorité pour le périmètre de cette refonte. Les
dépendances héritées ne doivent pas réintroduire un export CSV ou des équipes
comme prérequis sans lien avec le périmètre actuel.

## Contenu attendu d’une PR de réalisation

1. Problème utilisateur et comportement obtenu, issue et IDs UI/FUN/ARC/QA.
2. Modifications de contrats/schéma et impacts éventuels sur moteur/public.
3. Vérifications adaptées réellement exécutées, avec limites et preuves au SHA.
4. Captures produit à données/largeurs équivalentes et écarts acceptés explicites.
5. Mise à jour du dossier et des anciens contrats quand le comportement change.

Préférer des PR relisibles correspondant aux frontières ci-dessus. Ne pas
livrer une grande PR mélangeant crawler, authentification et toute l’UI.
Chaque PR ne ferme que les critères effectivement livrés ; utiliser des liens
de suivi sans fermeture automatique si le raccordement reste à réaliser.

## Point de départ pour le prochain travail

Lire README → decisions → existing-system → fiche F01 → contrats API et modèle.
Inventorier le code à la nouvelle base Git avant de modifier : l’inventaire
actuel est un snapshot, notamment pour comptes/LinkedIn et preuves #538.
Commencer par F01, puis rendre le shell F02 contrôlable avec la fixture.
Le premier rendu de production doit être comparé aux références avant de
multiplier les pages ; cela limite la propagation d’un mauvais composant.

## Mise en service

La recette couvre base vierge, configuration, premier ADMIN et smoke tests.
Pas de plan de double interface ni de migrations compatibles imposé. Le
runbook nomme les données connectées abandonnées et les données moteur/public
conservées. Ce dossier ne fusionne aucune PR, ne déploie pas et ne réinitialise
aucun environnement de production.
