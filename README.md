# Argos

Argos analyse n'importe quel site web et produit un rapport scoré, privé et actionnable - sans compte, sans tracking.

Soumettez une URL, attendez ~20 secondes, récupérez un rapport complet avec un score global (0-100), des priorités triées par impact, et des recommandations concrètes.

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
- Orchestration du pipeline d'analyse : HTTP → HTML → Runtime → Lighthouse → Observatory → SSL → ZAP (+ détection de stack technique mise en cache par domaine)
- Calcul du score par module et score global
- Génération des rapports accessibles via token unique (non indexable)

### console-web
- Next.js 16 (App Router), TypeScript, React 19
- Landing page publique + console privée (dashboard + vue rapport)
- SCSS modules avec tokens partagés (`src/styles/_tokens.scss`)
- i18n FR / EN via context React

### lighthouse-service / playwright-service
- Microservices Node.js exposant une API HTTP
- Appelés par `api-backend` pendant l'analyse

---

## Démarrage rapide

### Prérequis
- Java 21+, Maven 3.9+
- Node.js 20+
- MariaDB
- Docker (optionnel)

### Backend

```bash
cd apps/api-backend
# Configurer src/main/resources/application.conf
mvn package
java -cp "target/dist/api-backend/lib/*" com.dokor.argos.WebApplication
# → http://localhost:8081
```

### Services Node.js

```bash
cd apps/lighthouse-service && npm install && node server.mjs
cd apps/playwright-service && npm install && node server.mjs
```

### Frontend

```bash
cd apps/console-web
npm install
npm run dev
# → http://localhost:3000
```

---

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
