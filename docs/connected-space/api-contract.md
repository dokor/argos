# Contrat API cible v1

**Contrat cible** : F01 fournit le [schéma OpenAPI canonique](../../apps/api-backend/src/main/resources/contracts/connected-space.openapi.json),
les DTO Java validés et les types TypeScript générés. Le [guide F01](foundation-f01.md)
décrit les commandes et limites. Les opérations livrées par F01/F03/F05/F06 portent
`x-implementation: available`, dont les lectures `/usage` et `/usage/events`
([guide F05](usage-f05.md)) et `/domain-discoveries` ([guide F06](discovery-f06.md)).
Les lots et synthèses de domaines restent `planned`.
Les contrats compte/usage actuels restent réutilisés sauf écarts explicites D-11
et D-12. BFF same-origin, puis mêmes ressources dans l’API Java sous `/api`.

## Conventions communes

- IDs opaques pour le client, représentés par des chaînes décimales positives
  dans la plage Java Long ; ne jamais les convertir en Number JavaScript.
  Dates ISO-8601 UTC, montants de crédits entiers ≥ 0,
  `limit:null` illimité. Champs inconnus de mutation rejetés.
- Session obligatoire, mutations avec CSRF/origin selon contrat existant.
  Aucun `ownerId`, rôle ou prix accepté depuis le corps.
- Liste : `items`, `total`, `limit`, `offset`, `snapshotAt` ; limite défaut20,
  maximum100 ; filtre/tri avant pagination. Compteurs portent sur tout le scope.
- Erreur : `{ "error": { "code": "QUOTA_EXCEEDED", "requestId": "…",
  "details": { "required": 8, "available": 3, "currentVersion": null } } }`. Traduction côté UI,
  jamais message d’exception interne. Uniformiser avec enveloppe existante
  via adaptation typée, pas deux parseurs ad hoc dans chaque écran.
- 400 syntaxe/validation, 401 session, 403 rôle/vérification, 404 ressource
  absente ou autre propriétaire, 409 conflit/quota/version, 410 découverte
  expirée, 429 limite opérationnelle avec Retry-After, 503 service indisponible.

## Ressources nouvelles

| Méthode / chemin `/api/account` | Entrée | Sortie / effets |
|---|---|---|
| GET `/overview` | aucun | snapshotAt, scope, trackedUrls, priorityUrls, incompleteUrls, activeRuns, usage, recentRuns, priorityPages |
| GET `/pages` | attention=priority/incomplete, query, limit, offset | Projections dernières tentatives par URL ; totals cohérents overview |
| GET `/domains` | query, limit, offset | DomainSummary[], dernière tentative/lot, date, compteurs et couverture connue |
| POST `/domain-discoveries` | hostname, maxUrls, maxDepth, excludedPaths ; Idempotency-Key | 202 Discovery ; un actif/compte, limites effectives |
| GET `/domain-discoveries` | aucun | Zéro ou une découverte active du compte |
| GET `/domain-discoveries/{id}` | aucun | Discovery, état/compteurs/expiration, motif de fin |
| GET `/domain-discoveries/{id}/pages` | limit, offset, inclusion=eligible/excluded/all | URL normalisées, pageId, éligibilité, source, motif |
| POST `/domain-discoveries/{id}/cancel` | aucun | 202 annulation demandée ou 200 terminal existant |
| POST `/domain-batches` | discoveryId, selectedPageIds, profileId ; Idempotency-Key | 202 Batch, domainId, reservedCredits, stablePath ; atomique |
| GET `/domains/{domainId}/batches` | limit, offset | Historique privé du domaine |
| GET `/domains/{domainId}/batches/{id}` | aucun | BatchSummary, compteurs complets, commonFindings, problematicPages, usage |
| GET `/domains/{domainId}/batches/{id}/pages` | ruleKey, severity, status, query, sort, limit, offset | Pages du lot, runId, score/coverage, constats et causes |
| POST `/domains/{domainId}/batches/{id}/cancel` | aucun | 202 ou 200 terminal ; libérations décrites FUN-07 |
| GET `/usage/events` | période, limit, offset | Réservations/consommations/libérations, runId, batchId si présent |
| GET `/analysis-profiles` | aucun | Profils supportés, version/description et limites effectives, defaultProfileId |

`Discovery` : id, hostname, status QUEUED/RUNNING/COMPLETED/CANCELED/FAILED,
createdAt/finishedAt/expiresAt, effectiveLimits, eligibleCount, excludedCount,
truncated:boolean, stopReason nullable, version. Les URL sont sur la ressource
paginée, pas dans une réponse de statut illimitée.

`DomainSummary` : id, hostname, latestBatchId, latestAttemptAt, batchStatus,
counts:{selectedPages, completePages, partialPages, failedPages, canceledPages,
activePages, priorityPages} ; **aucun domainScore moyen**. L’ID privé du domaine
est `ARG_ACCOUNT_SITE.id`, jamais l’ID de cache partagé `ARG_DOMAIN.id`.

`Batch` : id, domainId, discoveryId, profileSnapshot, createdAt/finishedAt,
status QUEUED/RUNNING/COMPLETED/PARTIAL/FAILED/CANCELED, cancelRequested,
counts, commonFindings, problematicPages (top5), usage, snapshotAt/version.
Les compteurs de complétude forment une partition des enfants ; priorityPages
est transversal. Statut terminal : tous complets→COMPLETED ; tous sans rapport
échoués→FAILED ; annulation demandée avec au moins un enfant annulé→CANCELED
(rapports publiés conservés) ; autres résultats mixtes→PARTIAL.

`PageResult` : pageId, normalizedUrl, runId, executionStatus, completeness,
score:{value:number|null,provisional:boolean,reason:string|null},
coverage:{ratio:number|null,version:string|null}, criticalCount, importantCount,
moduleStatuses, failureReason nullable, reportAvailable:boolean.
Si aucun rapport, les compteurs de constats sont null, pas 0. Une projection
liste peut résumer les modules ; le run fournit le détail complet.

`CommonFinding` : ruleKey, definitionVersion, category, provenance[], severity,
titleKey, affectedPages, evaluatedPages, selectedPages, examplePageIds bornés,
evidenceAvailable:boolean. Les textes/actions détaillés viennent du catalogue
et du rapport ; ne pas dupliquer une chaîne française comme identifiant.

### Exemple d’admission de lot

```http
POST /api/account/domain-batches
Idempotency-Key: 11111111-1111-4111-8111-111111111111
Content-Type: application/json

{"discoveryId":"123","selectedPageIds":["1","2"],"profileId":"server-default-v1"}
```

```json
{"id":"456","domainId":"17","status":"QUEUED","reservedCredits":2,"stablePath":"/account/domains/17/batches/456"}
```

Les IDs et la clé d’exemple sont fictifs, jamais à coder en dur. Le client doit
obtenir le profil par GET `/analysis-profiles` : `server-default-v1` correspond
actuellement aux réglages des collecteurs serveur, sans variante mobile/desktop.
Générer une
clé unique par nouvelle intention de lancement, conservée lors de ses reprises.
Même clé/même sélection normalisée = même batch ; autre contenu =
`IDEMPOTENCY_CONFLICT`. Refus `QUOTA_EXCEEDED`, `ACTIVE_BATCH_LIMIT`,
`DISCOVERY_EXPIRED`, `INVALID_SELECTION`, `UNSUPPORTED_PROFILE`,
`UNSAFE_URL` : aucun enfant ni réservation créé. Validation SSRF revérifiée
au lancement et au transport même si la découverte a déjà validé l’URL.

## Ressources réutilisées et extensions

| Famille | Référence / changement |
|---|---|
| Auth, me, sessions, méthodes | [Contrat compte](../accounts/contract.md) ; réutiliser routes et politique ; compléter statut suspendu |
| Sites, runs, rapports privés | [Contrat sites](../accounts/sites-contract.md) ; ouvrir le run enfant exact ; profil/couverture réels |
| Usage courant | [Contrat usage](../accounts/usage-contract.md) ; registre atomique étendu au lot, pas second compteur |
| Admin users et entitlement | [Contrat admin](../accounts/administration-contract.md) ; ajouter expectedVersion, reasonCode et 409 sous used+reserved |
| Admin suspension | Nouveau POST `/admin/users/{id}/suspension` : suspended:boolean, expectedVersion, reasonCode, confirmation ; session récente |
| Admin catalogue | Nouveau GET `/admin/entitlement-options` : offres/plafonds configurables et codes de motifs, sans rôle mutable |

Les chemins admin du tableau sont relatifs à `/api/account`. Codes motifs
initiaux proposés : `SUPPORT_REQUEST`, `PLAN_ADJUSTMENT`, `ABUSE_REVIEW`,
`ACCOUNT_RECOVERY`. L’API peut restreindre la liste par opération. Aucun champ
de commentaire libre. Contrôle de version + quota + journal dans la même
transaction ; 409 `STALE_VERSION` ou `LIMIT_BELOW_COMMITTED_USAGE`. Confirmation
explicite côté client ne remplace pas la validation serveur. Fournir
currentVersion et valeurs autorisées sans dévoiler de secret.

Les essais contractuels doivent figer null/absent, enums et arrondis. Une
modification du contrat pendant réalisation met à jour dossier, fixtures,
schéma et tests dans la même PR. Les fixtures sont illustratives : les IDs
et clés de règles y sont dédiés, pas une preuve d’endpoints déjà livrés.

## Implémentation F03

Voir [admission URL, progression et recherche privée](site-diagnostic-f03.md#contrats-et-persistance) : `POST /account/analyses`, idempotence, V20, filtre `q` et disponibilité du rapport exact. Ces extensions réutilisent le registre de sessions et de crédits existant.

## Implémentation F04

Voir [compte personnel F04](account-f04.md#contrats-conservés) : réutilisation des endpoints compte, retour OAuth vers les réglages et code public oauth_cancelled. Aucun nouveau schéma ni endpoint métier.
