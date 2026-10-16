# F07 — Lancement des analyses par lots

Implémentation serveur de #12, après F06. Exigences FUN-07, ARC-03,
QA-09, QA-10 et QA-11. La synthèse des constats reste F08 et les écrans
intégrés restent F09. Les parcours de la maquette ne sont pas déclarés livrés.

## Admission et contrat

Le BFF et Java exposent, sous `/api/account`, les opérations suivantes :

| Opération | Effet |
|---|---|
| POST `/domain-batches` | 202 `AdmittedBatch`, sélection de 1 à 50 pages éligibles |
| GET `/domain-batches` | Tous les `BatchProgress` actifs du propriétaire |
| GET `/domains/{domainId}/batches/{id}/progress` | État, compteurs, crédits et profil figé |
| GET `/domains/{domainId}/batches/{id}/progress/pages` | Pages, runId et disponibilité du rapport ; filtre `status`, limit/offset |
| POST `/domains/{domainId}/batches/{id}/cancel` | Corps vide ; 202 si encore actif, sinon 200 |

Les nouvelles lectures de progression évitent de présenter des constats vides
comme une synthèse F08. Les routes de synthèse, historique et liste de domaines
restent `planned` dans OpenAPI. `stablePath` prépare le résultat F09. Un runId
permet d'utiliser le diagnostic privé F03 ; aucun token de rapport n'est exposé.

Session vérifiée, propriétaire vérifié sur chaque ressource, CSRF pour les
mutations, réponses `private, no-store`. GET ne renouvelle pas l'activité.
Les IDs restent des chaînes décimales ; champs inconnus et sélections dupliquées
sont refusés. Filtre appliqué avant pagination, limite par défaut 20, maximum 100.
Le chargement interne reste borné par les 50 enfants, sans JSON des rapports ni N+1.

La découverte doit être terminale, privée, non expirée (24 h), et les pages
sélectionnées éligibles. Une découverte annulée/échouée conserve ses pages déjà
validées. Revalidation de l'hôte exact, de la syntaxe normalisée et du DNS public
à l'admission, avec un budget partagé de 5 secondes. Les transports d'audit
conservent leurs propres validations SSRF et leur proxy d'egress.

`Idempotency-Key` est un UUID hexadécimal minuscule. Une clé appartient à un
propriétaire et son fingerprint ignore l'ordre des IDs. Replay avant les contrôles
d'expiration/quota : même contenu renvoie le lot initial, contenu différent donne
409 `idempotency_conflict`. La clé est gardée pendant toute la vie du lot.
`reservedCredits` rappelle le coût initial admis ; les crédits actuels sont dans
`BatchProgress.credits`. Une relance explicite utilise une nouvelle clé et de
nouveaux runs. Aucun retry ne crée automatiquement un nouveau lot.

Le refus de quota garde le contrat F05 : 429 `quota_exceeded` et `Retry-After`,
au lieu du 409 de la cible initiale. La file du compte pleine donne 429 `batch_queue_full` ;
une découverte en cours 409 `discovery_not_ready`, expirée 410 `discovery_expired`,
une sélection exclue 400 `selection_ineligible`, une cible devenue interdite
400 `selection_url_invalid`, une ressource étrangère 404.

## Atomicité et ordre des verrous

Une transaction crée le lot, les relations privées aux URL, les N runs, enfants
et réservations. Admission globale et quota insuffisants font tout annuler.
L'identité partagée d'une URL peut être précréée par le DAO existant ; elle ne
constitue ni un suivi privé, ni un run, ni un débit. Le verrou du compte sérialise les admissions et applique le plafond configurable
de lots actifs, y compris avec deux processus applicatifs.

Ordre d'admission : compte/session, éventuel ancien lot et ses runs pour le
réconcilier, sémaphore global de la file, usage, nouveaux enfants. La création
unitaire respecte aussi compte → file → usage. L'annulation verrouille le lot
puis **tous** ses runs par ID avant de libérer une réservation. Publication :
run → file (trigger terminal) → métadonnée de l'enfant → usage ; elle n'acquiert
pas le verrou du lot parent. Ne pas inverser cet ordre.

Les transactions de lot utilisent READ COMMITTED : une lecture après attente
sur un run voit sa publication et son crédit dans le même état. Les métadonnées
de complétude sont écrites dans la transaction de publication. L'empreinte de
progression évite de modifier `version` sur chaque lecture identique.

## Exécution, reprise et annulation

Le scheduler existant réclame et traite les runs dans sa file durable ; aucun
nouveau pool de collecteurs et aucun timer navigateur ne pilote l'exécution.
Le claim transmis au processeur doit encore correspondre au run. Le profil figé
est contrôlé avant les appels réseau : changement de politique incompatible →
FAILED `ANALYSIS_PROFILE_CHANGED`, réservation libérée, pas de fausse comparaison.

Le reaper existant utilise `audit.scheduler.stuck-timeout` (20 min par défaut)
et `audit.scheduler.max-attempts` (3 par défaut ; voir configuration réelle).
Il compare sous verrou le claim et `startedAt` observés. Reprise : même run,
même réservation, nouveau claim, progression réinitialisée dans la même transaction.
Tentatives épuisées : FAILED et RELEASED. Annulation demandée : CANCELED et RELEASED.
Un ancien worker ne peut ni publier, ni échouer, ni modifier la progression du nouveau claim. La deadline
courte du moteur borne la collecte ; le reaper reste la récupération après crash.

Un superviseur réconcilie jusqu'à 100 lots actifs toutes les 2 secondes ; les
lectures et mutations réconcilient également. Les états persistés restent valides
après fermeture du navigateur ou redémarrage de l'application.

Annulation : QUEUED devient CANCELED immédiatement ; RUNNING conserve sa
réservation jusqu'à publication, échec ou reaper. La transaction de publication
vérifie l'annulation sous le même verrou du run. Si la publication gagne, son
rapport et son crédit COUNTED sont conservés. Sinon aucun rapport n'est publié.

## Sens des résultats

- `counts` partitionne l'exécution : queued, running, completed, failed, canceled.
- Parmi completed : full, partial, unknown. FULL exige 100 % de complétude
  opérationnelle et une couverture mesurée complète connue. Le seuil de
  suffisance de 80 % et le score de qualité ne remplacent pas cette condition.
- `credits` partitionne les pages admises : reserved, counted, released.
- Tous les diagnostics FULL : COMPLETED ; tous échoués : FAILED ; interruption
  demandée avec au moins une page annulée : CANCELED ; autres résultats terminaux
  mixtes/incomplets : PARTIAL. Un run actif maintient le lot QUEUED ou RUNNING.

V23 ajoute uniquement une empreinte de progression au lot et la complétude à
l'enfant. La rétention d'un rapport ne modifie ni le résultat historique du lot
ni sa consommation ; `reportAvailable` devient faux. Les compteurs sont calculés
sur les enfants privés et le registre d'usage, jamais sur les valeurs de la maquette.

## Vérification

- `BatchIT` sur MariaDB : admission et rollback après un enfant, quota/file pleins,
  replay concurrent, isolation, sélection invalide/SSRF, reprise après crash,
  ancien claim, annulation/publication concurrentes, rollback de publication,
  réconciliation hors navigateur, filtres et rétention ; routes HTTP privées/CSRF.
- `BatchStateTest`, `ReportCompletenessTest`, `StuckAuditRunReaperTest`,
  `AuditProcessorServiceTest` et `AuditQueueServiceTest` : règles et fencing.
- BFF : sélections, IDs hors précision JS, paramètres, CSRF et routes F08 fermées.
- Commandes : `mvn test`, profil CI `mariadb-integration` avec `BatchIT`,
  `npm test`, `npm run lint`, `npm run build`, génération de contrats `--check`
  et `python docs/connected-space/validate.py`.

Les preuves d'exécution et le résultat CI sont joints à la PR. Pas de fusion,
déploiement, capture visuelle ni recette des écrans F09 dans ce lot serveur.

## Plusieurs domaines en attente (#661)

La limite d'un lot actif par compte est remplacée par `batch.account-queue-limit`
(5 lots QUEUED/RUNNING par défaut, bornes 1–50, entier obligatoire). Dépassement :
429 `batch_queue_full`, `Retry-After: 2`, sans création partielle ni réservation.
Les admissions du compte restent sérialisées ; chaque lot réserve ses crédits
pour l'ensemble de sa sélection, dans la transaction de création de ses runs.
Les réservations des autres lots sont incluses dans le quota disponible ; un
replay conserve le même lot et ne réserve rien de plus. Annuler un lot libère
uniquement ses runs en attente ; les runs déjà actifs suivent l'annulation existante.

Les runs rejoignent la file durable globale existante (100 runs maximum). Le worker
reste séquentiel : il choisit le compte le moins récemment servi, puis le run le
plus ancien de ce compte. Les lots peuvent coexister, sans augmenter le nombre de
navigateurs. Le réconciliateur progresse sans onglet ouvert. Liste et détail des
domaines affichent les découvertes à reprendre et les lots actifs, chacun avec
son état et son lien ; les sélections restent attachées à leur découverte dans
l'URL. Aucun audit payant n'est déclenché par une découverte ou par une navigation.
Appliquer V30 puis redémarrer toutes les instances avec la même configuration.
