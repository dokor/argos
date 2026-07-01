# Argos — Instructions pour agents IA

Argos est un outil d'audit de site web : l'utilisateur soumet une URL, cinq modules d'analyse tournent en séquence, et un rapport scoré privé est produit en ~20 secondes.

---

## Structure du monorepo

```
argos/
├── apps/
│   ├── api-backend/        Java 21, Maven, Jersey/Grizzly — API REST + traitement des audits
│   ├── console-web/        Next.js 14 App Router — frontend public + dashboard admin
│   ├── playwright-service/ Node.js — headless browser (runtime metrics)
│   └── lighthouse-service/ Node.js — Lighthouse headless (perf/a11y scores)
└── infra/
    └── compose/            docker-compose.prod.yml par service (déployé via Traefik)
```

---

## App 1 : `api-backend` (Java 21 / Maven)

### Stack technique
- **Runtime** : Java 21, Grizzly HTTP server, Jersey (JAX-RS)
- **DI** : Guice (`@Singleton`, `@Inject`)
- **DB** : MariaDB via HikariCP + QueryDSL SQL + Flyway migrations
- **JSON** : Jackson ObjectMapper (injecté via Guice)
- **Validation** : Jakarta Bean Validation (`@Valid`, `@NotBlank`, `@Size`)
- **Build** : `mvn package` → fat JAR

### Packages principaux
| Package | Rôle |
|---|---|
| `db.generated` | Entités QueryDSL auto-générées (`Audit`, `AuditRun`, `AuditReport`, `Domain`, `DomainAnalysis`, `NewsletterSubscriber`) + classes `Q*` |
| `db.dao` | DAOs CRUD (`AuditDao`, `AuditRunDao`, `AuditReportDao`, `DomainDao`, `DomainAnalysisDao`) |
| `services.analysis` | Orchestration des modules + scoring |
| `services.analysis.modules.*` | Modules d'analyse : `http`, `html`, `runtime`, `lighthouse`, `observatory`, `ssl`, `zap`, `tech` |
| `services.analysis.scoring` | `ScorePolicyV1`, `ScoreEnricherService`, `ScoreService` |
| `services.domain.audit` | `AuditService`, `AuditRunService`, `UrlNormalizer` |
| `services.domain.report` | `PublicReportComposer`, `ReportPublishService`, `ReportReadService` |
| `services.domain.domain` | `DomainService` |
| `services.token` | `TokenService` (génération de tokens base64url + SHA-256) |
| `services.scheduler` | `SchedulerJobs` — tick toutes les `audit.scheduler.interval` (défaut : 1 min) |
| `webservices.api` | `AuditsWs`, `ReportsWs`, `NewsletterWs` |
| `webservices.internal` | `MonitoringWs`, `SwaggerWs` |

### Base URL
Le serveur Grizzly monte sur `/api` — toutes les routes JAX-RS sont donc préfixées `/api`.
- `POST /api/audits` — crée un audit
- `GET /api/audits?limit=N` — liste
- `GET /api/audits/runs/{runId}` — statut d'un run
- `GET /api/reports/{token}` — rapport public
- `GET /api/reports/{token}/status` — statut de progression (avant publication)

### Flux d'audit (async)
```
POST /api/audits
  → AuditService.createAudit()
      → UrlNormalizer.normalize()          # SSRF + scheme + longueur
      → DomainService.findOrCreate()
      → AuditRunService.createQueuedRun()  # génère reportToken + moduleStatuses PENDING
      ← CreateAuditResponse { runId, reportToken, status: QUEUED }

Scheduler (tick 1 min)
  → AuditService.processNextQueuedRun()
      → AuditRunService.claimNextQueuedRun()   # atomic claim
      → AuditProcessorService.process(runId)
          # Pour chaque module :
          → auditRunService.updateModuleStatus(runId, "http", "RUNNING")
          → httpModuleAnalyzer.analyze()
          → auditRunService.updateModuleStatus(runId, "http", "COMPLETED")
          # ... même pattern pour html, runtime, lighthouse, observatory, ssl, zap, tech
          → CheckMergerService.merge()
          → ScoreEnricherService.enrich()
          → ScoreService.compute()
          → auditRunService.complete(runId, resultJson)
          → reportPublishService.publishIfAbsent(runId, audit, report, preGeneratedToken)
```

### Entités DB importantes
| Table | Champs clés |
|---|---|
| `ARG_AUDIT` | `id`, `domain_id`, `input_url`, `normalized_url`, `created_at` |
| `ARG_AUDIT_RUN` | `id`, `audit_id`, `status` (QUEUED/RUNNING/COMPLETED/FAILED), `report_token`, `module_statuses` (JSON), `result_json`, `claim_token`, `started_at`, `finished_at` |
| `ARG_AUDIT_REPORT` | `id`, `run_id`, `public_token`, `token_hash`, `domain`, `report_json`, `expires_at` |
| `ARG_DOMAIN` | `id`, `hostname`, `created_at` |
| `ARG_DOMAIN_ANALYSIS` | `id`, `domain_id`, `tech_json`, `analyzed_at` (cache 24h) |

### Migrations Flyway
- `V1` — tables de base (Audit, AuditRun, AuditReport)
- `V2.0 / V2.1` — AuditReport
- `V3` — newsletter
- `V4` — Domain + DomainAnalysis
- `V5` — `report_token` + `module_statuses` sur ARG_AUDIT_RUN

### Scoring
- **`ScorePolicyV1`** — overrides exacts par `checkKey` puis fallback par préfixe. Chaque règle définit `scorable`, `weight`, `tags[]`.
- **`ScoreEnricherService`** — fusionne les tags du check + ceux de la policy via `mergeTags()` (LinkedHashSet, dédup). Module `runtime.*` → tag `"runtime"` uniquement (pas `"performance"`).
- **`ScoreService`** — accumule le score par tag (`byTag`). Catégories prioritaires : `performance`, `security`, `seo`, `a11y`.
- **`PublicReportComposer`** — `buildIssues()` : ignore les checks non-scorables (`scorable == false`). `pickCategoryKey()` : préfère les catégories PRIORITY_CATEGORIES.

### Sécurité (UrlNormalizer)
- Longueur max : 2048 chars
- Schémas autorisés : `http`, `https` uniquement
- Blocage SSRF : hostnames locaux (localhost, *.local, *.internal…), plages IPv4 privées (RFC-1918, loopback, link-local), IPv6 privées
- `sanitizeForLog()` : strip CRLF, tronque à 100 chars

### Configuration (`application.conf`)
```
db.dialect = MYSQL
db.hikari.dataSourceClassName = org.mariadb.jdbc.MariaDbDataSource
db.hikari."dataSource.url" = jdbc:mariadb://host/db
audit.scheduler.interval = 1m
http-grizzly.worker-threads-pool-size = 512
```
En prod, injecté via `-Dconfig.file=/config/prod.conf` (volume Docker).

### Tests Java
Situés dans `src/test/java/com/dokor/argos/`. Lancer avec `mvn test`.
Fichiers clés : `UrlNormalizerTest`, `ScoreServiceTest`, `ScorePolicyV1Test`, `PublicReportComposerTest`, `HttpModuleAnalyzerTest`, `HtmlModuleAnalyzerTest`.

---

## App 2 : `console-web` (Next.js 14 App Router)

### Stack technique
- Next.js 14, TypeScript, SCSS Modules
- `"use client"` pour les pages interactives ; layouts = toujours Server Components
- Internationalisation maison (`LangContext` + `fr.json` / `en.json`)
- shadcn/ui pour les composants UI de base

### Routes
| Route | Type | Description |
|---|---|---|
| `/` | Server | Landing page publique |
| `/report/[token]` | Server → Client | Rapport : SSR tente le fetch, si 404 → `AuditProgressView` (polling) |
| `/dashboard` | Client | Console admin (auth par cookie `ADMIN_TOKEN`) |
| `/login` | Client | Auth admin |
| `/api/audits` | Route Handler | BFF : valide l'URL (SSRF, scheme, longueur) puis proxy vers Java |
| `/api/auth/login` | Route Handler | Authentification admin |
| `/api/newsletter` | Route Handler | Inscription newsletter |

### Variables d'environnement
| Variable | Côté | Description |
|---|---|---|
| `API_BASE` | Serveur | URL interne du backend Java (ex: `http://api-backend:8081`) |
| `ADMIN_PASSWORD` | Serveur | Mot de passe admin |
| `ADMIN_TOKEN` | Serveur | Token de session admin |
| `NEXT_PUBLIC_SITE_URL` | Client | URL publique du site (ex: `https://argos.lelouet.fr`) — défaut dans le code |
| `NEXT_PUBLIC_CALENDLY_URL` | Client | URL Calendly pour le CTA |
| `NEXT_PUBLIC_APP_LOGS_ENABLED` | Client | Active les logs structurés côté client |
| `APP_LOGS_ENABLED` | Serveur | Active les logs structurés côté serveur |

### Proxy API
`next.config.ts` — rewrite `afterFiles` : `/api/:path*` → `${API_BASE}/api/:path*`.
Exception : la route `src/app/api/audits/route.ts` intercepte `POST /api/audits` avant le rewrite (validation BFF).

### Composants rapport (`src/components/report/`)
| Composant | Rôle |
|---|---|
| `ReportHero` | Score global, compteurs critiques/important/opportunités (source : `issues`), one-liner i18n |
| `PriorityCards` | Top 6 actions recommandées (source : `summary.priorities`) |
| `ScoreGrid` | Grille des scores par catégorie |
| `IssuesByCategory` | Liste filtrée des issues groupées par catégorie |
| `AuditProgressView` | Vue de progression avec polling toutes les 1,5 s + statut par module |

**Règle de cohérence des compteurs** :
- `ReportHero` compte les sévérités depuis `report.issues` (pas `priorities`) : `info` → affiché comme "Opportunités"
- `PriorityCards` utilise exclusivement `report.summary.priorities`
- Ces deux listes sont distinctes et ne doivent pas être confondues

### i18n
Clés de traduction dans `src/lib/i18n/fr.json` et `en.json` :
`layout`, `nav`, `landing`, `dashboard`, `report`, `auditForm`, `auditList`, `langToggle`

Le one-liner du rapport est retourné comme clé (`"high"` | `"good"` | `"fair"` | `"low"`) par le backend et traduit côté frontend via `t.report.hero.oneLiner[key]`.

### SEO / Indexabilité
- `src/app/robots.ts` — crawl autorisé sur `/`, bloqué sur `/dashboard/`, `/login/`, `/api/`, `/report/`
- `src/app/sitemap.ts` — homepage uniquement, changeFrequency weekly
- `src/app/layout.tsx` — métadonnées OG complètes, JSON-LD `WebApplication`, `manifest.json`
- `/login` et `/dashboard` ont des `layout.tsx` segment avec `robots: { index: false }` (les pages `"use client"` ne peuvent pas exporter `metadata`)
- `public/og.png` — image OG 1200×630 générée avec Pillow (script `outputs/gen_og.py`)
- `public/llms.txt` — description pour les crawlers IA

---

## Apps 3 & 4 : services headless

### `playwright-service`
- Node.js, écoute sur le port 3016
- Appelé par `PlaywrightRuntimeClient.java` (module `runtime`)
- Collecte : erreurs console, requêtes échouées, LCP, FCP, TTI, poids page, screenshots

### `lighthouse-service`
- Node.js, écoute sur le port 3017
- Appelé par `LighthouseClient.java` (module `lighthouse`)
- Retourne les scores Lighthouse : performance, accessibilité, best-practices, SEO

---

## Infrastructure (prod)

- **Reverse proxy** : Traefik avec TLS Let's Encrypt
- **Domaine** : `argos.lelouet.fr`
- **Routage Traefik** :
  - `Host(argos.lelouet.fr) && PathPrefix(/api)` priorité 100 → `api-backend:8081`
  - `Host(argos.lelouet.fr)` priorité 10 → `console-web:3000`
  - `/api` depuis le frontend (BFF) priorité 200 → `console-web:3000` (le BFF re-proxie vers Java)
- **Réseau interne Docker** : `argos_internal` (console-web → playwright/lighthouse)
- **Base de données** : MariaDB sur réseau `mariadb-public`
- **Config sensible** : injectée via fichiers montés en volume (`/srv/configs/`)

---

## Conventions de développement

### Nommage Java
- Classes de service : `XxxService` (logique métier), `XxxDao` (accès DB), `XxxWs` (endpoint REST)
- Entités QueryDSL générées : ne pas modifier manuellement sauf pour ajouter des champs après migration Flyway
- Après toute migration SQL : mettre à jour manuellement l'entité et la classe `Q*` correspondante (pas de regénération automatique en place)

### Frontend
- Pas de `metadata` dans les pages `"use client"` → utiliser un `layout.tsx` de segment
- Ne jamais utiliser `localStorage` (non supporté dans l'environnement de rendu)
- Les rewrites `afterFiles` sont contournés par les Route Handlers Next.js — utiliser un Route Handler pour intercepter avant proxy

### Sécurité
- Toute URL soumise par l'utilisateur passe par la validation SSRF du BFF **et** du backend Java
- Les tokens de rapport sont générés à la création du run (pré-génération) — ne pas les régénérer à la publication
- Les logs ne doivent jamais contenir d'URLs brutes non sanitisées (utiliser `sanitizeForLog` / `sanitizeUrl`)

### Tests Java
- Lancer : `mvn test` depuis `apps/api-backend/`
- Ajouter les tests dans `src/test/java/com/dokor/argos/`

### Build & déploiement
- Backend : `mvn package` → `target/api-backend-*.jar`
- Frontend : `npm run build` depuis `apps/console-web/`
- Déploiement : `docker compose -f infra/compose/<service>/docker-compose.prod.yml up -d --build`
