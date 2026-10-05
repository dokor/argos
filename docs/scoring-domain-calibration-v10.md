# Composition du score global — V10 (#249)

## État livré et calibration

Le calcul a été livré dans [PR #254](https://github.com/dokor/argos/pull/254),
fusionnée au commit `59e3a44f2fcfeac19f89948747372270b4ee469b`.
Le catalogue est versionné par `DefaultScorePolicy.version() = 10`.
Performance, Sécurité, SEO et Accessibilité ont chacun un coefficient configuré
de **25 %**. Ce choix donne à chaque domaine la même influence initiale ; le
nombre de checks ou leurs poids internes ne décide plus de cette influence.
Il s'agit d'une calibration produit, pas d'une mesure statistique de valeur
commerciale ou d'une certification.

Pour chaque domaine d, `S_d = sum(weight × ratio) / sum(weight)`.
Seuls les checks scorables à poids fini strictement positif contribuent.
Le ratio continu fini est borné entre 0 et 1 ; sinon PASS=1, WARN=0.5,
FAIL/INFO=0. La sévérité ne change pas les poids.

Les coefficients sont renormalisés sur les domaines dont le dénominateur
est positif : `alpha_effectif = 0.25 / sum(alpha_mesurables)`.
Le global vaut `100 × sum(alpha_effectif × S_d)`.
Un domaine absent a un poids effectif nul et un agrégat 0/0. Sans domaine
mesurable, le global est 0/0, explicitement **indisponible**, pas une mesure
d'échec. Cela ne prouve pas que tous les contrôles d'un domaine mesurable ont
été exécutés : qualité et couverture restent distinctes (#48).

## Jeux de référence

| Données | Global exact | Poids effectifs |
|---|---:|---|
| Performance 100/100, Sécurité 0/1, SEO 2.5/5, A11y 14.4/18 | 57.5 | 25 % chacun |
| Les mêmes sans A11y | 50 | 1/3 par domaine mesurable |
| Performance seule à 50 % | 50 | Performance 100 % |
| Aucun check scorable de poids positif | indisponible | tous nuls |

Le test `referenceDatasetsExposeNormalizedWeightsAndIgnoreZeroWeightFindings`
vérifie aussi la permutation des checks et l'ajout d'un finding de poids zéro.
Le test existant sur l'ajout de poids Performance vérifie que le poids de
Sécurité reste constant. Ajouter un check peut modifier son propre score de
domaine ; cela ne doit pas modifier les coefficients des autres domaines.

La restitution publique ajoute `scores.globalAvailable` et un bloc optionnel
`scores.calculation` contenant version, empreinte, score, dénominateur, ratio
et coefficient effectif pour chaque domaine. Le global affiché est arrondi
à l'entier ; sa décomposition conserve les valeurs non arrondies.
Le JSON de l'API publique expose ce bloc ; le panneau Données du rapport
permet aussi aux administrateurs de le consulter. Le Hero et la grille
de score affichent l'état indisponible au lieu de zéro.

## Courbes et compatibilité

Cette réconciliation n'ajoute aucune courbe de compte ou de volume. Les notes
Lighthouse continues existantes utilisent score/100, borné à [0,1] ; leurs
tests couvrent 59/60, valeurs hors bornes et ratios non finis. Les nouvelles
courbes nécessiteraient une calibration et une version de barème distinctes.

Les JSON publics déjà persistés sont lus tels quels par `ReportReadService`.
Les nouveaux champs sont absents/null dans les anciens rapports ; leur score
reste affiché. Aucun recalcul, migration SQL ou changement des coefficients
de V10 n'est effectué. L'indisponibilité publique corrige une présentation
ambiguë, sans changer le calcul ni le catalogue.

## Revue ADE 1.2.1

Perspectives Tech Lead, Backend, Frontend, QA et UX : décomposition explicable,
cas de référence, absence de confusion entre zéro et indisponibilité,
compatibilité de désérialisation et conservation par l'enrichissement IA.
La portée de #44 (comparabilité) et #48 (couverture) demeure distincte.
