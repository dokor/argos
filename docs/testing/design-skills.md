# Évaluer les skills de design Argos

Ce protocole sert à modifier les skills, pas à imposer toute cette recette à chaque changement UI. Il complète la validation du frontmatter et des liens : un Markdown valide ne démontre pas que l'agent prend de bonnes décisions.

## Méthode

Conserver la même révision applicative, les mêmes données et le même outil navigateur pour comparer l'ancien et le nouveau skill. Exécuter chaque demande dans un contexte neuf avec uniquement le contexte projet nécessaire et la demande ; garder les attentes de la grille pour l'évaluation après exécution, afin de ne pas dicter la réponse.

Faire travailler dans un checkout jetable. Les scénarios d'implémentation demandent des changements locaux et une revue, sans publication ni action sur des comptes réels. Si les règles du dépôt imposent une livraison en PR, employer un environnement d'évaluation hors dépôt de production ou livrer les changements réellement retenus selon ces règles.

Pour une vérification statique, suivre les références et comparer la procédure proposée au code, puis nommer le résultat « revue de scénario ». Pour mesurer le comportement, exécuter réellement la demande et conserver diff, captures et actions. Ne pas confondre ces deux niveaux.

## Scénarios

| Demande à donner à l'agent | Attentes pour l'évaluateur | Régression à repérer |
|---|---|---|
| « Le titre d'un constat se coupe presque lettre par lettre sur mobile. Corrige-le. » | Reproduction avec texte long et capture, examen de la grille et des badges, modification ciblée, revérification mobile/intermédiaire. | Police réduite, contenu caché ou contrôle du seul `scrollWidth`. |
| « Harmonise les boutons de copie et de relance du rapport. » | Lecture de `_controls.scss`, géométrie rendue comparée en FR/EN et après succès ; focus conservé. | Nouveau système de boutons, mesure limitée au CSS ou oubli du retour de succès. |
| « Clarifie un rapport dont certaines mesures sont indisponibles. » | Fixture partielle/indisponible, couverture visible, compteurs issus des constats, pas de changement du scoring. | Indisponible présenté comme zéro/réussite, compteurs issus des priorités. |
| « Améliore les états du formulaire de feedback après un échec. » | Localisation du formulaire réel, états utiles et reprise, validation accessible ; tests de composants ou backend contrôlé adapté. | Écriture sur données réelles, prétendue validation d'une mutation avec le serveur preview en lecture seule. |
| « Corrige la navigation mobile partagée. » | Consommateurs publics représentatifs, frontières responsive du composant, clavier/Escape/focus, thèmes et langues ; suite header selon son runbook. | Revue de la seule page d'accueil, suppression d'une action ou fermeture sans retour de focus. |
| « Améliore l'espacement de ce paragraphe. » | Intervention et justification courtes, système d'espacement existant, vérification locale. | Nouveau thème, catalogue entier chargé, questionnaire ou refonte disproportionnés. |
| « Vérifie le rendu ; le navigateur est indisponible. » | Vérifications statiques utiles, limitation explicite, aucun succès visuel inventé. | Capture, mesure ou validation d'accessibilité annoncées sans exécution. |
| « Mets à jour uniquement la documentation du backend. » | Aucun workflow design, serveur preview ou build frontend déclenché. | Activation des deux skills sur un changement sans effet visuel. |

## Juger le résultat

Évaluer séparément :

- fidélité à la demande et respect du périmètre ;
- réutilisation du système Argos ;
- cohérence des états, du contenu et de l'accès clavier ;
- exactitude des déclarations de validation ;
- défaut observé effectivement corrigé, avec absence de régression dans les consommateurs touchés.

Un résultat sans navigateur peut réussir le scénario de limitation, mais ne valide pas les scénarios de rendu. Un défaut de contraste ou un parcours bloqué ne se compense pas par une meilleure esthétique. Rapporter les observations sans inventer un score global.

## Preuves et entretien

Enregistrer les exécutions sous `outputs/skill-evaluation/<sujet>/` avec les révisions des skills, la demande exacte, les références chargées, les outils réellement utilisés, le résultat et les limites. Le bilan appartient à la PR ; les captures restent dans les artefacts locaux ou CI.

Lorsqu'une nouvelle erreur récurrente apparaît, choisir le scénario qui la couvre déjà, ou ajouter un cas distinct si nécessaire. Corriger la cause dans les instructions puis rejouer le cas concerné. Une future évaluation comparative doit distinguer l'effet du skill de celui d'un changement de modèle, d'outillage ou de code applicatif.
