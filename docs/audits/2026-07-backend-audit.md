# Audit technique backend `api-backend` — juillet 2026

> Issue de référence : **#128**. Objectif : consolider les fondations techniques du backend avant la V3 (comptes utilisateurs, premium).
> Périmètre : `apps/api-backend` (Java 21 / Maven / Jersey-Grizzly / Guice / QueryDSL + Flyway), ~86 classes `src/main`.

## Méthode

Audit mené sur 5 dimensions, code lu en profondeur (orchestration, 8 modules d'analyse + clients externes, scoring, rapport, webservices, DAO, scheduler, configuration) :

1. Architecture, découpage modules/services, duplication, simplifications.
2. Gestion des erreurs, transactions DB, résilience face aux services externes.
3. Couverture de tests.
4. Sécurité et validation des entrées.
5. Performances et consommation mémoire (cible **Raspberry Pi**).

Chaque chantier significatif a été transformé en issue GitHub actionnable (voir la roadmap). Priorités : **P1** = à traiter avant la V3, **P2** = souhaitable, **P3** = nice-to-have / cosmétique.

## Points positifs (à préserver)

- **Isolation par module** : `AuditProcessorService.runModule()` + `fallbackModule` isolent proprement l'échec/timeout d'un module (mode dégradé `FAILED`/`TIMEOUT`/`UNAVAILABLE`), l'audit continue. La propagation `degraded`/`completeness`/`moduleStatuses` est bien conçue.
- **Chaîne de scoring** déjà aplatie (issue #188) : plus de problème de lisibilité V2→V8.
- **Cache `DomainAnalysis` (TTL 24h)** bien conçu : index `(domain_id, expires_at)`, une ligne par domaine, purge avant réécriture.
- **Requêtes QueryDSL paramétrées** partout → pas d'injection SQL. Taille du body limitée (500 Ko). Re-validation SSRF côté backend (indépendante du BFF). Génération de token via `SecureRandom` 256 bits base64url.

## Constat transverse

Le code est **propre localement** (doc soignée, records immuables, dégradation gracieuse) mais présente : (a) des **faiblesses de sécurité exploitables** sur les frontières d'entrée/sortie, (b) des **risques d'OOM** sur Raspberry liés à des payloads non bornés, (c) une **abstraction de plugin à moitié construite** générant de la duplication structurelle, et (d) une **couverture de tests aveugle sur les zones les plus critiques** (claim atomique, DAO, endpoints, publication).

> **Note** : le chantier « reaper des runs restés en `RUNNING` après crash/redémarrage » identifié par l'audit de résilience est **déjà traité** par les issues **#127 / #211** (PR #215). Il n'a donc pas fait l'objet d'une nouvelle issue.

---

## 1. Architecture / découpage / duplication

| Constat | Fichiers clés | Issue |
|---|---|---|
| Abstraction « plugin » de modules à moitié construite puis contournée (Multibinder mort à 5/8, constructeur à 16 params, liste des modules dupliquée ≥3×, `scope()` jamais lu) | `ApplicationModule.java:39-45`, `AuditProcessorService.java:47-201`, `AuditRunService.java:29-38` | **#225** (P1) |
| 5 clients HTTP externes dupliquent le même squelette ; deux systèmes de config (`System.getenv()` vs `ConfigurationService`) | `LighthouseClient`, `PlaywrightRuntimeClient`, `ObservatoryClient`, `SslLabsClient`, `ZapClient` | **#230** (P2) |
| Double couche redondante de gestion « module indisponible » (`*.available` par module **et** `*.collect` par l'orchestrateur), policy à blinder 2× | `AuditProcessorService.java:317-403`, `*ModuleAnalyzer.errorModule()`, `DefaultScorePolicy` | **#231** (P2) |
| `AuditService` (domaine) dépend des DTO `webservices.*` (inversion de dépendance) + cumule 3 responsabilités | `AuditService.java:11-15,60-158,167-218` | **#234** (P2) |
| Helpers dupliqués (extraction hostname, parsing `JsonNode` défensif) + structure de modules incohérente (`lighthouse/`, `playwright/` hors `modules/`) | multiples | **#235** (P3) |

## 2. Erreurs / transactions / résilience

| Constat | Fichiers clés | Issue |
|---|---|---|
| Runs bloqués en `RUNNING` après crash/redéploiement (aucune reprise) | `AuditRunDao`, `WebApplication`, `SchedulerJobs` | **déjà couvert : #127 / #211 (PR #215)** |
| Pas de budget temps global par audit ; SSL Labs gaspille ~6 min ; file mono-thread gelée par un run lent | `AuditProcessorService`, `SslLabsClient.java:23-58`, `HttpModuleAnalyzer.java:73-86` | **#223** (P1) |
| `complete` + `publishIfAbsent` non atomiques → rapports orphelins ; `findOrCreate`/`createAudit` non idempotents → 500 sous concurrence | `AuditProcessorService.java:262-268`, `ReportPublishService.java:98-101`, `DomainDao`, `AuditService.java:194-205` | **#228** (P2) |
| Cache tech corrompu jamais auto-réparé (24h de `FAILED`) ; `FAIL_ON_UNKNOWN_PROPERTIES` non désactivé pour les réponses externes | `DomainAnalysisService.java:63-98`, `PlaywrightRuntimeClient.java:64` | **#229** (P2) |
| Réponses externes non bornées → OOM + `result_json` gonflé | *(voir dimension Perf — #220, #221)* | #220 / #221 |

## 3. Couverture de tests

Ratio estimé **~40 %** de la logique métier réellement testable (100 % de tests unitaires Mockito, **aucun test d'intégration**). Levier majeur : l'infra de test DB (`plume-db-test`) existe mais est **désactivée** (`GuiceDbTestModule` commenté).

| Constat | Issue |
|---|---|
| Infra de test DB désactivée → claim atomique (`AuditRunDao.claimRun`) et DAOs non testés contre une vraie DB | **#224** (P1) |
| Webservices JAX-RS, auth interne, `ReportPublishService` (échec silencieux), `TokenService`, `claimNextQueuedRun` non couverts | **#233** (P2) |
| Pas de JaCoCo (dérive silencieuse) ; `SchedulerJobs`/`ConfigurationService` non testés | **#237** (P3) |

## 4. Sécurité / validation des entrées

| Constat | Fichiers clés | Issue |
|---|---|---|
| SSRF : pas de résolution DNS pour les noms de domaine + redirections non revalidées + DNS rebinding | `UrlNormalizer.java:180-221`, `HttpModuleAnalyzer.java:73-104` | **#217** (P1) |
| Exposition publique de tous les audits / tokens / `resultJson` + IDOR sur `runId` séquentiel | `AuditsWs.java`, `AuditService.java:220-238` | **#218** (P1) |
| Secrets en clair commités (BasicAuth interne, mot de passe DB prod) | `application.conf:2-3`, `prod.conf:4-6` | **#219** (P1) |
| Tokens de rapport stockés en clair (annule le bénéfice du hash) | `AuditRun.report_token`, `AuditReport.public_token` | **#226** (P2) |
| Pas d'auth ni de rate-limiting sur les endpoints d'écriture publics + énumération d'emails newsletter | `AuditsWs`, `NewsletterWs.java:61` | **#227** (P2) |
| *(Log injection & validation incomplète : consolidés dans les chantiers ci-dessus / défense en profondeur)* | `NewsletterWs.java:57`, `HttpModuleAnalyzer` | *voir #227 / #218* |

## 5. Performances / mémoire (Raspberry Pi)

Le goulot n'est pas le CPU (traitement mono-run I/O-bound) mais la **mémoire** et le **volume de payloads**.

| Constat | Fichiers clés | Issue |
|---|---|---|
| Lecture des corps HTTP sans plafond (`BodyHandlers.ofString()`) → OOM (LHR 3-20 Mo, page géante) | tous les clients + `HttpModuleAnalyzer.java:86,788` | **#220** (P1) |
| Corps HTML brut conservé en RAM **et** persisté dans `result_json` (inutile au rapport public) | `HttpModuleAnalyzer.java:245`, `AuditProcessorService.java:260` | **#221** (P1) |
| Listing/historique chargent et renvoient les LONGTEXT en masse ; `global_score` à dénormaliser | `AuditService.java:104,119-158`, `AuditsWs.java:118` | **#222** (P1) |
| Pool Grizzly surdimensionné (512) et Hikari oisif pour un Pi mono-run | `application.conf:9`, `GrizzlySetup.java:48-49` | **#232** (P2) |
| `updateModuleStatus` en read-modify-write (~16 A/R DB) ; `ssl`+`observatory` parallélisables | `AuditRunService.java:107-121`, `AuditProcessorService.java:159-196` | **#236** (P3) |

---

## Roadmap technique priorisée

### P1 — à traiter avant la V3 (fondations / risques exploitables)

| # | Chantier | Domaine |
|---|---|---|
| #217 | Durcir la protection SSRF (DNS + redirections) | security |
| #218 | Contrôle d'accès des endpoints publics (fuite tokens / IDOR) | security |
| #219 | Externaliser et roter les secrets commités | security / devops |
| #220 | Borner la taille des réponses HTTP externes (anti-OOM) | backend |
| #221 | Retirer le corps HTML brut de `result_json` | backend |
| #222 | Listing/historique sans LONGTEXT + dénormaliser `global_score` | backend |
| #223 | Budget temps global par audit + réduction SSL Labs | backend |
| #224 | Réactiver l'infra de test DB + couvrir le claim atomique | tests |
| #225 | Finaliser (ou retirer) l'abstraction plugin des modules | archi |
| #127 / #211 | Reprise/abandon des runs bloqués *(PR #215, en cours)* | backend |

### P2 — souhaitable

| # | Chantier | Domaine |
|---|---|---|
| #226 | Ne persister que le hash des tokens de rapport | security |
| #227 | Auth + rate-limiting endpoints d'écriture (+ newsletter) | security |
| #228 | Atomicité `complete`+publish + `findOrCreate` idempotent | backend |
| #229 | Robustesse JSON externe (cache tech + `FAIL_ON_UNKNOWN_PROPERTIES`) | backend |
| #230 | Client HTTP externe partagé + config centralisée | archi |
| #231 | Unifier la gestion « module indisponible » | backend |
| #232 | Redimensionner les pools Grizzly / Hikari | devops |
| #233 | Couvrir webservices / auth interne / publication / token | tests |
| #234 | Découpler `AuditService` de la couche webservices | archi |

### P3 — nice-to-have / cosmétique

| # | Chantier | Domaine |
|---|---|---|
| #235 | Factoriser utils (host/JsonNode) + normaliser structure modules | archi |
| #236 | `updateModuleStatus` ciblé + paralléliser `ssl`/`observatory` | backend |
| #237 | JaCoCo + tests `SchedulerJobs`/`ConfigurationService` | tests |

## Séquencement conseillé

1. **Sécurité P1 d'abord** (#217, #218, #219) — risques exploitables réels.
2. **Mémoire/OOM P1** (#220, #221, #222) — stabilité Raspberry (vecteurs d'OOM les plus faciles à déclencher).
3. **#225** (abstraction plugin) débloque #230, #231, #235.
4. **#224** (infra de test DB) est prérequis d'une bonne partie des tests P2 (#233) et sécurise les refactorings suivants.
5. Puis P2 par domaine, P3 en nettoyage opportuniste.
