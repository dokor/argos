# Argos - Instructions pour agents IA

Argos est un outil d'audit de site web : l'utilisateur soumet une URL, huit modules d'analyse produisent un rapport scoré accessible par un lien privé. Le délai dépend des services distants. Voir les contrats actifs dans [docs/README.md](docs/README.md) et l'[inventaire de maintenance](docs/maintenance.md).

---

## Structure du monorepo

```
argos/
├── apps/
│   ├── api-backend/        Java 21, Maven, Jersey/Grizzly - API REST + traitement des audits
│   ├── console-web/        Next.js App Router - frontend public + comptes et administration
│   ├── playwright-service/ Node.js - headless browser (runtime metrics)
│   └── lighthouse-service/ Node.js - Lighthouse headless (perf/a11y scores)
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
- **Build** : `mvn package` → JAR et dépendances dans `target/dist/api-backend/lib`

### Packages principaux
| Package | Rôle |
|---|---|
| `db.generated` | Entités QueryDSL auto-générées (`Audit`, `AuditRun`, `AuditReport`, `Domain`, `DomainAnalysis`, `NewsletterSubscriber`) + classes `Q*` |
| `db.dao` | DAOs CRUD (`AuditDao`, `AuditRunDao`, `AuditReportDao`, `DomainDao`, `DomainAnalysisDao`) |
| `services.analysis` | Orchestration des modules + scoring |
| `services.analysis.modules.*` | Modules d'analyse : `http`, `html`, `runtime`, `lighthouse`, `observatory`, `ssl`, `zap`, `tech` |
| `services.analysis.scoring` | `DefaultScorePolicy`, `ScoreEnricherService`, `ScoreService` |
| `services.domain.audit` | `AuditService`, `AuditRunService`, `UrlNormalizer` |
| `services.domain.report` | `PublicReportComposer`, `ReportPublishService`, `ReportReadService` |
| `services.domain.domain` | `DomainService` |
| `services.token` | `TokenService` (génération de tokens base64url + SHA-256) |
| `services.scheduler` | `SchedulerJobs` - délai `audit.scheduler.interval` après traitement (défaut : 5 s) |
| `webservices.api` | `AuditsWs`, `ReportsWs`, `NewsletterWs` |
| `webservices.internal` | `MonitoringWs`, `SwaggerWs` |

### Base URL
Le serveur Grizzly monte sur `/api` - toutes les routes JAX-RS sont donc préfixées `/api`.
- `POST /api/audits` - crée un audit
- `GET /api/audits?limit=N` - liste
- `GET /api/audits/runs/{runId}` - statut d'un run
- `GET /api/reports/{token}` - rapport public
- `GET /api/reports/{token}/status` - statut de progression (avant publication)

### Flux, données et scoring

- Le scheduler réclame un run atomiquement, puis AuditProcessorService orchestre huit modules après la barrière HTTP. Le défaut est séquentiel ; `audit.execution.max-concurrent-modules` (1..3) permet de faire chevaucher SSL Labs/Observatory avec le worker local après mesure de capacité. Les navigateurs restent séquentiels. Voir [progression](docs/analysis/progress.md) et [budget global](docs/analysis/deadline.md).
- La publication et la transition COMPLETED suivent le [contrat de publication atomique](docs/security/audit-publication.md). Ne pas les remplacer par deux écritures indépendantes.
- Le lien du rapport est pré-généré à la création du run. Depuis V7, seules les empreintes sont stockées (report_token_hash sur ARG_AUDIT_RUN, token_hash sur ARG_AUDIT_REPORT). Voir [credentials](docs/security/report-credentials.md). Ne pas réintroduire report_token/public_token en clair ni régénérer le lien à la publication.
- Le schéma courant est défini par toutes les migrations dans apps/api-backend/src/main/resources/db/migration et les classes db.generated ; conserver les migrations historiques, y compris les anciennes colonnes qu'elles décrivent.
- DefaultScorePolicy est liée à ScorePolicy dans ApplicationModule. Le catalogue exact distingue domaine métier et provenance technique ; ScoreService normalise les domaines mesurables avant le global. Les anciens ScorePolicyV1…V8 ont été consolidés : ne pas les recréer.
- PublicReportComposer et ses collaborateurs produisent un rapport avec catégories métier, couverture et priorités. Respecter les contrats [score](docs/scoring/domain-calibration.md), [couverture](docs/scoring/measurement-coverage.md) et [modèle de lecture](docs/report/read-model.md).

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
audit.scheduler.interval = 5s
http-grizzly.worker-threads-pool-size = 24
```
En prod, injecté via `-Dconfig.file=/config/prod.conf` (volume Docker).

### Tests Java
Situés dans `src/test/java/com/dokor/argos/`. Lancer avec `mvn test`.
Fichiers clés : `UrlNormalizerTest`, `ScoreServiceTest`, `DefaultScorePolicyTest`, `PublicReportComposerTest`, `HttpModuleAnalyzerTest`, `HtmlModuleAnalyzerTest`.

---

## App 2 : `console-web` (Next.js App Router)

### Stack technique
- Next.js 16, React 19, TypeScript, **SCSS Modules** (versions exactes dans `package.json`)
- `"use client"` pour les pages interactives ; layouts = toujours Server Components
- Internationalisation maison (`LangContext` + `fr.json` / `en.json`)
- Styles : **SCSS Modules uniquement** - Tailwind et shadcn/ui ont été retirés (issue #124).
  Couleurs via les tokens sémantiques `--argos-*` (théma-aware) de `globals.css` + `_tokens.scss`.
  Ne pas réintroduire de classes utilitaires Tailwind ni de dépendance shadcn/Radix.

### Routes
| Route | Type | Description |
|---|---|---|
| `/` | Server | Landing page publique |
| `/report/[token]` | Server → Client | Rapport : SSR tente le fetch, si 404 → `AuditProgressView` (polling) |
| `/account/admin` | Client | Administration avec session de compte ACTIVE ADMIN |
| `/account/admin/analytics` | Client | Mesure produit sous session ACTIVE ADMIN |
| `/account/sign-in` | Client | Connexion au compte |
| `/api/audits` | Route Handler | BFF : valide l'URL (SSRF, scheme, longueur) puis proxy vers Java |
| `/api/account/*` | Route Handler | BFF des comptes et de l’administration |
| `/api/newsletter` | Route Handler | Inscription newsletter |

### Variables d'environnement
| Variable | Côté | Description |
|---|---|---|
| `API_BASE` | Serveur | URL interne du backend Java (ex: `http://api-backend:8081`) |
| `NEXT_PUBLIC_SITE_URL` | Client | URL publique du site (ex: `https://argos.lelouet.fr`) - défaut dans le code |
| `NEXT_PUBLIC_CALENDLY_URL` | Client | URL Calendly pour le CTA |
| `NEXT_PUBLIC_APP_LOGS_ENABLED` | Client | Active les logs structurés côté client |
| `APP_LOGS_ENABLED` | Serveur | Active les logs structurés côté serveur |

### Proxy API
`next.config.ts` - rewrite `fallback` : `/api/:path*` → `${API_BASE}/api/:path*`.
Les Route Handlers BFF, y compris les routes dynamiques des comptes/admin, sont résolus avant ce proxy. Ne pas revenir à `afterFiles`, qui contournerait ces routes dynamiques.

### Architecture SSR / BFF (issue #136)
- **Aucun appel navigateur → service externe en direct.** Le navigateur n'appelle que des chemins **same-origin `/api/*`**, résolus côté serveur :
  - **Route handlers** (`src/app/api/*`) pour les flux avec validation/secrets : `POST/GET /api/audits` (SSRF + longueur), `POST /api/newsletter`, les mutations de compte.
  - **Rewrite proxy** pour les lectures restantes (`/api/reports/*`, `/api/audits/runs/*`, `/api/audits/*/history`).
- `API_BASE` (URL interne du backend Java) est **exclusivement serveur** — jamais exposée au client. `argosApi.http()` (`src/lib/ArgosApi.ts`) utilise l'URL absolue en SSR et un chemin relatif côté client (proxifié).
- **Frontière client/serveur** : la plupart des composants sont `"use client"` **parce que l'i18n (`LangContext`) et le thème (`ThemeContext`) sont des contextes client**, en plus de l'interactivité. Réduire davantage l'hydratation des contenus statiques suppose une **i18n résolue côté serveur** (chantier séparé). Les composants purs sans hook/événement ne portent pas la directive (ex. `ArgosIcon`).

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
`layout`, `nav`, `landing`, `report`, `auditForm`, `account`, `langToggle`

Le one-liner du rapport est retourné comme clé (`"high"` | `"good"` | `"fair"` | `"low"`) par le backend et traduit côté frontend via `t.report.hero.oneLiner[key]`.

### SEO / Indexabilité
- `src/app/robots.ts` - crawl autorisé sur `/`, API bloquée ; comptes et rapports portent noindex
- `src/app/sitemap.ts` - homepage uniquement, changeFrequency weekly
- `src/app/layout.tsx` - métadonnées OG complètes, JSON-LD `WebApplication`, `manifest.json`
- Les segments `/account` et `/en/account` ont des `layout.tsx` avec `robots: { index: false }` (les pages `"use client"` ne peuvent pas exporter `metadata`)
- `public/og.png` - image OG 1200×630 générée avec Pillow (script `outputs/gen_og.py`)
- `public/llms.txt` - description pour les crawlers IA

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

### Livraison dans une pull request
- Toute modification de code Argos doit être livrée dans une PR : créer une branche dédiée ou mettre à jour la PR pertinente, exécuter les vérifications adaptées, pousser les changements et ouvrir la PR avant de considérer le travail terminé.
- Fournir le lien de la PR dans la réponse finale. La création ou la mise à jour de la PR est autorisée pour les changements demandés ; sa fusion et le déploiement nécessitent une demande explicite.
- Si l'accès distant empêche la création de la PR, conserver les changements et signaler précisément le blocage.

### Nommage Java
- Classes de service : `XxxService` (logique métier), `XxxDao` (accès DB), `XxxWs` (endpoint REST)
- Entités QueryDSL générées : ne pas modifier manuellement sauf pour ajouter des champs après migration Flyway
- Après toute migration SQL : mettre à jour manuellement l'entité et la classe `Q*` correspondante (pas de regénération automatique en place)

### Frontend
- Pas de `metadata` dans les pages `"use client"` → utiliser un `layout.tsx` de segment
- Ne jamais utiliser `localStorage` (non supporté dans l'environnement de rendu)
- Garder le proxy en `fallback` afin que les Route Handlers BFF statiques et dynamiques interceptent les requêtes avant Java

### Accessibilité (a11y)
- Tout champ de saisie doit avoir un **nom accessible** : `<label htmlFor>` visible, ou à défaut `aria-label` (un `placeholder` ne suffit pas).
- Tout élément interactif **icône seule** (bouton/lien sans texte) doit porter un `aria-label`.
- Les icônes/décorations purement visuelles portent `aria-hidden="true"`.
- Les images de contenu ont un `alt` pertinent ; `alt=""` pour les images décoratives.
- Ne pas retirer l'outline de focus sans fournir un style de focus visible équivalent (navigation clavier).
- Respecter la hiérarchie des titres (un seul `<h1>` par page, pas de saut de niveau).
- Viser un contraste texte/fond suffisant (WCAG AA) - attention aux gris clairs sur blanc.

### Sécurité
- Toute URL soumise par l'utilisateur passe par la validation SSRF du BFF **et** du backend Java
- Les tokens de rapport sont générés à la création du run (pré-génération) - ne pas les régénérer à la publication
- Les logs ne doivent jamais contenir d'URLs brutes non sanitisées (utiliser `sanitizeForLog` / `sanitizeUrl`)

### Tests Java
- Lancer : `mvn test` depuis `apps/api-backend/`
- Ajouter les tests dans `src/test/java/com/dokor/argos/`

### Build & déploiement
- Backend : `mvn package` → `target/dist/api-backend/lib/*` (JAR et dépendances)
- Frontend : `npm run build` depuis `apps/console-web/`
- Déploiement : `docker compose -f infra/compose/<service>/docker-compose.prod.yml up -d --build`
