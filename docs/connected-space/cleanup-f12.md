# F12 — Retrait de l’ancien espace connecté (#516)

Exigences : ARC-05, QA-15, QA-16. Base d’inventaire : F11, commit `91f4485`.
Ce lot ne réinitialise aucune base, ne fusionne aucune PR et ne déploie rien.

## Inventaire et décision

| Élément | État avant F12 | Action |
|---|---|---|
| Dashboard/login mono-admin, middleware, admin-read-proxy, `/api/auth/*` | Déjà retirés avant Clarté | Ne pas recréer une seconde authentification |
| `ADMIN_PASSWORD`, `ADMIN_TOKEN`, cookie `argos_admin` | Aucun accès actif ; tests négatifs conservés | Restent absents du runtime ; cookie ignoré |
| Redirections `/dashboard`, `/dashboard/analytics`, `/dashboard/report/:id`, `/login` | Compatibilité encore dans Next | Retirées ; 404, également sous `/en`, aucun alias |
| Liens renvoyés par les lectures opérateur Java | Ancien `/dashboard/report/` | `/account/admin/runs/` ; une session ACTIVE ADMIN reste nécessaire dans le navigateur |
| `AuditForm`/`useAuditSubmit` mode personnel | Aucun consommateur produit depuis F03 ; ancien parcours encore testé | Retiré ; `ConnectedAnalysisForm` utilise `/api/account/analyses` |
| Styles anciens navigation personnelle, liste, usage | Sans consommateur du module AccountView | Retirés ; styles authentification/social et historique conservés |
| SitesView, PersonalReport, HistoryView, AccountView | Raccordés à Clarté/authentification actuelle, consommateurs actifs | Conservés ; leurs noms ne prouvent pas un vestige |
| `useIsAdmin` | Lit le compte courant, pas l’ancien cookie | Conservé pour les rapports hors AccountSession |
| `/account/design-preview` | Aperçu canonique F02, données fictives, fermé en production | Conservé comme outil de revue ; aucune seconde application connectée |
| GET Next `/api/audits` et sous-routes numériques | Barrière 410 devant le proxy fallback | Conservée pour empêcher l’exposition des lectures serveur |
| POST public `/api/audits`, rattachement et protection des comptes présents | Surface publique encore utilisée | Conservés, y compris refus d’un appel personnel sans session ; aucun contournement quota/CSRF |
| `ADMIN_API_TOKEN` / `admin-api.token` | Secret serveur pour collecte analytics consentie et lectures opérateur directes | Conservés, jamais utilisés comme identité de compte ou exposés au navigateur |

Aucune table ni migration historique n’est supprimée. ARG_AUDIT, ARG_AUDIT_RUN,
ARG_AUDIT_REPORT et ARG_DOMAIN sont partagés par les flux public et connecté.
Leurs propriétaires, credentials hachés, preuves de rattachement, diagnostics et
registres d’usage restent intacts. Les tables de compte et les migrations V11–V26
font partie des fondations actives, pas d’un ancien schéma à effacer.

## Initialisation du premier administrateur

Voir le [runbook opérateur](first-admin-runbook.md). `FirstAdminBootstrap` est
un point d’entrée CLI séparé : ni endpoint, ni service lancé au démarrage.
Aucune activation implicite des comptes, création d’identité, génération de
mot de passe ou modification d’offre. Simulation par défaut ; base nommée,
compte ACTIVE USER avec e-mail vérifié et méthode active, aucun ADMIN existant
(même archivé), version bornée. Les appels opérateur concurrents sont sérialisés
par un verrou MariaDB nommé. Le déploiement s’arrête pendant l’application.

Promotion, version, révocation des sessions/jetons/liaisons OAuth et événement
`bootstrap_admin` dans le journal de sécurité sont atomiques. Le journal admin
F11 reste celui des décisions d’un acteur ADMIN authentifié ; le bootstrap
n’invente pas un acteur déjà administrateur. Une reconnexion normale est requise.

## Preuves et limites

- `AccountLifecycleIT` : Flyway sur base vierge isolée, vérification du compte,
  simulation sans écriture, mauvaise base, refus PENDING, ADMIN existant,
  reconnexion et lecture admin, concurrence, rollback si le journal échoue.
- `DomainInterfaceFixture` provisionne son premier ADMIN avec cet outil avant
  le parcours réel navigateur/BFF/Java/MariaDB F11 ; les privilèges ne sont plus
  injectés directement par une valeur ADMIN dans l’INSERT.
- `AuditAccessHttpTest`, frontières BFF et analytics : Bearer serveur conservé,
  cookie historique sans droit, sessions et protections publiques conservées.
- `connected-cleanup.mjs` : huit anciennes adresses FR/EN en 404, trois lectures
  fermées en 410/no-store ; accueil et connexion FR/EN clair/sombre en 390/1056.
  Captures avant/après locales ; artefact CI `connected-cleanup-<sha>`.
- Suites Java/frontend, build et controlled-e2e existants : audit public, tokens,
  lecteur partagé, couverture, comptes et parcours Clarté.

Les fournisseurs OAuth/SMTP réels, la production et le reset de données ne sont
pas exercés par ces tests. Le runbook ne remplace pas une autorisation de mise en
service. F13 reste la recette globale de la refonte et ses limites opérationnelles.
