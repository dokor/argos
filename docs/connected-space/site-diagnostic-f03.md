# F03 — Analyse URL et diagnostic privé

Implémentation de #553, empilée sur F02 (#564). Les correctifs de F01 ont été intégrés dans F02 par le merge `d8100cf` ; les textes Clarté et les erreurs OAuth sont conservés.

## Parcours livré

- `/account/analyses/new` et `/en/account/analyses/new` : URL précise, profil réellement proposé par `/analysis-profiles`, limites de collecte, coût de 1 crédit, réservation, validation et reprise après réponse perdue. URL préremplie depuis un site ou un diagnostic. Le formulaire bloque les admissions multiples et conserve la même clé après un échec réseau ; si la réservation a épuisé le quota, la récupération reste autorisée.
- `/account/sites` : recherche serveur par hostname, pagination et recherche dans l’URL, ajout sans consommation via un panneau dépliable.
- `/account/sites/{id}` : recherche serveur dans les URL, dernière tentative et dernier rapport disponible séparés, accès au run exact, historique, nouvelle analyse.
- `/account/runs/{id}` : progression relisible après rechargement, modules réels, dates, profil demandé, diagnostic partagé avec le rapport existant. Échec, expiration et absence de rapport sont explicites. Aucun autre rapport n’est substitué. Un rapport publié reste lisible même si l’état du run est FAILED.
- Historique : conserve ses comparaisons serveur entre tentatives adjacentes, ses ruptures pour versions/couvertures incompatibles et ses liens exacts. Relancer utilise le même nouveau formulaire idempotent.

La coque, les deux langues, les thèmes et le footer sont partagés avec F02. Le formulaire conserve deux colonnes à 1056 px comme la référence et passe en pile sur mobile. Le rapport privé conserve le moteur de présentation des constats/mesures, dans les surfaces Clarté, sans les actions publiques de partage ou de lancement anonyme.

## Contrats et persistance

`POST /api/account/analyses` est marqué `available` dans `connected-space.openapi.json`. Corps `SiteAnalysisInput {url, profileId}`, en-tête UUID `Idempotency-Key`, réponse `SiteAnalysisAccepted {runId, status}`. DTO Java et types TS sont générés. Les identifiants restent des chaînes décimales.

Le BFF valide origine/CSRF, longueur, SSRF, profil et clé ; il transmet uniquement la session du cookie. Java revalide session active/vérifiée, CSRF et SSRF. La transaction tient les verrous du compte/session, puis ceux de l’admission/usage existants. Elle crée ensemble run, réservation, rattachement personnel, empreinte de la demande et snapshot du profil. Même propriétaire/clé/contenu : même run, avant tout contrôle de quota ; contenu différent : `409 idempotency_conflict`. Une relance volontaire utilise une nouvelle clé. Le parcours public reste inchangé.

V20 ajoute à `ARG_AUDIT_RUN` `idempotency_key`, `request_fingerprint`, `profile_snapshot` et une unicité propriétaire/clé. Bean et QueryDSL sont mis à jour. Aucun second registre de crédits. Une panne annule la transaction ; un run publié partiel consomme, un échec sans rapport libère selon le moteur existant.

Le GET privé existant gagne `startedAt`, `finishedAt`, `profileSnapshot` (JSON nullable) et `reportAvailability` : `PENDING | AVAILABLE | EXPIRED | UNAVAILABLE`. Les anciennes analyses sans snapshot affichent « Non renseigné ». `moduleStatuses` conserve son JSON de tableau `{id,label,status}`. Les lectures restent owner-scoped ; expiration et suppression restent contrôlées lors de la lecture effective du rapport.

Les listes `sites` et `sites/{id}/urls` acceptent `q` (200 caractères max, sans contrôles). Recherche littérale insensible à la casse, filtrée avant pagination et limitée au propriétaire ; `%` et `_` ne sont pas des jokers. Les routes d’historique n’acceptent pas ce filtre.

## Fidélité et dépendances

Le profil `mobile-v1`, le viewport et le réseau illustrés par la maquette ne sont pas des capacités du moteur : l’écran affiche `server-default-v1` et les réglages propres aux collecteurs. Le snapshot demandé est distinct des versions effectives : scoring, couverture, preuves et versions présentes viennent du rapport, via son panneau méthode. Les valeurs absentes restent inconnues. Aucun delta n’est calculé dans le navigateur.

F05/#555 reste nécessaire pour le parcours complet offres/quotas et l’admission d’un lot de pages. F03 utilise la réservation atomique URL déjà disponible et l’enrichit d’idempotence. F14/#538 reste nécessaire pour les nouvelles preuves DOM/ressources réelles et bornées. F03 n’invente pas de sélecteur ou d’exemple HTML : il présente les preuves existantes et explique les absences. **QA-18 complète dépend toujours de #538 ; ne pas clôturer #553 sur les seules captures de cette PR.** La contrainte historique d’unicité des URL sur 255 caractères reste suivie par F07, avant le lancement de lots de pages longues.

## Vérifications reproductibles

- `npm run lint`, `npm test`, `npm run build` dans `apps/console-web` ; tests de formulaire, réponse perdue, clé réutilisée à quota épuisé, refus CSRF/SSRF, filtres, polling borné, navigation entre runs, révocation, expiration et échec publié.
- `mvn test` puis `mvn -P mariadb-integration -Dit.test=AccountLifecycleIT,ConnectedModelIT,AuditPublicationIT,AuditAdmissionIT verify`. Les tests SQL couvrent la concurrence sur la même clé, le rejeu au plafond, le conflit de contenu, deux propriétaires et la recherche avant pagination. La CI exécute MariaDB 11.4 ; aucune base locale de production n’est utilisée.
- `python scripts/contracts/generate-connected.py --check` : contrat/Java/TS synchronisés.
- `node scripts/e2e/connected-analysis.mjs` : réponses synthétiques injectées dans le navigateur, pas une preuve d’autorisation SQL. 148 combinaisons écran/langue/thème/largeur, dont 320/390/768/1056/1440, progression après reload, recherche, rapport exact, partiel, expiré, échec, non-mesuré, ancien rapport, quota et texte 200 %. Clavier, un H1/footer, absence de débordement et axe. `CLARTE_BROWSER_PATH` peut sélectionner un Chromium local ; `CONNECTED_BASE_URL` reste loopback.
- `node scripts/e2e/account-history.mjs` : comparaison et relance depuis l’historique. Les recettes backend réelles `check-sites.mjs` et `check-usage.mjs` sont adaptées à la nouvelle page ; leurs prérequis sont dans `docs/testing/accounts.md`.

Captures et résultats : `outputs/ui-review/clarte-analysis/` (ignoré), publiés par `Controlled audit E2E` comme artefact `connected-analysis-{sha}`. Les fixtures ne sont importées ni par Next ni par Java. Le serveur optionnel `node scripts/e2e/connected-analysis-fixture.mjs --serve` écoute en lecture seule sur `127.0.0.1:3021` pour l’inspection humaine ; ne jamais le déployer.
