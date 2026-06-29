# Argos

Argos analyse n'importe quel site web et produit un rapport scoré, privé et actionnable — sans compte, sans tracking.

Soumettez une URL, attendez ~20 secondes, récupérez un rapport complet avec un score global (0–100), des priorités triées par impact, et des recommandations concrètes.

---

## Ce qu'Argos analyse

Cinq modules indépendants s'exécutent en séquence sur chaque audit :

| Module | Ce qui est vérifié |
|---|---|
| **HTTP & Sécurité** | Status code, redirections, HTTPS, HSTS, CSP, X-Frame-Options, Referrer-Policy, compression |
| **HTML & SEO** | Title, meta description, canonical, H1, lang, viewport, OpenGraph, Twitter Card, alt images |
| **Stack technique** | CMS (WordPress, Shopify…), frameworks (Next.js, Nuxt, React, Vue…), CDN Cloudflare |
| **Runtime Playwright** | Page rendue en navigateur headless : LCP, FCP, TTI, console errors, ressources bloquantes |
| **Lighthouse** | Scores de performance, accessibilité, bonnes pratiques et SEO via Lighthouse headless |

Chaque point détecté est pondéré, priorisé par niveau de sévérité (critique / important / info) et accompagné d'une recommandation concrète.

---

## Architecture

Monorepo avec 4 applications indépendantes :

```
apps/
├── api-backend/          # API REST Java — orchestration des audits, scoring, rapports
├── console-web/          # Frontend Next.js — landing page + console privée
├── lighthouse-service/   # Microservice Node.js — analyses Lighthouse
└── playwright-service/   # Microservice Node.js — métriques runtime navigateur
```

### api-backend
- Java avec [Plume](https://github.com/Coreoz/Plume) (Guice + Grizzly + Jersey + QueryDSL)
- PostgreSQL
- Orchestration du pipeline d'analyse : HTTP → HTML → Tech → Runtime → Lighthouse
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
- PostgreSQL
- Docker (optionnel)

### Backend

```bash
cd apps/api-backend
# Configurer src/main/resources/application.conf
mvn package
java -cp "target/dist/api-backend/lib/*" com.dokar.argos.WebApplication
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

MIT — fait par [Antoine LE LOUËT](https://github.com/antoinelelouet).
