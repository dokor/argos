# Console web Argos

Frontend Next.js App Router, React et TypeScript. Les versions installées sont
définies dans `package.json` et `package-lock.json` ; utiliser Node.js 24 comme la
CI et le Dockerfile. Les styles sont des SCSS Modules avec tokens `--argos-*`.

## Démarrage local

Depuis ce dossier :

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Sous PowerShell, remplacer `cp` par `Copy-Item`. Ouvrir `http://localhost:3000`.
Le [backend Java](../api-backend/README.md) doit être lancé sur le port 8081 pour
les audits ; les pages publiques restent consultables sans lui.

## Configuration

L'exemple `.env.example` ne contient aucun secret. `.env.local` reste ignoré.

| Variable | Usage |
| --- | --- |
| `API_BASE` | Origine Java, exclusivement serveur, sans suffixe `/api`. En local : `http://localhost:8081` ; défaut Docker : `http://api-backend:8081`. |
| `ACCOUNT_ORIGIN` | Origine exacte autorisée par le BFF pour les comptes, identique à celle configurée dans Java. |
| `NEXT_PUBLIC_SITE_URL` | Origine publique pour les métadonnées et liens. Les variables `NEXT_PUBLIC_*` sont intégrées au build client. |
| `ADMIN_API_TOKEN` | Credential serveur pour les lectures admin historiques et la collecte analytics ; même valeur côté Java, jamais envoyée au navigateur. |
| `PRODUCT_ANALYTICS_ENABLED` | Collecte optionnelle ; nécessite aussi la configuration Java et le consentement. Voir le [contrat](../../docs/product/product-analytics.md). |
| `NEXT_PUBLIC_CALENDLY_URL` | Destination optionnelle du CTA rapport ; repli sur le contact public. |
| `APP_LOGS_ENABLED`, `NEXT_PUBLIC_APP_LOGS_ENABLED` | Journaux serveur et client ; ne jamais y inclure de secret ou d'URL brute. |

Les comptes et l'administration par rôles utilisent des sessions distinctes du
login historique. Voir [configuration et recette](../../docs/accounts/operations.md)
avant de les activer ; ne pas retirer les anciennes routes tant que leur migration
n'est pas réalisée.

## Structure et contrats

- `src/app/(fr)` et `src/app/en` : routes publiques localisées, rapport et espaces privés.
- `src/app/api` : BFF, validation des entrées et forwarding des credentials serveur.
- `src/components/report` : affichage du rapport et compatibilité des rapports historiques.
- `src/lib/i18n` : traductions FR/EN et résolution des routes.
- `next.config.ts` : headers, redirections et proxy **fallback** vers Java, après
  les Route Handlers dynamiques des comptes et de l'administration.

Le navigateur appelle uniquement `/api/*` sur la même origine. `API_BASE` ne doit
jamais devenir une variable publique. Conserver la validation SSRF dans le BFF
et dans Java. Aucun `localStorage`, Tailwind ou shadcn/Radix.

## Vérifications

```sh
npm run lint
npm test
npm run build
```

Le build produit `.next` ; `npm start` le sert en production. Les tests DOM sont
exécutés par Vitest ; la [recette navigateur](../../docs/testing/controlled-e2e.md)
est distincte. Pour contribuer, suivre le [guide racine](../../CONTRIBUTING.md).
Le déploiement existant est Docker/Traefik : voir le [runbook](../../infra/RUNBOOK.md).
