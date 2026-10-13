# Inventaire à la préparation

Référence : branche distante principale au commit
`040047c923d16c967c892e1a9a156522a535d1f8`, consultée le 13 octobre 2026.
Les changements locaux non commités du checkout utilisateur ne sont pas inclus.
L’état des issues GitHub ne prouve pas à lui seul la livraison du code.

Les chemins ci-dessous sont relatifs à la racine du dépôt. Refaire un court
inventaire avant chaque lot si `main` a avancé.

| Domaine | Preuve dans le dépôt | Décision |
|---|---|---|
| Frontend | `apps/console-web/package.json`, App Router, React, SCSS Modules | Rester sur les dépendances du lockfile ; le résumé AGENTS « Next 14 » est historique |
| Design | `src/styles/_tokens.scss`, `_controls.scss`, `src/app/globals.css` sous console-web | Adapter avec des tokens connectés ciblés ; ne pas restyler le site public globalement |
| Sessions | `services/account/AccountSessionService.java`, `AccountAuthService.java`, `AccountOAuthService.java` | Conserver contrôles, révocation, CSRF, Argon2 et OAuth ; nouvelle composition UI |
| Compte | `components/account/AccountView.tsx`, `AccountSession.tsx`, `lib/account-proxy.ts` | Refactoriser en pages dédiées et garder le BFF en liste blanche |
| Sites privés | `AccountSitesService.java`, `SitesView.tsx`, `docs/accounts/sites-contract.md` | Réutiliser propriété et projections ; un « site » suivi n’est pas une preuve de propriété DNS |
| Historique / rapport | `HistoryView.tsx`, `PersonalReport.tsx`, `AuditComparison.tsx`, `components/report/*` | Un lecteur de rapport commun ; liens contextualisés depuis une URL ou un lot |
| Quotas | `UsageService.java`, `UsagePolicy.java`, `UsagePanel.tsx`, migrations V14/V15 | Réutiliser verrou par compte et registre par run ; étendre admission atomique au lot |
| Administration | `AdminService.java`, `AdminWs.java`, `components/admin/*` | Liste/fiches et entitlement déjà présents ; suspension est un nouveau flux à réaliser |
| Domaine technique actuel | `services/analysis/DomainAnalysisService.java` | Cache de technologies, pas crawler ni lot multi-pages ; ne pas confondre avec le nouveau modèle |
| Scoring / couverture | `docs/scoring/measurement-coverage.md`, `docs/scoring/audit-comparison.md` | Préserver la méthode figée et les conditions de comparabilité ; ne pas simplifier depuis la maquette |
| Preuves | Issue #538 et collecte Lighthouse/Runtime | Étendre la donnée réelle, pas inventer depuis une valeur numérique |
| Tests | Vitest, tests Java, suites MariaDB et `scripts/e2e/*` | Étendre les suites actuelles, ne pas remplacer le moteur par des mocks pour prouver la concurrence |
| Livraison | `.github/workflows/ci.yml`, `mariadb-integration.yml`, `controlled-e2e.yml` | Ajouter les chemins/documents/scripts de recette aux gates réellement concernés |

## Différences à traiter explicitement

- Ancien contrat admin : baisse sous usage admise. Cible D-11 : refus explicite.
- Ancien journal : pas de texte libre. Cible : conserver cette propriété avec `reasonCode`.
- Offre et rôle sont déjà indépendants : aucune offre premium ne doit accorder ADMIN.
- Quota actuel : mois calendaire de publication, fuseau configurable, réservations
  traversant les mois. Conserver ces règles ; ne pas coder un reset destructif.
- Les scores peuvent être provisoires même lorsque tous les modules sont terminés.
  « 8/8 modules » ne remplace pas la couverture pondérée du rapport.
- Le retrait de l’ancien accès admin est déjà décrit par #516 et
  `docs/accounts/legacy-admin-transition.md`. Le nouveau choix utilisateur retire
  l’exigence de coexistence de l’espace connecté, pas les contrôles d’accès ni
  l’identification des consommateurs serveur d’`ADMIN_API_TOKEN`.

## Backlog existant

Réutiliser #10 (découverte), #12 (lots), #538 (preuves), #516 (retrait legacy).
Coordonner les contrats avec #444/#8 (auth) et #488 (sécurité URL) sans dupliquer
leur périmètre. #55 (CSV), #28/#29 (API/CI), #470 (équipes), #530 (bilans clients)
restent hors de cette refonte. Voir le manifeste des issues dans le plan.
