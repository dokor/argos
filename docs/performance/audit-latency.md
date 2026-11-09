# Latence des audits : diagnostic et chevauchement SSL

## Observation de production

La vérification du 9 novembre 2026 portait sur le backend
`0bca9e3fb379511ba70a2c2c7c4a695c583b33cf`, après le
[déploiement des corrections P1/P2](https://github.com/dokor/argos/actions/runs/42650931848).
Un audit public complet a été suivi toutes les cinq secondes. Les instants
ci-dessous sont les premières observations de chaque état, pas des durées
instrumentées de chaque collecteur. Aucune URL cible ni aucun token n'est publié.

| Secondes depuis la soumission | État observé |
| --- | --- |
| 0 | QUEUED |
| 128 | RUNNING ; HTTP, HTML et Runtime terminés ; Lighthouse en cours |
| 143 | Lighthouse terminé ; Observatory en cours |
| 149 | Observatory terminé ; SSL en cours |
| 240 | SSL terminé ; ZAP en cours |
| 245 | Audit terminé, huit modules COMPLETED |

Le suivi contient environ deux minutes de file d'attente, puis environ deux
minutes de traitement observable. Le premier poll RUNNING arrive après plusieurs
modules : il ne permet pas de calculer exactement la séparation attente/traitement.
SSL représente environ 90 secondes du traitement, et Lighthouse environ 15 secondes.
Le scheduler traite un seul audit à la fois, avec cinq secondes entre deux ticks ;
les audits déjà en cours allongent donc aussi l'attente des suivants. Réduire
l'intervalle de polling du navigateur ne raccourcirait pas les analyses.

SSL Labs décrit ses évaluations comme durant généralement au moins une minute
et recommande de conserver les attentes entre polls. Son protocole demande
`startNew=on` au premier appel, puis des polls jusqu'à READY ou ERROR
([documentation officielle v3](https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md)).
Une promesse systématique de vingt secondes serait incompatible avec ce scan frais.

## Modification

HTTP reste la barrière de dépendance. Au palier 2, SSL démarre ensuite sur le seul
worker distant pendant que le worker local exécute HTML, Runtime, Lighthouse,
Observatory, ZAP et Tech. Les navigateurs restent séquentiels et le scheduler ne
traite toujours qu'un run à la fois. Le rapport conserve l'ordre historique des
modules et des statuts ; la fusion et le scoring restent identiques.

Observatory reste local lorsque SSL occupe le worker distant : son budget ne peut
plus être épuisé dans une queue derrière SSL. Au palier 3, SSL et Observatory
utilisent chacun un worker distant. Dans les deux modes, ZAP et Tech terminent
avant d'attendre ces fournisseurs. Un scan SSL lent ne fait donc plus perdre des
mesures indépendantes obtenables avant la deadline globale.

Les budgets production restent à 360 s pour l'audit et 180 s pour chaque appel
distant et pour SSL Labs. Chaque worker distant propage une deadline enfant aux
vrais appels HTTP et aux polls, dès la soumission. Les requêtes, checks, détails
SSL, règles SSRF, paramètres navigateur et règles de score restent inchangés.
Aucun cache supplémentaire, résultat historique ou raccourcissement de timeout
n'est utilisé. La nouvelle stratégie est figée dans l'empreinte de méthode afin
que les comparaisons historiques détectent ce changement de conditions de collecte.

## Preuves automatisées et limites

`AuditLatencyParityTest` utilise des réponses contrôlées avec les vrais services
de fusion, d'enrichissement, de score et de couverture, ainsi que les deux pools
bornés. Il compare les paliers 1, 2 et 3 avec succès et panne SSL : mêmes mesures,
preuves, scores, couverture, données inconnues et ordre final. Les empreintes de
périmètre et de score restent identiques, l'empreinte de méthode change.

La comparaison temporelle reproduit à l'échelle 1:100 une répartition de
118 secondes : Runtime 5, Lighthouse 15, Observatory 5, SSL 90 et ZAP 3. HTTP,
HTML et Tech n'ont pas de délai simulé. Après chauffe, trois paires sont exécutées
en alternant les modes 1 et 2 ; la parité des données est vérifiée pour chaque paire.
Les tests synchronisés par latch prouvent le chevauchement sans assertion fragile
sur une durée machine. Les sorties `audit_latency_fixture` conservent les timings
dans les logs Maven/CI. Cette fixture ne mesure ni la latence réseau réelle, ni la
capacité du Raspberry, ni l'effet du scan SSL simultané sur le serveur cible.

Exécution locale Java 21 du 9 novembre 2026, avec les pools local et distant :

| Paire | Séquentiel (ms) | Chevauchement (ms) | Données et score |
| --- | --- | --- | --- |
| 1 | 1 229 | 914 | identiques |
| 2 | 1 235 | 908 | identiques |
| 3 | 1 218 | 912 | identiques |
| Médiane | **1 229** | **912** | **−25,8 % de durée sur fixture** |

`mvn --batch-mode test` : 1 139 tests recensés, zéro échec/erreur, un test externe
`ZapDaemonTest` ignoré. Les 128 tests des helpers CI/release passent également.

Les régressions couvrent également les scopes sans SSL, l'expiration d'un SSL
bloqué sans perdre Observatory/ZAP/Tech, l'interruption des workers, la deadline
enfant avant l'attente du résultat et la publication unique. Les tests existants
SSL Labs vérifient la fraîcheur entre deux audits, le polling et les erreurs.

## Déploiement et validation opérationnelle

Cette modification prépare `ARGOS_AUDIT_MAX_CONCURRENT_MODULES=2` dans Compose ;
elle ne constitue pas un déploiement. Le défaut HOCON reste 1. Pour revenir au
séquentiel en production, fixer cette variable à 1 puis recréer le backend.
Les limites de temps restent identiques entre les deux modes.

La [recette matérielle](../analysis/progress.md#mesures-avant-activation-sur-raspberry)
reste nécessaire avant promotion : comparer le même SHA aux paliers 1 et 2,
sur des cibles autorisées et dans les mêmes conditions de cache fournisseur.
Conserver durée de traitement et attente séparément, CPU/RSS des conteneurs,
couverture, statuts, erreurs/timeouts et unicité des rapports. Les métriques
Runtime/Lighthouse réelles varient : vérifier leur distribution sur les répétitions,
pas seulement le score global. Aucun gain de production n'est encore revendiqué.
