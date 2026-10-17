# Argos

Argos analyse une URL publique et produit un rapport scoré avec des priorités de correction. Un audit peut être lancé sans compte ; l'espace connecté donne accès aux détails, à l'historique et au partage des rapports.

Le délai dépend de la file d'attente et des services d'analyse. La progression se met à jour jusqu'à la publication du rapport ; une collecte indisponible reste signalée dans sa couverture. Voir les [règles d'accès](docs/report/unified-reports.md) et les [promesses publiques](docs/product/public-content.md).

Les mesures produit et d'audience sont optionnelles, désactivées par défaut et soumises au consentement. Leurs finalités et limites sont décrites dans l'[inventaire de confidentialité](docs/product/privacy-inventory.md).

---

## Ce qu'Argos analyse

Huit modules indépendants s'exécutent sur chaque audit :

| Module | Ce qui est vérifié |
|---|---|
| **HTTP & Sécurité** | Status code, redirections, HTTPS, HSTS, CSP, X-Frame-Options, Referrer-Policy, compression |
| **HTML & SEO** | Title, meta description, canonical, H1, lang, viewport, OpenGraph, Twitter Card, alt images |
| **Runtime Playwright** | Page rendue en navigateur headless : LCP, FCP, TTI, console errors, ressources bloquantes |
| **Lighthouse** | Scores de performance, accessibilité, bonnes pratiques et SEO via Lighthouse headless |
| **Mozilla Observatory** | Score de sécurité HTTP Mozilla Observatory + détail des en-têtes/politiques en échec (CSP, HSTS, X-Content-Type-Options…) |
| **SSL / TLS** | Configuration TLS via SSL Labs : protocoles supportés, certificat, qualité de la chaîne |
| **OWASP ZAP** | Analyse de vulnérabilités OWASP ZAP (déduplication et filtrage des faux positifs) |
| **Stack technique** | CMS (WordPress, Shopify…), frameworks (Next.js, Nuxt, React, Vue…), CDN Cloudflare — mis en cache par domaine |

Chaque point détecté est pondéré, priorisé par niveau de sévérité (critique / important / info) et accompagné d'une recommandation concrète.

---

## Architecture

Monorepo avec 4 applications indépendantes :

```
apps/
├── api-backend/          # API REST Java - orchestration des audits, scoring, rapports
├── console-web/          # Frontend Next.js - landing page + console privée
├── lighthouse-service/   # Microservice Node.js - analyses Lighthouse
└── playwright-service/   # Microservice Node.js - métriques runtime navigateur
```

### api-backend
- Java 21 avec [Plume](https://github.com/Coreoz/Plume) (Guice + Grizzly + Jersey + QueryDSL)
- MariaDB (via HikariCP + migrations Flyway)
- Pipeline de huit modules après la barrière HTTP, séquentiel par défaut ; une concurrence bornée peut être configurée pour les collecteurs distants, les navigateurs restant séquentiels (voir [progression](docs/analysis/progress.md))
- Scores par domaine (performance, sécurité, SEO, accessibilité), score global et couverture des mesures
- Génération des rapports accessibles via token unique (non indexable)
- Synthèse exécutive optionnelle générée par Codex à partir des résultats Argos normalisés

### console-web
- Next.js 16 (App Router), TypeScript, React 19
- Site public FR/EN, lecteur de rapport commun, espace connecté et administration par rôle
- SCSS modules avec tokens partagés (`src/styles/_tokens.scss`)
- i18n FR / EN via context React

### lighthouse-service / playwright-service
- Microservices Node.js exposant une API HTTP
- Appelés par `api-backend` pendant l'analyse

---

## Démarrage rapide

### Prérequis
- Java 21+, Maven 3.9+
- Node.js 24 (même version majeure que la CI et les Dockerfiles)
- MariaDB
- Docker (optionnel)

### Backend

```bash
cd apps/api-backend
# Préparer local.conf, DB_PASSWORD et INTERNAL_API_PASSWORD selon le guide backend
mvn package
java -Dconfig.file=local.conf -cp "target/dist/api-backend/lib/*" com.dokor.argos.WebApplication
# → http://localhost:8081
```

### Services Node.js

```bash
# Depuis la racine, dans deux terminaux distincts :
cd apps/lighthouse-service && npm ci && npm start
cd apps/playwright-service && npm ci && npx playwright install chromium && npm start
```

### Frontend

```bash
cd apps/console-web
npm ci
cp .env.example .env.local
npm run dev
# → http://localhost:3000
```

Sous PowerShell, utiliser `Copy-Item .env.example .env.local`.
Configuration détaillée : [backend](apps/api-backend/README.md),
[frontend](apps/console-web/README.md), [index documentaire](docs/README.md).
Lighthouse nécessite Chrome/Chromium installé et `CHROME_PATH` si la détection
automatique ne le trouve pas. Les Dockerfiles des collecteurs installent les
navigateurs et dépendances système nécessaires.

---

## Documentation

Le [sommaire de docs](docs/README.md) relie les contrats, procédures de test,
décisions produit et références d’exploitation.

## Déploiement

Chaque application dispose de son propre workflow GitHub Actions (`/.github/workflows/`) et d'un `Dockerfile`.

---

## Licence

Argos est distribué sous **[Business Source License 1.1](./LICENSE)** (BSL 1.1) - une licence *source-available* : le code est public, lisible, auditable et modifiable, mais son exploitation commerciale est encadrée.

- ✅ **Autorisé** : lecture, audit, modification, contribution, usage non-production (dev, test, évaluation) et usage en production **hors** offre concurrente.
- 🚫 **Restreint** : proposer à des tiers un service hébergé/managé d'audit de site web substantiellement similaire à Argos (voir *Additional Use Grant* du fichier `LICENSE`).
- ⏳ **Bascule open source** : chaque version passe automatiquement sous **Apache-2.0** à sa *Change Date* (**2030-07-03**), soit au plus tard 4 ans après sa publication.

Copyright © 2026 [Antoine LE LOUËT](https://github.com/antoinelelouet). Pour un usage commercial hors périmètre, ou une licence alternative, contactez le titulaire.

Voir [`CONTRIBUTING.md`](./CONTRIBUTING.md) pour les règles de contribution et de redistribution.


## Runtime Codex partagé

Argos utilise le runtime Docker Codex commun du homelab pour la synthèse des rapports :

```text
ghcr.io/dokor/codex-runtime:0.156.1-r1
```

Le service Codex reste isolé du backend et des sources. Docker peut réutiliser la même couche que le worker ADE et le bridge n8n, sans partager leurs processus ni leurs workspaces.
