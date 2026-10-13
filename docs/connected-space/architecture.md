# Architecture cible et frontières de la refonte

## ARC-01 — Répartition

Next.js conserve App Router, layouts serveur, composants client pour les
interactions/i18n/thème, SCSS Modules. Navigateur → `/api/*` same-origin → BFF
→ Java. `API_BASE`, secrets et jetons serveur ne sont jamais exposés au client.
Les garde-fous BFF ne remplacent pas les contrôles Java. L’identité est issue
de la session vérifiée, jamais d’un `ownerId` fourni par le navigateur.

Java reste l’autorité des autorisations, quotas, transitions et agrégats.
Réutiliser les services de compte, le normaliseur, le registre d’usage et le
moteur d’audit, ses verrous et ses publications idempotentes. Le crawler et
l’orchestrateur de lots sont des services distincts ; `DomainAnalysisService`
actuel est un cache technologique, pas un futur lot renommé.

## ARC-02 — Modèle logique

Noms indicatifs, à transcrire en tables/migrations/entités QueryDSL dans F01.

| Entité | Invariants / index nécessaires |
|---|---|
| Compte/session/méthode | Registre existant ; statut actif/suspendu/archivé, rôle séparé de l’offre, unicité des identités externes |
| Domaine de compte | ID opaque, ownerId, hostname normalisé ; unique(ownerId, hostname) |
| URL suivie | Propriétaire, domaine, URL normalisée ; déduplication suivant le normaliseur ; index de listes privées |
| Découverte | ownerId, hôte, paramètres/limites figés, état, dates, expiration, compteurs, causes de troncature ; un actif/owner |
| URL découverte | discoveryId, URL validée, source, profondeur, raison d’exclusion ; unicité par découverte |
| Lot de domaine | ownerId, domainId, discoveryId, profil figé, idempotencyKey, fingerprint requête, état, dates, version ; un actif/owner |
| Enfant du lot | batchId, URL snapshot, runId unique, état dérivé ; unique(batchId, URL normalisée) |
| Run/rapport | Propriétaire, profil réellement exécuté, modules, couverture, version et résultats figés ; conserver le contrat existant |
| Usage | Registre compte + réservation unique/run ; réservé/compté/libéré et période de publication |
| Événement admin | Auteur/cible/date/code motif/avant/après/requestId ; append-only, sans données d’authentification |

Ne pas dupliquer le JSON des rapports dans les lots. Les projections de
synthèse peuvent être matérialisées avec leur version/source ; recalculables
depuis les enfants immuables. Les agrégats filtrent le propriétaire avant tout
GROUP BY/LIMIT et restent cohérents avec le détail. Un index de projection
ne constitue jamais une frontière d’autorisation.

## ARC-03 — Admission et concurrence

1. Vérifier session active/vérifiée, CSRF, sélection et snapshot.
2. Verrouiller le registre d’usage du propriétaire ; appliquer la limite de
   lot actif et la clé d’idempotence.
3. Dans **une transaction MariaDB**, créer le lot, ses N runs/enfants et N
   réservations, ou ne rien créer. `used+reserved+N <= limit` si fini.
4. Répondre avec la ressource persistée. Les workers réclament les runs de
   façon atomique. Le job n’est pas stocké dans une session navigateur.

Une clé est unique par propriétaire + type d’opération, conservée au moins
24 h et pendant toute la vie active de l’opération ; les lots persistés gardent
leur clé pour éviter une double admission tardive. Même clé/même contenu →
même ressource ; même clé/contenu différent → 409. Le fingerprint ignore
l’ordre de sélection, pas l’URL ni le profil. Ne pas rejouer un refus de quota
comme un succès mis en cache. Une nouvelle soumission corrigée utilise une
nouvelle clé. Le frontend garde la clé en mémoire pour la requête incertaine ;
après navigation, retrouve d’abord les opérations actives via l’API.

La publication du rapport et le passage RESERVED→COUNTED sont atomiques.
FAILED/CANCELED sans rapport → RELEASED une seule fois. Utiliser les mécanismes
de claim existants ; documenter lease/heartbeat/deadline et récupération des
jobs orphelins dans F07. Test avec deux workers, crash après admission et
crash à publication. Un superviseur réconcilie les transitions durables ;
aucun mécanisme « nettoyage » ne libère arbitrairement un run encore actif.

## ARC-04 — Découverte et sécurité

Validation BFF + Java, résolution DNS contrôlée et revalidation au transport,
redirections contrôlées à chaque saut, blocage des plages privées/locales,
IPv4/IPv6 et du rebinding. Appliquer ces règles à robots, sitemap, liens et
URL initiale. Ne jamais suivre un sitemap externe implicitement. Pas de
credentials, cookies utilisateurs ou accès intranet transmis au crawler.

Valeurs configurables proposées : 50 URL, profondeur 3, 60 s, 2 requêtes/hôte,
5 redirections/requête, 2 MiB/corps décompressé, 1 MiB/robots, 5 s/connect et
10 s/réponse plafonnées par le budget restant ; XML sans DTD/entités externes.
Bornes de liens/sitemaps : arrêter la découverte au budget d’URL, ne pas
charger une liste illimitée pour ensuite la tronquer. Identifier le user-agent,
respecter robots, limiter par propriétaire et hôte ; limite globale opérable.
Résultats vides/bloqués/tronqués sont des résultats explicites, pas une réussite
complète. Annulation coopérative avec persistance des pages déjà découvertes.

Une ressource privée appartenant à autrui retourne 404, un rôle insuffisant
403, session absente/invalide 401. Cache `no-store` sur données privées,
`noindex` sur espace connecté. URL dans logs via sanitisation existante.
Preuves bornées/sanitisation #538, pas de tokens ni de query sensible dans
exports/diagnostics. Les listes admin n’ouvrent pas implicitement tous les
rapports privés : conserver leur politique d’accès spécifique.

## ARC-05 — Initialisation propre, sans compatibilité ancienne

F01 produit le modèle cible et des migrations d’initialisation testées sur une
**base vierge isolée**. Pas de backfill, double écriture, anciens endpoints
connectés ou drapeau de bascule exigés. Cela ne justifie pas de réécrire les
versions Flyway déjà appliquées à une base conservée.

Deux frontières sont à documenter dans la PR d’implémentation : tables du
moteur/public conservées, et tables connectées nouvelles/remplacées. Si des
tables sont partagées, les séparer explicitement avant de prétendre effacer
l’ancien espace. Les entités QueryDSL/Q* sont mises à jour avec le SQL.

Le lot de mise en service livre un runbook : environnement nommé, inventaire
des données à abandonner, initialisation du premier administrateur par voie
opérateur, configuration des fournisseurs/quota, smoke tests et diagnostic.
La décision d’abandonner l’historique connecté est autorisée comme conception ;
l’exécution d’un reset de production demande une autorisation distincte.
Aucun script de ce dossier n’efface de données. On ne construit pas un ancien
et un nouvel espace parallèles pour une « bascule réversible ».

## ARC-06 — Observabilité et performances

Corréler requestId, discoveryId, batchId, runId, statut et durée sans URL brute.
Mesurer file active/attente, saturation headless, découverte tronquée, échecs,
réservations bloquées, publication/consommation incohérente. Journaux admin
distincts des logs techniques. Alertes opérables, pas de métrique fictive UI.

Les listes ne chargent pas tous les rapports JSON. Requêtes paginées/projections
et index explicites ; prouver l’absence de N+1 et de lectures hors propriétaire.
Polling avec backoff borné et arrêt au terminal, 401 ou ressource supprimée ;
respecter Retry-After, pause lorsque l’onglet est caché puis revalidation.
