# Validation — administration, 11 octobre 2026

Milestone 10 / epic #119. Implémentation depuis main `06c4805` dans une copie
isolée, branche `codex/milestone-10-administration`. Les modifications locales
du checkout initial sont préservées.

| Issue | Livraison | Preuves |
|---|---|---|
| #13 | File globale QUEUED/RUNNING, indépendante des filtres et de la pagination | Agrégat MariaDB, DOM et recette navigateur ; aucune position/durée promise |
| #457 | Recherche nom/email, filtres état/offre, pagination, profil, consommation et accès aux analyses | HTTP Java, recherche littérale avec caractères SQL, curseurs bornés ; BFF cookie, DOM et navigateur |
| #458 | Filtres utilisateur/anonyme, hôte, statut, dates UTC ; détail modules et rapport privé | HTTP 401/403/404, colonnes projetées, statuts réels du catalogue, erreur brute exclue ; navigateur échec et ouverture du rapport |
| #459 | Offre configurée/plafond individuel, confirmation, CSRF, session récente et événement atomique | MariaDB : rollback si journal indisponible, doublon sans événement, concurrence admission/plafond, conservation des réservations, rôle USER inchangé, cibles archivées/autre ADMIN refusées |

## Résultats exécutés

- Java : suite unitaire **657 tests**, zéro échec/erreur, un test conditionnel
  ignoré ; Maven package/verify réussis.
- MariaDB **11.4.9**, UTC, instance locale isolée sur 127.0.0.1:33330 :
  **47 tests** AccountLifecycleIT + UsageIT réussis, puis **6 scénarios
  administration** repassés après ajout du test de concurrence et correction du
  format des modules, soit **48 tests d'intégration distincts** réussis.
- Frontend : **337 tests / 49 fichiers** réussis ; lint et compilation Next de
  production réussis. Les tests BFF/DOM ciblés couvrent les refus, CSRF, champs
  surnuméraires, zéro/null, filtre utilisateur, pagination, révocation et feedback.
- `scripts/check-admin.mjs` exécuté avec Edge headless via Playwright sur Next,
  Java et MariaDB réels, sans interception des réponses applicatives. Création
  d'un utilisateur de fixture, refus non-admin, recherche, pagination, changement
  du plafond à zéro, lancement réellement refusé 429, restauration du plafond,
  lancement, échec, rapport publié/consulté et journal. Parcours FR/EN (y compris
  le détail), thème sombre, 360 px, texte à 200 %, focus clavier, noindex, puis
  déconnexion avec effacement des données privées.

La recette a détecté un débordement des inputs agrandis, corrigé par leur largeur
contrainte. La revue visuelle a conduit à garder une largeur lisible aux tableaux
avec défilement interne sur mobile. L'assertion sur un run réellement créé
verrouille le format tableau des statuts de modules. Les captures finales et
logs locaux sont ignorés sous `outputs/admin/` et `outputs/admin-*.log`.

## Rejouer

1. Préparer une MariaDB locale et le schéma jetable de
   [../testing/mariadb.md](../testing/mariadb.md), exporter ARGOS_TEST_CREDENTIALS_*.
2. Depuis api-backend : `mvn -Duser.timezone=UTC test`, puis
   `mvn -Duser.timezone=UTC -P mariadb-integration -Dit.test=AccountLifecycleIT,UsageIT verify`.
3. Préparer le classpath de test avec `dependency:build-classpath`, puis démarrer
   AccountBrowserFixture avec `-Dargos.account.browser.fixture=true` et
   `-Dargos.admin.browser.fixture=true`. Ce dernier flag crée uniquement dans
   le schéma de test un administrateur synthétique et 24 utilisateurs. Les
   contrôles de publication/échec sont absents du classpath de production.
4. Compiler/démarrer Next avec API_BASE=http://127.0.0.1:33317 et
   ACCOUNT_ORIGIN=http://localhost:3000. Installer Playwright temporairement,
   sans modifier package-lock ; définir ARGOS_BROWSER_EXECUTABLE, puis exécuter
   `node scripts/check-admin.mjs`.
5. Arrêter les serveurs et la base de test. Ne pas exécuter les tests qui
   réinitialisent le schéma en même temps que la fixture navigateur.

Pas de recette humaine, compte de production modifié, déploiement, facturation
ou exécution des moteurs d'audit distants revendiqués. Les rapports de recette
sont synthétiques mais passent par la transaction de publication réelle.
