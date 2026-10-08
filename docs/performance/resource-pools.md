# Pools HTTP et DB sur Raspberry (#232)

Le profil livré est **candidat**, pas un dimensionnement mesuré sur Raspberry.
Le modèle du Pi, sa RAM, le budget conteneur et la charge réelle ne sont pas connus.
Aucun gain CPU/RSS ni débit de production n'est revendiqué. La validation matérielle
ci-dessous reste nécessaire avant promotion en production.

| Réglage | Avant (configuration versionnée) | Candidat |
| --- | --- | --- |
| Grizzly maximum workers | 512 | 24 |
| Grizzly core workers | défaut transport (à relever sur le déploiement) | 4 |
| Grizzly file workers | défaut non borné | 64 tâches |
| Workers au-dessus du core : durée de vie au repos | défaut Grizzly | 30 s |
| Hikari maximumPoolSize | 9 | 6 |
| Hikari minimumIdle | implicite, égal au maximum (9) | 1 |
| Hikari connectionTimeout | implicite, 30 000 ms | 5 000 ms |

Les threads sélecteurs Grizzly ne sont pas inclus dans les workers. La limite de
queue porte sur des tâches HTTP, pas sur des audits. Le scheduler traite un run à
la fois, avec 5 s après sa fin : davantage de workers HTTP ou de connexions ne
multiplie pas le débit d'analyse. L'admission des audits relève de #227.

## Configuration et surcharge

Les valeurs sont dans `apps/api-backend/src/main/resources/application.conf`.
Les fichiers externes `-Dconfig.file=/config/prod.conf` peuvent les remplacer :
**un ancien override à 512 ou 9 reste prioritaire**. Mettre à jour ces overrides
lors du déploiement. Les clés HTTP sont optionnelles : absence/null donne
24 maximum, min(4, maximum) core et 64 tâches. Un ancien maximum seul reste
compatible. Les valeurs HTTP doivent être positives, core <= max. La validation
avant initialisation DB refuse les tailles DB invalides, minimumIdle hors
[0, maximum], ou connectionTimeout < 250 ms. Les paramètres DB sont transmis à
Hikari par le module Plume existant ; les overrides DB `null` sont refusés.

Quand les workers sont occupés, au plus 64 tâches attendent. Un rejet de
l'exécuteur HTTP avant Jersey renvoie **503 Service Unavailable** avec
`Retry-After: 1`, sans détails internes. Le probe existant journalise le
débordement. D'autres saturations du transport peuvent fermer une connexion :
conserver des délais finis au proxy/client. Ne pas relancer automatiquement un
POST après un résultat ambigu (risque de doublon) ; les GET peuvent être retentés
avec backoff.

Lorsque les six connexions DB sont utilisées, Hikari attend au plus 5 s puis
lève une exception de connexion transitoire. Le mapping d'erreur applicatif
existant reste en place. Ce délai ne borne ni le SQL ni la durée totale HTTP.
Ces limites ne prouvent pas l'absence d'OOM globale : corps HTTP et autres queues
ont leurs propres budgets.

## Comparaison avant/après sur le Pi de staging

1. Relever modèle Pi, CPU, RAM, Java, MariaDB, limite mémoire Docker, options JVM,
   configuration effective, commit et autres conteneurs actifs. Sauvegarder le
   fichier externe et relever les pools effectifs avant réglage.
2. Garder le même jeu d'audits/rapports, caches, versions et services headless.
   Sur une cible de staging autorisée, effectuer un audit nominal via formulaire,
   suivre QUEUED -> RUNNING -> COMPLETED, ouvrir le rapport avec le même token,
   vérifier une publication unique. Répéter pendant la charge de lecture.
3. Depuis une autre machine, charger un rapport de fixture et sa route
   `/api/reports/<token>/status`. Profil candidat à confronter aux logs réels :
   2 min de chauffe, 5 min à 4 clients (polling toutes les 1,5 s, ~2,7 req/s),
   5 min à 16 clients (~10,7 req/s), rafale de 60 s à 128 clients sans pause,
   puis retour à 4 clients pendant 2 min. Garder les mêmes scénarios avant/après
   et trois répétitions par profil. Utiliser un générateur à concurrence bornée
   avec délai HTTP 10 s. Conserver des résultats agrégés sans token/URL en logs.
4. Toutes les secondes : `docker stats`, `pidstat -r -u -t -p <pid> 1`
   (CPU/RSS/threads), GC/heap via JFR/JVM, profondeur de file et rejets via
   GrizzlyThreadPoolProbe/JMX. Activer temporairement
   `db.hikari.registerMbeans=true` en staging, sans exposer JMX au réseau public :
   relever ActiveConnections, IdleConnections, TotalConnections et
   ThreadsAwaitingConnection du Pool MXBean. Mesurer aussi la durée de
   `HikariDataSource.getConnection()` avec un timer d'instrumentation de staging
   ou un traceur de méthodes, et compter les timeouts. Le MXBean seul donne le
   nombre d'attentes, **pas leur durée**. Retirer l'instrumentation après mesure.
5. Archiver les données brutes agrégées, séparées par palier et fenêtre de reprise.
   Compléter ce tableau avant choix définitif des tailles :

| Mesure par palier | Avant sur Pi | Après sur Pi |
| --- | --- | --- |
| CPU moyen/pic, RSS pic, heap/GC | à mesurer | à mesurer |
| Threads, file workers, rejets | à mesurer | à mesurer |
| Latence API p50/p95/p99, statuts/erreurs | à mesurer | à mesurer |
| DB active/idle/pending, attente p50/p95/p99, timeouts | à mesurer | à mesurer |
| Temps audit, publication unique, reprise après rafale | à mesurer | à mesurer |

Validation proposée : audit nominal inchangé, zéro erreur au palier nominal,
p95 HTTP sans régression >10 % face à la baseline, file <=64, connexions <=6,
refus explicites sous rafale sans croissance persistante threads/RSS, retour au
comportement nominal dans les 2 min de reprise. Ajuster ces seuils au SLO réel
avant de choisir définitivement 16-32 workers / 4-6 connexions. Sans données
avant/après, le critère matériel de l'issue reste ouvert.

## Rollback

Restaurer le fichier externe sauvegardé puis redémarrer uniquement api-backend.
Pour reproduire la baseline : maximum workers 512, core **effectivement relevé**,
maximumPoolSize=9, minimumIdle=9, connectionTimeout=30000. Le nouveau code garde
une queue bornée et n'accepte pas queue-limit=-1 : augmenter sa limite positive
si nécessaire pendant l'investigation. Pour retrouver exactement l'ancienne
queue non bornée, revenir aussi à l'image backend précédente. Vérifier ensuite
un audit nominal.

## Preuves automatisées

ConfigurationServiceTest couvre le repli HTTP, les overrides, le maximum seul et
le refus de configurations invalides. ResourcePoolTest démarre le vrai serveur
via GrizzlySetup, sature ses workers/file, vérifie 503 + Retry-After, puis 200
après reprise. Il charge également les valeurs Hikari versionnées contre H2,
réserve les six connexions, observe le timeout de 5 s, puis réussit après
libération. H2 valide le pool, pas les buffers MariaDB ni les coûts du Pi.

Avec Maven récent : `mvn test` depuis `apps/api-backend`.
Avec Maven 3.6.3 local (Surefire implicite incompatible JUnit 5) :
`mvn test-compile org.apache.maven.plugins:maven-surefire-plugin:3.5.4:test`.
