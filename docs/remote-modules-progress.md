# Progression atomique et appels distants — #236

La progression conserve le tableau JSON `{id,label,status}` et l'ordre des huit
modules. Une transition normale passe de PENDING à RUNNING puis à un état terminal.
Les états terminaux ne sont pas réécrits par un retry ou une réponse tardive ; une
reprise explicite réinitialise le tableau. Un run hors RUNNING n'accepte pas une
transition normale. La clôture d'un run FAILED par le reaper peut encore remplacer
ses seuls modules RUNNING par FAILED.

`AuditRunDao.updateModuleStatus` exécute un seul UPDATE JSON_SET. JSON_SEARCH
localise le module par son ID, y compris dans un tableau historique réordonné.
Les autres statuts, labels et `result_json` ne sont pas chargés ni remplacés.
Un JSON absent/corrompu/vide repart de la liste initiale ; un tableau non vide
sans l'ID visé est conservé. Huit modules et deux transitions : **16 UPDATE**,
contre **16 SELECT + 16 UPDATE** précédemment. Le nettoyage exceptionnel reste
une transition atomique par module ; il ne remplace plus le tableau entier.

SSL Labs et Observatory sont soumis après l'enrichissement HTTP du contexte.
Leur pool partagé a deux threads, une queue de deux tâches et refuse les travaux
supplémentaires en mode dégradé. HTML, Playwright, Lighthouse, ZAP et Tech restent
séquentiels sur le worker d'audit. Le rapport assemble les résultats dans l'ordre
historique et effectue une seule tentative de publication par traitement.
L'atomicité complete/publication globale reste le sujet distinct #228.

`audit.remote-modules.timeout` règle le délai par appel distant, queue comprise
(défaut : 2 minutes, durée strictement positive). Les deux deadlines démarrent à
la soumission ; attendre le premier résultat ne donne pas un nouveau budget au
second. Une expiration annule la tâche et produit un résultat indisponible,
non scorable, avec TIMEOUT. Les tâches distantes ne touchent ni la DB, ni les
statuts, ni le rapport final : une réponse après annulation ne peut les modifier.
Le MDC runId/module est transmis puis restauré. Le shutdown de l'application
interrompt le pool et attend au maximum cinq secondes. Les appels HTTP et polls
Java sont interruptibles ; un code tiers ignorant l'interruption ne crée pas de
thread supplémentaire et reste limité par le pool.

## Validation

`mvn test` couvre le pool, saturation, deadline, annulation, contexte MDC,
ordonnancement et publication unique via fixtures. La synchronisation par latch
prouve le chevauchement SSL/Observatory avec le travail local ; aucun navigateur
ou site tiers n'est exécuté. Le gain structurel est le passage de la somme des
durées à leur chevauchement, sans promesse de latence Raspberry.

Le workflow `MariaDB progress` lance `mvn -P mariadb-integration verify` sur
MariaDB 10.11 et 11.4, avec une base dédiée `argos_progress_test`. Il teste le
vrai DAO/SQL QueryDSL : vingt paires de transitions concurrentes, état terminal,
retry, JSON invalide, ordre historique, clôture reaper et blob intact. Les rapports
Failsafe sont conservés en artefact lié au SHA. Le profil échoue si l'URL de la
base isolée n'est pas renseignée ; aucune DB d'exploitation n'est utilisée.

Le test `normalProgressUsesSixteenUpdatesAndNoSelectInsteadOfThirtyTwoStatements`
imprime les nombres de statements et durées avant/après sur la fixture MariaDB.
Ces timings comprennent les connexions de test ; ils ne mesurent ni le Raspberry
ni le parcours réseau réel. La version de MariaDB en production reste à relever
avant déploiement ; les deux versions CI bornent la compatibilité vérifiée.

Première exécution CI (commit `865ea0c`) : les huit tests d'intégration réussissent
sur les deux versions. La fixture mesure 57 → 87 ms sur 10.11 et 74 → 84 ms sur
11.4. Elle démontre la réduction de statements et la correction concurrente,
pas un gain de latence SQL sur une base locale ; l'expression JSON a un coût.

`syntheticLatencyFixtureMeasuresSerialStagesAndParallelRun` mesure aussi trois
étapes de 200 ms (HTML et deux appels distants mockés), d'abord en séquence puis
dans le vrai processeur parallèle, avec publication du rapport. Il imprime
`remote_fixture` dans les résultats Surefire. Ces durées ne sont pas des seuils
de test et ne représentent pas un audit réseau réel ; les tests par latch
vérifient séparément que le chevauchement a effectivement lieu.
Exécution locale Java 21 : 610 ms pour les trois étapes séquentielles, 232 ms
pour le traitement parallèle avec composition/publication mockée du rapport.
