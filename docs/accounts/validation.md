# Validation locale du jalon 6 — 11 octobre 2026

Branche `codex/milestone-6-accounts`, base `main` après #438. Les modifications présentes dans le checkout initial ont été conservées ; ce jalon est réalisé dans un worktree distinct.

| Issue | Livraison | Preuves |
|---|---|---|
| #444 | Migration V11, modèles/Q*, JWT Plume + registre, matrice de droits, permissions Jersey, contexte RequestScoped, BFF | Tests crypto, HTTP Java, BFF, contraintes MariaDB, deux propriétaires sur une URL, contextes/CSRF falsifiés |
| #439 | Argon2id, inscription, vérification explicite, renvoi, récupération, notifications SMTP injectable | Salts/mots de passe, expiration/usage unique et courses DB, refus de reset après archivage, rollback SMTP simulé, recette navigateur email |
| #440 | Google/LinkedIn OIDC, GitHub OAuth/PKCE, transactions liées au navigateur, état vérifié conditionnel | Vraies signatures OIDC de fixture (issuer/audience/nonce/exp/signature), state rejoué ou incorrect, email précréé, collisions ; échanges fournisseurs simulés |
| #441 | Liaison explicite, preuve récente existante, code email lié à la session, retrait atomique | Course sur la dernière méthode, fournisseur non configuré inutilisable, retrait concurrent à connexion, révocation/notifications |
| #442 | Preuve HttpOnly par run, distincte du lien partagé et du claim scheduler, attribution/consommation atomiques | Deux revendications concurrentes, retry, états QUEUED/RUNNING/COMPLETED, expiration/purge/falsification, huit preuves et plusieurs onglets, retour email/OAuth |
| #443 | Profil en liste blanche, email en lecture seule, sessions/révocation, fermeture par archivage | Courses avec login/reset/social/claim/publication, refus des anciens JWT, liens et données partagées conservés ; UI FR/EN accessible |

Environnement : Java 21, MariaDB portable 11.4.9 uniquement sur loopback et schémas jetables, Node 24, Next 16.3.8 déjà présent dans le dépôt, Edge headless via Playwright 1.64.0. MariaDB **et** JVM sont en UTC, comme la CI. Les fixtures refusent une URL de base non locale ou un nom de schéma différent de celui attendu et effacent leurs schémas ; aucun service de production n'a été utilisé.

Résultats : suite unitaire Java 653 tests, zéro échec, un test conditionnel ignoré ; suite MariaDB 51 tests, zéro échec, dont 21 tests de comptes ; frontend 42 fichiers / 264 tests, lint et build complets. La recette navigateur passe contre Next + Java + MariaDB : audit anonyme, inscription, lien email sans consommation GET, vérification POST, connexion, retour au rapport, rattachement du bon run, autre session révoquée, archivage, ancien accès privé refusé, lien partagé valide maintenu et expiré refusé. Le script vérifie aussi les dates ISO, les cookies HttpOnly, les headers forgés et le refus d'un accès admin dynamique depuis le navigateur.

La recette a révélé et corrigé le rewrite `afterFiles` qui précédait les Route Handlers dynamiques : le proxy Java est maintenant un **fallback**. Elle a aussi conduit à rendre explicitement les dates compte en ISO et à prendre en charge les routes privées dans le sélecteur de langue. Captures inspectées : FR clair, EN sombre mobile 390 × 844 et focus clavier visible ; sorties locales ignorées sous `outputs/accounts/`.

Le contrôle E2E existant du header passe également sur 192 captures : routes FR/EN, thèmes clair/sombre, visiteur/admin, largeurs 1280/390/320 px, breakpoints intermédiaires, navigation client, scrollbar, chargement des polices et bascules de thème/langue. Le lien compte réserve une largeur identique dans les deux langues, devient une icône avec nom accessible sur mobile, et le header conserve sa géométrie pendant l'hydratation. Build et lint repassés après cette correction.

## Rejouer la recette navigateur

1. Lancer MariaDB jetable en UTC et exporter les trois variables `ARGOS_TEST_CREDENTIALS_*` décrites dans [mariadb.md](../testing/mariadb.md).
2. Dans `apps/api-backend`, compiler les tests et préparer le classpath : `mvn -Duser.timezone=UTC test dependency:build-classpath -Dmdep.includeScope=test -Dmdep.outputFile=account-classpath.txt`.
3. Lancer `com.dokor.argos.services.domain.report.AccountBrowserFixture` sur le classpath tests + classes + dépendances avec `-Duser.timezone=UTC -Dargos.account.browser.fixture=true`. Cette fixture est absente du JAR de production, écoute uniquement `127.0.0.1:33317` et expose une capture email locale pour la recette. Ne pas lancer en même temps que les tests MariaDB qui réinitialisent le même schéma.
4. Dans `apps/console-web`, définir `API_BASE=http://127.0.0.1:33317` et `ACCOUNT_ORIGIN=http://localhost:3000`, puis `npm run build` et `npm run start -- --hostname 127.0.0.1 --port 3000`.
5. Installer le runner temporairement : `npm install --no-save --package-lock=false playwright@1.64.0`. Définir `ARGOS_BROWSER_EXECUTABLE` vers Edge/Chromium local, ou installer Chromium avec le runner. Exécuter `node scripts/check-accounts.mjs`.
6. Arrêter les deux serveurs et supprimer les bases jetables après la recette.

Les applications OAuth, le SMTP réel, les cookies/redirects en HTTPS déployé, la mesure Argon2 sur l'hôte cible et la revue indépendante restent à réaliser conformément à [operations.md](operations.md). Ces prérequis ne sont pas remplacés par des mocks ; les issues restent ouvertes pour cette recette.
