# Validation de Mes sites — 11 octobre 2026

Milestone 7, epic #445, issues #446–#448. Worktree isolé
codex/milestone-7-sites depuis main 4754f91 ; les changements du checkout
initial sont préservés. Contrat : [sites-contract.md](sites-contract.md).

| Issue | Livraison | Validation |
|---|---|---|
| #446 | Relations personnelles, alimentation create/claim, API paginée, V12/V13, projection de couverture | MariaDB réel : propriétaires A/B, suivi sans run, répétition/concurrence, SSRF/CSRF, HTTP 401/403/404, reprise de 1005 runs et compte archivé, rejeu direct V13, pagination 25 sites/26 URL |
| #447 | Mes sites FR/EN, formulaire personnel, renouvellement partagé, retours stricts | DOM : double soumission bloquée, runId sans token, cookie expiré refusé ; navigateur : vide, ajout sans audit, lancement privé, retour, renouvellement 200 sans GET artificiel |
| #448 | Détail des URL, dernière tentative et dernier rapport distincts, retour au site, polling séquentiel | MariaDB : tiers plus récent ignoré, échec conserve rapport 81/100, score absent et expiration ; DOM : absence de superposition, AbortSignal, pause masqué, arrêt terminal/401, trois reprises transitoires maximum, effacement à révocation |

Environnement local : Java 21, MariaDB portable officiel 11.4.9 sur
127.0.0.1:33327, bases jetables aux noms contrôlés par les fixtures, JVM/DB
UTC, Node 24, Next 16.3.8, Edge headless via Playwright 1.64.0.
Aucune base ni service de production n'a été utilisé.

Suite Java unitaire : 635 tests, zéro échec/erreur, un conditionnel ignoré.
Suite MariaDB complète : 60 tests, zéro échec/erreur, un E2E headless
conditionnel ignoré (la recette navigateur comptes est exécutée séparément).
AccountLifecycleIT contient 28 tests, dont sept scénarios ajoutés pour les sites.
Frontend : 44 fichiers, 294 tests, lint sans erreur/avertissement et build
complet. Les journaux et captures sont locaux, ignorés sous outputs.

La mesure instrumentée sur 25 sites confirme trois SELECT pour la première
page de 20 sites : verrou compte, verrou session, projection bornée. Le DTO
reste sous 10 Ko sur cette fixture. Aucun result_json/report_json n'est
sélectionné par la liste. Ces chiffres décrivent une fixture, pas une promesse
de latence en production.

## Recettes navigateur

check-sites.mjs passe contre Next + Java + MariaDB : ajout sans audit, deux
URL, refus d'un autre hostname, lancement/retour privés, deux propriétaires
sur une même URL, refus des IDs d'autrui, rattachement anonyme sans nouveau
run, renouvellement depuis Mes sites et absence de lectures artificielles,
archivage puis données privées retirées et retour autorisé à la connexion.

check-accounts.mjs repasse : inscription/vérification email, retour partagé,
claim, révocation d'autre session, fermeture et maintien/expiration du lien
partagé. OAuth/SMTP réels et HTTPS déployé ne sont pas testés par ces fixtures ;
les prérequis déjà documentés dans operations.md restent applicables.

Captures inspectées dans outputs/sites : FR clair desktop et vide, EN sombre
390/360 px, navigation clavier, texte à 200 %, sans débordement horizontal.
La navigation personnelle est sous le header commun. Les CTA privés restent
visibles sans survol et les URL longues reviennent à la ligne.

states-en-dark-mobile-ui-fixture.png couvre les états visuels échec avec ancien
rapport partiel, score absent avec rapport disponible, et rapport expiré.
Cette capture utilise des réponses de liste contrôlées par interception
Playwright, clairement séparées du parcours serveur réel ci-dessus ; elle ne
prouve pas une publication réelle par les modules d'audit. Le filtrage et le
choix du dernier rapport sont testés séparément sur MariaDB. Aucun témoignage
utilisateur ni essai de production n'est revendiqué.

## Rejouer

1. Préparer les trois bases jetables et variables ARGOS_TEST_* de
   [mariadb.md](../testing/mariadb.md).
2. Exécuter mvn -Duser.timezone=UTC test puis
   mvn -Duser.timezone=UTC -P mariadb-integration verify.
3. Préparer le classpath de tests avec dependency:build-classpath ; lancer
   AccountBrowserFixture selon [validation.md](validation.md), uniquement
   après arrêt des tests qui réinitialisent le même schéma.
4. Compiler/lancer Next avec API_BASE=http://127.0.0.1:33317 et
   ACCOUNT_ORIGIN=http://localhost:3000. Installer temporairement Playwright
   sans changer le lockfile, puis exécuter scripts/check-sites.mjs et
   scripts/check-accounts.mjs avec ARGOS_BROWSER_EXECUTABLE.
5. Arrêter les serveurs de fixture après la recette.

Avant déploiement, mesurer V13 sur une copie représentative, arrêter les
écritures pendant V12/V13 et suivre la procédure Flyway du contrat. Une
révocation extérieure sur un rapport déjà chargé est détectée à la prochaine
requête privée ou au renouvellement, sans polling permanent du rapport.
