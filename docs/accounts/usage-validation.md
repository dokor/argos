# Validation de la consommation — 11 octobre 2026

Milestone 8, epic #14. Branche isolée `codex/milestone-8-usage` depuis
main `3d38e1a` (Mes sites fusionné). Le checkout initial n'a pas été modifié.
Contrat et déploiement : [usage-contract.md](usage-contract.md).

| Issue | Livraison | Preuves |
|---|---|---|
| #449 | Registre unique par run, admission/réservation et publication/débit atomiques, libération après échec/reaper | UsageIT : huit lancements concurrents pour deux places, rollback de complétion et du débit, publication concurrente idempotente, rapport partiel sans score, worker obsolète, requeue, rétention |
| #450 | Offres séparées des rôles, plafonds configurables mais absents par défaut, mois calendaire UTC configurable | UsagePolicyTest : UTC, Europe/Paris, DST et changement d'année, null/zéro, limites invalides ; UsageIT : offre unlimited/zéro malgré rôle ADMIN, réservation au changement de mois ; reprise V13→V14 |
| #451 | API propriétaire no-store et carte FR/EN sur Mes sites/compte, échéance ISO, capacité côté serveur | HTTP réel : 401/403, 429+Retry-After, lecture et ajout de site possibles ; DOM : session partagée, effacement, reset, erreur de service, bouton bloqué et erreur quota distincte ; navigateur réel |
| #452 | Audit sans compte et limiteur anti-abus conservés, rattachement compté une fois | AccountLifecycleIT : rapport produit rattaché au mois d'origine même sous plafond nul, second compte refusé, run actif refusé sans transfert/proof consommée ; recette anonyme→publication→claim rejoué→un seul débit |

## Tests exécutés

- Java unitaire : 639 tests, zéro échec/erreur, un conditionnel ignoré.
- MariaDB 11.4 : suite complète de 71 tests passée, zéro échec/erreur, un
  E2E contrôlé conditionnel ignoré. Après les derniers ajustements, les
  32 tests AccountLifecycleIT (dont le contrat HTTP ISO) et les huit tests
  UsageIT sont repassés. Le total de tests d'intégration distincts est 72.
- Frontend : 305 tests dans 46 fichiers, tous réussis ; lint et build
  production Next.js réussis.
- `check-usage.mjs`, `check-sites.mjs` et `check-accounts.mjs` passés sur le
  frontend compilé, Java et MariaDB réels. Les logs/captures sont locaux,
  ignorés sous `outputs`.

L'environnement est Windows, Java 21, Node 24, MariaDB portable officiel
11.4.9 lié à 127.0.0.1:33328, schémas jetables contrôlés par les fixtures,
JVM et DB UTC, Edge headless via Playwright. Une première suite complète a
détecté le fuseau local de la DB de fixture dans ProductAnalyticsIT ; la DB
a été alignée sur UTC et la suite a repassé. Un essai supplémentaire UsageIT
a rencontré une erreur transitoire de socket Windows ; la suite ciblée a été
rejouée après arrêt des serveurs navigateur. Aucune base de production utilisée.

## Recette navigateur et inspection

La fixture `AccountBrowserFixture` accepte uniquement son flag explicite,
les schémas de test loopback et, pour cette recette, un plafond **de fixture**
de deux analyses. Les commandes `__test/usage/...` sont dans le classpath de
test et ne sont pas enregistrées par l'application de production. Elles
appellent les transactions réelles de publication/échec avec un rapport
synthétique partiel ; elles ne prouvent pas l'exécution de modules distants.
La recette n'intercepte pas les réponses BFF/API et n'utilise pas de fake
counter ou d'identité de production.

Parcours : compte vérifié, deux réservations, troisième lancement 429,
lectures et suivi d'URL maintenus, publication partielle→un débit, échec→une
réservation libérée, formulaire réactivé, rapport lisible, second propriétaire
isolé, audit anonyme publié puis rattaché deux fois→un débit, archivage→données
retirées. Les recettes Mes sites et comptes restent réussies.

Captures inspectées : carte FR claire à capacité atteinte, EN sombre à
360 px, page avec texte 200 %, sans débordement horizontal. Un seul h1,
noindex/nofollow, labels et focus clavier vérifiés. L'inspection a détecté
une sérialisation Jackson en secondes affichant 1970 ; le DTO renvoie désormais
des strings ISO-8601, verrouillées par HTTP et par assertion navigateur sur
une échéance future. Les captures finales affichent le 1er novembre 2026 UTC.

## Rejouer

1. Préparer les schémas de [mariadb.md](../testing/mariadb.md), les variables
   ARGOS_TEST_* et les fuseaux DB/JVM UTC. Les tests réinitialisent les bases.
2. Depuis api-backend, `mvn -Duser.timezone=UTC test`, puis
   `mvn -Duser.timezone=UTC -P mariadb-integration verify`.
3. Préparer le classpath de tests (`dependency:build-classpath`) et lancer
   AccountBrowserFixture avec `-Dargos.account.browser.fixture=true`,
   `-Dargos.usage.fixture-limit=2`. Ne pas lancer les tests destructifs en
   même temps que la fixture navigateur.
4. Compiler puis démarrer Next : API_BASE=http://127.0.0.1:33317,
   ACCOUNT_ORIGIN=http://localhost:3000. Installer temporairement Playwright
   sans changer package-lock, définir ARGOS_BROWSER_EXECUTABLE et lancer les
   trois scripts `check-usage.mjs`, `check-sites.mjs`, `check-accounts.mjs`.
5. Arrêter les serveurs et la base de fixture après la recette.

Pas de recette humaine, débit commercial, paiement, OAuth/SMTP réel, charge
production, déploiement ou prévention absolue des contournements revendiqués.
Les limites anonymes et la reprise V14 sont détaillées dans le contrat.
