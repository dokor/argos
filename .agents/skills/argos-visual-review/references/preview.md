# Aperçu local pour la revue Argos

Lire les instructions du dépôt et des outils de navigateur disponibles. Lancer le frontend local depuis `apps/console-web`. Préserver les changements existants. Utiliser un rapport de test contrôlé ou une fixture locale pour inspecter les rapports privés ; ne pas afficher de données utilisateur dans une capture partageable.

Le [serveur local de preview](../scripts/preview-backend.mjs) fournit uniquement des fixtures fictives en lecture. Démarrer avec `node .agents/skills/argos-visual-review/scripts/preview-backend.mjs`, puis lancer Next avec `API_BASE=http://127.0.0.1:3018` dans l’environnement du processus (PowerShell : `$env:API_BASE='http://127.0.0.1:3018'`). Pour une revue du build de production, fournir aussi cette variable à `npm run build`, car les rewrites sont résolus au build, puis à `npm run start`. Ce serveur écoute exclusivement sur loopback et refuse toute écriture. Il ne doit jamais être déployé. Parcours : `/report/review-complete-fixture`, `/report/review-partial-fixture`, `/report/review-unavailable-fixture`, `/report/review-empty-fixture`, `/report/review-running-fixture`, `/report/review-finalizing-fixture`, `/report/review-failed-fixture`, `/report/review-missing-fixture`, `/report/review-details-fixture` (panneau de qualification fictif), ainsi que leurs variantes `/en/report/…`.

Les fixtures comprennent aussi `/account/admin`, les utilisateurs et leur fiche, les analyses et leur détail, le journal, ainsi que `/account/admin/feedback`. Le profil administrateur retourné par le backend de démonstration est fictif ; cela ne vérifie pas les autorisations de production. Pour la console historique `/dashboard`, lancer Next avec des valeurs temporaires locales pour `ADMIN_PASSWORD`, `ADMIN_TOKEN` et `ADMIN_API_TOKEN`, puis se connecter normalement dans `/login`. Ne jamais enregistrer des identifiants réels dans ces fixtures. Examiner filtres, absence de résultat, chargement, erreurs, détails longs, tableaux confinés, focus après fermeture, pagination et accès au rapport. Les modifications d’offres et de retours sont couvertes par les tests de composants, pas par des écritures dans les données de production.

## Outils et cycle de vie

Le script est relatif à la racine du dépôt ; lancer Next depuis `apps/console-web/`. Vérifier la disponibilité des ports avant le démarrage. Si un service occupe un port, identifier son usage avant de le réutiliser ; ne pas arrêter un processus inconnu. Noter les sessions ou PID créés et leur commande d'arrêt. Arrêter uniquement les services lancés pour cette revue, sauf demande de les conserver.

Les routes fictives permettent d'examiner des états, pas de valider l'orchestration réelle d'un audit ni un parcours d'écriture. Les fixtures `review-running-fixture` et `review-finalizing-fixture` restent en progression ; ne pas attendre leur publication comme dans un E2E réel. Inspecter le script si le contrat courant d'une page dépasse les données proposées, puis compléter uniquement les fixtures nécessaires.

## Vérifications existantes

Avant de lancer un E2E, lire son runbook : les backends contrôlés des suites ci-dessous ne sont pas interchangeables avec le serveur en lecture seule de ce skill.

| Zone affectée | Runbook et point d'entrée |
|---|---|
| Navigation publique | [public-header.md](../../../../docs/testing/public-header.md), `scripts/e2e/public-header.mjs` |
| Historique et comptes | [accounts.md](../../../../docs/testing/accounts.md), `scripts/e2e/account-history.mjs` |
| Rapport et PDF | [report.md](../../../../docs/testing/report.md), `scripts/e2e/report-pdf.mjs` |
| Audit complet | [controlled-e2e.md](../../../../docs/testing/controlled-e2e.md), `scripts/e2e/browser.mjs` |

Consulter `apps/console-web/package.json` pour les commandes courantes de tests, lint et build. Choisir les tests de composants proches du comportement modifié, sans installer un second outillage navigateur à cause d'une recette communautaire.
