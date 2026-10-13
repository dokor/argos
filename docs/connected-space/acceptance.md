# Recette et preuves attendues

Chaque PR cite les IDs ci-dessous et UI/FUN/ARC concernés. Un test mocké de
composant ne prouve ni transaction MariaDB ni autorisation Java. Une capture
de maquette ne prouve pas l’intégration. Aucun engagement « zéro bug ».

| ID | Exigence / scénario | Couche et preuve |
|---|---|---|
| QA-01 | UI-01…13 : composition, footer, navigation, états vides/erreurs | Captures produit aux tailles prescrites, revue côte à côte, rapport d’écarts |
| QA-02 | Clavier, labels, focus modal/retour, contraste, zoom200%, FR/EN, clair/sombre | Tests accessibles existants + recette manuelle sur parcours principal |
| QA-03 | FUN-01 : utilisateur A ne voit/modifie aucun ID de B, même hôte partagé | Tests API + MariaDB ; GET/listes/agrégats/mutations, cache no-store |
| QA-04 | FUN-02 : 15 URL, 9 prioritaires, 3 incomplètes ; paginer ne change pas KPI | Tests de projection avec fixture et doublon URL entre lots ; test UI filtres |
| QA-05 | FUN-03 : module terminé sans mesure, partiel avec score, absent != zéro | Tests contrats/scoring existants + rendu des états/comparaison refusée |
| QA-06 | FUN-04 : CSP6/7, images4/7, labels3/7 ; multiples occurrences dédupliquées | Tests agrégateur ; PASS/FAIL/UNAVAILABLE/NOT_APPLICABLE, filtre et total |
| QA-07 | FUN-05 : collections en tête, échec à part, bon run au clic/retour | Test de tri serveur + E2E synthèse→pages→rapport→retour |
| QA-08 | FUN-06 : SSRF IPv4/IPv6, DNS/redirect, sitemap/XML, limites/robots | Tests crawler contrôlé, aucun accès privé, délais/budget/troncature |
| QA-09 | FUN-07 : N places ou rien, deux admissions concurrentes, double clic | Intégration MariaDB réelle, contraintes et réservations uniques |
| QA-10 | Crash worker/reprise, deux workers, publication/restitution une fois | Intégration orchestrateur + injection d’échec aux frontières transactionnelles |
| QA-11 | Annulation pending/running/publication concurrente, changement de mois | Horloge contrôlée + MariaDB ; aucune réservation perdue ni double débit |
| QA-12 | FUN-08 : sessions, OAuth annulé, dernier accès, archive/suspension | Tests auth existants étendus, API401/403/404, callback contrôlé et recette provider configuré |
| QA-13 | Admin : utilisateur standard, cible ADMIN, réauth, quota sous engagé, stale version | Tests serveur/BFF, aucune écriture/journal partiel ; E2E compte standard |
| QA-14 | Domaine durable : quitter/rafraîchir, revenir liste, ancien lot conservé | E2E réel avec DB persistée ; chemins/IDs exacts, pas de timers frontend |
| QA-15 | Pas de régression audit/public/rapport, token conservé, couverture/comparaison | Suite actuelle ciblée + controlled-e2e ; public uniquement si frontière modifiée |
| QA-16 | Base neuve, premier admin, code connecté remplacé supprimé | Initialisation isolée documentée + inventaire routes/secrets sans reset prod |
| QA-17 | Listes nombreuses, URL longue, pas de N+1, polling terminé | Traces requêtes/profilage, fixtures volumineuses, assertions arrêt polling |
| QA-18 | Preuve réelle, bornée, secret absent, indisponible explicite | Tests collecteurs/composition #538 + rapport UI ; jamais HTML inventé |

## Matrice minimale de captures produit

Pour chaque UI : desktop1056 et mobile390, clair FR. Pour shell, dashboard,
synthèse, table et compte/admin : aussi320,768,1440, sombre et EN. Capturer
au moins vide, chargé, erreur, accès insuffisant ; rapport partiel/échoué,
quota0/illimité et modal administrative. Fixer horloge/données, attendre fontes,
désactiver animations pour le diff uniquement. Vérifier footer et absence de
scroll global dans chaque capture. Les screenshots de référence ne remplacent
pas la revue clavier. Documenter navigateur/version/viewport/données.

## Commandes à reprendre dans les PR d’implémentation

```text
# Backend (depuis apps/api-backend)
mvn test
# Frontend (depuis apps/console-web ; scripts package.json courants)
npm run lint
npm run test
npm run build
# Intégration : nécessite la MariaDB de test isolée configurée
mvn -f apps/api-backend/pom.xml -P mariadb-integration -Dit.test=ControlledAuditE2eIT verify
```

Vérifier le nom des scripts au début de la PR ; ne pas remplacer un échec par
une commande moins exigeante. Les instructions d’environnement et la
différence tests contrôlés/providers réels sont dans
[controlled-e2e](../testing/controlled-e2e.md) et
[tests comptes](../testing/accounts.md). Étendre ces suites, ne pas créer un
second harness qui contourne les protections SSRF ou les vrais workers.

**Pour ce dossier seul** : validation liens/fixtures/intégrité des références,
reconstruction HTML, revue de l’aperçu et de ses captures. Ne pas déclarer
`mvn test`/build produit exécutés si aucun code n’a été touché et qu’ils ne l’ont
pas été. Le script `validate.py` ne teste pas l’application.

## Conditions de clôture de la refonte

- Toutes les issues livrées/intégrées, aucun bouton essentiel factice.
- Routes privées, compteurs et consommation cohérents sur données réelles.
- Captures comparées et écarts assumés dans la PR, footer et responsive validés.
- Aucun critique sécurité, droit d’accès ou quota non résolu ; erreurs métier
  expliquées et récupérables.
- Dossier et OpenAPI ajustés à ce qui est livré, pas à une ancienne intention.
- Runbook de base neuve testé en environnement isolé, secrets par configuration.
- Fusion/déploiement/reset ne sont pas déclenchés par la seule clôture de recette.
