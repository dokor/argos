# Découverte de domaine F06

Lot [#10](https://github.com/dokor/argos/issues/10), FUN-06, ARC-04 et QA-08.
F06 livre le service Java, la file persistante et le BFF privé. La sélection
visuelle et le tunnel domaine arrivent en F09 ; l'admission des audits sélectionnés
arrive en F07. Aucun audit ni mouvement de crédit n'est créé par une découverte.

## Contrat disponible

- `POST /api/account/domain-discoveries` : compte ACTIVE, CSRF et UUID
  `Idempotency-Key` ; corps `hostname`, `maxUrls`, `maxDepth`, `excludedPaths`.
  Réponse 202 avec ID privé, état, limites effectives et expiration.
- `GET /api/account/domain-discoveries` : découvertes actives et terminées non encore soumises en lot, non expirées (100 maximum),
  pour retrouver une opération après rechargement.
- `GET /api/account/domain-discoveries/{id}` : état, compteurs, version, motif,
  troncature et demande d'annulation. Expiration à 24 h : 410.
- `GET /api/account/domain-discoveries/{id}/pages` : pagination 20 par défaut,
  100 maximum, filtre `inclusion=all|eligible|excluded` avant pagination.
  Chaque ligne porte ID, URL normalisée, source, profondeur et motif d'exclusion.
- `POST /api/account/domain-discoveries/{id}/cancel` : corps absent ou `{}` ;
  QUEUED devient immédiatement CANCELED (200), RUNNING reçoit la demande (202),
  un terminal reste inchangé (200). Les pages déjà collectées sont conservées.

Session absente : 401 ; non vérifiée : 403 ; autre propriétaire : 404 ; toutes
les réponses sont privées `no-store`. Les lectures ne renouvellent pas l'activité.
Le BFF valide champs, syntaxe des hôtes, chemins, identifiants et paramètres ;
Java répète la validation et contrôle le DNS. Les erreurs gardent l'enveloppe
compte existante `{ "error": "code" }` (adaptateur de contrats F01).

Un même UUID et un même corps canonique (hôte minuscule, exclusions triées et
dédupliquées) rendent la même opération. Un corps différent donne 409
`idempotency_conflict`. Plusieurs découvertes sont acceptées : la limite par compte donne
429 `discovery_queue_full` avec `Retry-After: 2`.
La file globale pleine donne 429 `discovery_busy`, `Retry-After: 2` ; aucun site
privé n'est conservé par cette transaction refusée. Une clé expirée donne 410.

## Périmètre et limites

L'entrée est un hôte ASCII exact (IDN sous forme punycode), sans chemin ni port.
La page initiale est `https://<hôte>`. Les liens HTTP et HTTPS du même hôte sont
acceptés aux seuls ports standards ; ni sous-domaines ni bascule automatique
vers HTTP après un échec TLS. Les fragments sont retirés, les requêtes conservées.
Les exclusions sont des préfixes de chemin, comparés après décodage et
normalisation ; `/admin` exclut aussi `/administrator`. Leurs valeurs ne peuvent
contenir ni query, fragment, encodage %, contrôle, espace, antislash ou `..`.

Le plafond `maxUrls` borne **toutes les lignes distinctes**, éligibles et exclues.
Une page est éligible après réponse HTML 2xx autorisée ; cela ne garantit pas un
futur audit réussi. Les liens sont résolus depuis l'URL finale après redirection.
Les liens HTML sont parcourus avant les sitemaps ; ceux-ci proviennent de
`robots.txt`, puis de `/sitemap.xml`, avec index bornés. Aucun JavaScript exécuté,
formulaire soumis, moteur de recherche ou authentification du site cible.

Configuration serveur `discovery.*` (valeurs par défaut ; limites dures entre parenthèses) :

| Clé | Valeur | Effet |
|---|---:|---|
| `max-urls` | 50 (1–1000) | Lignes de snapshot, paramètres utilisateur uniquement plus restrictifs |
| `max-depth` | 3 (0–10) | Profondeur des liens ; initiale et sitemap à 0 |
| `duration-seconds` | 60 (1–300) | Budget monotone de parcours hors attente en file |
| `requests-per-host` | 2 (1–2) | Découvertes simultanées du même hôte, tous comptes/processus |
| `workers` | 4 (1–16) | Découvertes RUNNING globales et threads locaux |
| `queue-limit` | 100 (1–1000) | Total QUEUED + RUNNING admis |
| `account-queue-limit` | 5 (1–50) | Total QUEUED + RUNNING par compte ; une seule exécution par compte |
| `max-requests` | 1000 (1–10000) | Requêtes totales, robots, redirections et sitemaps inclus |
| `max-redirects` | 5 (0–5) | Redirections manuelles par ressource |
| `body-bytes` | 2097152 (1024–2097152) | Corps compressé et décompressé HTML/sitemap |
| `robots-bytes` | 1048576 (1024–1048576) | Corps robots compressé et décompressé |
| `connect-seconds` | 5 (1–10) | Connexion et contrôle DNS |
| `response-seconds` | 10 (1–30) | Réponse complète, corps inclus |
| `max-links` | 1000 (1–5000) | Entrées de liens/loc examinées et règles robots |
| `max-sitemaps` | 5 (1–20) | Sitemaps distincts, défaut compris |

Le snapshot expose les quatre limites de parcours dans `effectiveLimits`.
Le transport utilise la configuration serveur ; modifier ses limites nécessite
un redémarrage. Conserver une configuration identique entre réplicas. Le lease
reprend la durée effective à la prise en charge, plus 5 secondes de clôture.

## Transport, robots et XML

Chaque requête et redirection passe par `UrlNormalizer.validatePublicUrl`, puis
exclusivement par le [proxy egress qui fixe l'adresse DNS](../security/audit-chain-488.md).
La configuration de ce proxy est obligatoire ; aucune sortie directe de secours.
Le client n'envoie ni cookie, ni Authorization, ni en-tête utilisateur. Le proxy
reste responsable du contrôle de l'adresse réellement connectée, y compris en
cas de rebinding entre la validation applicative et la connexion.

Le corps est plafonné pendant sa réception et à la décompression gzip. Le budget
restant réduit les délais ; l'annulation est vérifiée pendant DNS/réception et
parcours, par intervalles de 200 ms au plus entre contrôles réseau. Les appels
DNS natifs potentiellement non interruptibles restent dans deux threads et une
file de 16 maximum. Les écritures DB utilisent leurs propres délais opérateur.

Le parseur [robots (RFC 9309)](https://datatracker.ietf.org/doc/html/rfc9309)
fusionne les groupes exacts ArgosDiscovery, utilise `*` à défaut, compare les
chemins encodés, supporte `*`/`$`, et privilégie Allow à égalité. Il est borné en
taille, lignes et règles. Une réponse 404/410 autorise le parcours ; les autres
erreurs empêchent le parcours (choix conservateur). Les robots sont chargés par
origine, y compris lors d'un changement HTTP/HTTPS. XML est lu en streaming,
sans DTD ni entités externes, avec profondeur 8 et `loc` de 2048 caractères max.

Les raisons sont des codes stables sans message distant : `EXHAUSTED`,
`NO_ELIGIBLE_URLS`, `URL_LIMIT`, `DEPTH_LIMIT`, `TIME_LIMIT`, `LINK_LIMIT`,
`SITEMAP_LIMIT`, `EXCLUDED_PATH`, `EXTERNAL_HOST`, `ROBOTS_DISALLOWED`,
`ROBOTS_UNAVAILABLE`, `ROBOTS_LIMIT`, `TARGET_BLOCKED`, `BODY_LIMIT`,
`RESPONSE_TIMEOUT`, `TRANSPORT_ERROR`, `DNS_BUSY`, `CONTENT_ENCODING`,
`HTTP_ERROR`, `NOT_HTML`, `REDIRECT_LOOP`, `REDIRECT_LIMIT`, `INVALID_REDIRECT`,
`INVALID_LINKS`, `INVALID_SITEMAP`, `SITEMAP_UNAVAILABLE`, `XML_UNSAFE`,
`XML_LIMIT`, `CANCELED`, `WORKER_LOST`, `WORKER_ERROR`, `EXPIRED`,
`ACCOUNT_UNAVAILABLE`. Le motif global résume le dernier arrêt partiel ; les
exclusions de chaque page conservent leur propre cause. `truncated` signale une
couverture incomplète, pas un inventaire exhaustif du site.

## Persistance et reprise

Les liens HTML utilisent la base effective du document (`<base href>` compris).
L'hôte exact, les chemins exclus et robots sont revérifiés sur l'URL résolue :
une base externe ne permet aucun fetch externe.

Le parseur robots déduplique les sitemaps par URL canonique avant d'appliquer
le plafond. Les entrées distinctes excédentaires sont ignorées, signalées par
`SITEMAP_LIMIT` et `truncated=true`, tout en conservant les règles robots et
le parcours HTML. Les plafonds de corps, lignes/règles et transport restent
appliqués. Tests : base relative/externe/exclue, six déclarations identiques,
variantes canoniques et excès de sitemaps sans perte de la page d'accueil.

V22 ajoute le verrou global, début, lease, jeton de claim et index aux tables
F01. Les colonnes SQL générées restent en lecture seule. L'admission verrouille
le compte avant le verrou global ; les workers ne verrouillent pas ensuite un
compte. Le claim sous gate garantit une seule découverte RUNNING par compte.
Le parcours est séquentiel par découverte ; le plafond d'opérations par hôte
borne donc également les requêtes simultanées de ce crawler.

Le scheduler vérifie la file toutes les 2 secondes. Chaque page est persistée
avec le jeton de claim et le lease. Après interruption du processus, une opération
RUNNING expirée devient FAILED/WORKER_LOST et libère le compte ; aucun ancien
worker ne peut reprendre ses écritures. Une demande d'annulation gagne à la
clôture. Une opération avec au moins une page éligible peut terminer COMPLETED
avec `truncated=true` ; sans page éligible elle termine FAILED.

L'expiration fonctionnelle du snapshot est de 24 h. F06 ne purge pas ces tables :
les futurs lots F07 les référencent ; la politique de purge devra respecter ces
références. L'expiration interdit la lecture/réutilisation, sans effacer un lot.

## Preuves de recette

- `DomainCrawlerTest` : hôte exact, fragments, exclusions encodées, profondeur,
  redirections, robots, sitemaps/index, XXE, plafond et annulation conservant les pages.
- `DiscoveryTransportTest` : vrai client HTTP contre un proxy local de test,
  corps excessif, bombe gzip, délai du corps lent, annulation, refus d'IP privée
  et credentials, absence de suivi automatique des redirections.
- `DiscoveryRobotsTest` : groupes, Allow à égalité, règles vides, encodage et bornes.
- `DiscoveryIT` sur MariaDB : admission concurrente, replay, propriétaire,
  quotas inchangés, pagination, annulation, lease/reprise et plafond par hôte.
- `AccountLifecycleIT` : routes réelles Jersey, session/vérification, CSRF,
  no-store et isolation. Tests BFF : payloads, identifiants et paramètres refusés.
- Les tests d'egress/rebinding existants restent exécutés en CI ; le proxy local
  de `DiscoveryTransportTest` teste le client, pas le pinning de production.

Commandes : `mvn test`, CI `MariaDB integration (11.4)` avec `DiscoveryIT`,
`npm test`, `npm run lint`, `npm run build`,
`python scripts/contracts/generate-connected.py --check`,
`python docs/connected-space/validate.py`. Pas de test sur un site tiers,
ni recette visuelle revendiquée pour les écrans F09 encore à réaliser.

## Configuration et files (#672, #661)

`GET /api/account/domain-discoveries/limits` publie uniquement les maxima URL,
profondeur et durée, avec les valeurs proposées au formulaire (20 URL et profondeur
2, réduites si nécessaire). Les valeurs sûres historiques restent 50/3/60 s.
Exemple de recette : `discovery.max-urls=200`, `discovery.max-depth=5` ; la durée
peut être augmentée séparément jusqu'à 300 s. Des entiers hors bornes ou
fractionnaires font échouer l'initialisation, avec le nom de la configuration.
Redémarrer toutes les instances après une modification ; aucun rechargement à chaud.

Le BFF contrôle les bornes absolues 1000/10 et les types ; Java refuse tout dépassement
des maxima opérateur avec 400 `discovery_limits_invalid`. Les champs absents,
entiers débordants, fractions, chaînes, booléens et champs forgés sont refusés par
le contrat JSON existant (400). La profondeur 0 reste autorisée (page initiale et
sitemap uniquement). Les paramètres demandés et les limites résolues sont persistés.
À la prise en charge, les anciennes limites sont intersectées avec celles du worker :
elles peuvent diminuer, jamais augmenter. Le snapshot effectif et le lease sont
actualisés atomiquement. Le moteur applique encore ces plafonds, y compris en appel
direct ; son budget de durée est indépendant du budget fourni par son appelant.

La migration V30 remplace les index d'unicité par compte par des index ordinaires.
Les colonnes générées existantes et les mappings QueryDSL restent identiques.
Le gate SQL maintient les plafonds globaux et par hôte ; une seule découverte
RUNNING par compte. La file choisit le compte le moins récemment servi, puis le
plus ancien job. Les workers et navigateurs ne gagnent aucune concurrence.
Les jobs QUEUED sont durables ; le scheduler les prend sans navigateur ouvert.
Les jobs RUNNING dont le lease a expiré deviennent FAILED/WORKER_LOST avec fencing
comme auparavant ; les autres jobs du compte peuvent ensuite démarrer.

Les budgets indépendants de liens, sitemaps, requêtes, réponse, DNS, durée et annulation
restent actifs. Au plus 1000 lignes distinctes par découverte, 2 Mio par corps et
16 workers (4 par défaut) : augmenter URL/profondeur ne supprime aucune autre borne.
La file bornée et l'expiration à 24 h limitent les tâches en attente. La borne de
stockage par découverte est de 1000 lignes ; les snapshots terminés restent
conservés pour l'historique des lots. L'expiration ne purge pas ces données.
Dimensionner la base et surveiller la rétention avant d'augmenter les plafonds.
La raison de troncature et les compteurs restent visibles ; REQUEST_LIMIT identifie
le nouveau budget HTTP. Une découverte ne crée jamais d'audit ni de réservation.
La sélection charge toutes les pages par fenêtres de 100 ; le lot reste limité à
50 pages et nécessite sélection + confirmation explicite du coût.

## Hôtes www — #651

Le formulaire accepte un hôte nu ou une URL HTTP(S) racine et transmet uniquement l’hôte canonique (prise en charge des URL racines déjà livrée par #681). www.exemple.fr est conservé comme hôte exact, distinct de exemple.fr. Aucun lien ni redirection apex ↔ www ou vers blog/shop ne change implicitement ce périmètre : EXTERNAL_HOST est déclaré avant la requête hors hôte. La validation DNS/SSRF et le proxy egress épinglé restent obligatoires à chaque requête autorisée.

Un échec de validation réseau à l’admission est maintenant discovery_target_unavailable, avec aide FR/EN sur adresse non publique, DNS ou délai. hostname_invalid reste réservé au format. Tests contrôlés : validation BFF/formulaire pour www.exemple.fr et www.redpoint.fr, crawler www avec liens hors hôte, trois sens de redirection, et conservation de l’identité dans DiscoveryIT. Aucun test n’a besoin d’appeler ces sites réels.
