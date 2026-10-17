# Recette du parcours compte — #484, #485, #486

17 octobre 2026. Aucun compte ou rapport réel utilisé dans les fixtures. Les nombres et captures ci-dessous servent à la recette, jamais à constituer une baseline produit.

## Résultats locaux

| Vérification | Résultat observé |
| --- | --- |
| Maven verify ciblé après intégration de main : AccountJourneyServiceTest, AccountJourneyWsTest, ProductMetricsTest, ProductAnalyticsServiceTest, ProductMeasurementControlTest, ConnectedAnalysesServiceTest, AccountAdminAccessTest, AccountCryptoTest | 48 tests, zéro échec ; JAR, distribution et compilation des tests réussis |
| npm run test après intégration de main | 129 fichiers, 1148 tests réussis, vérifications éditoriales FR/EN réussies |
| Nouveaux cas StrictMode et association sociale : vitest sur ProductAnalytics.dom.test.tsx et analytics/journey.test.ts | 9 tests réussis ; affichage unique en StrictMode et absence de faux échec de connexion lors d’une association |
| ESLint sur composants, contrats et proxy modifiés | Réussi |
| npm run build avec API_BASE sur les fixtures loopback | Réussi, Next.js 16.3.8 ; contrôle de types inclus |
| admin-analytics.mjs sur le build de production local | 16 états réussis, puis trois profils refusés, anciennes routes/API retirées, accueil et rapport partagé vérifiés |

La suite Java complète Windows a rencontré un timeout isolé dans ResourcePoolTest pendant la charge locale. Elle n’est pas déclarée réussie ici. La suite complète a ensuite réussi en CI Linux : voir les preuves ci-dessous. Les anciens fichiers Jacoco ont produit un avertissement de correspondance après l’intégration de main ; aucun pourcentage de couverture local n’est revendiqué.

## Preuves CI

Sur la révision intégrée a88bbfe3 :

- [API backend et frontend](https://github.com/dokor/argos/actions/runs/39020628204) : 987 tests Java réussis, suite frontend et builds réussis.
- [MariaDB 11.4](https://github.com/dokor/argos/actions/runs/39020628187) : 203 tests d’intégration réussis, dont AccountJourneyIT (quatre cas), puis trois tests de démarrage/aperçu QueryDSL réussis.
- [Parcours d’audit contrôlé](https://github.com/dokor/argos/actions/runs/39020628189) et [authentification](https://github.com/dokor/argos/actions/runs/39020628188) : réussis.
- [Matrice visuelle exhaustive](https://github.com/dokor/argos/actions/runs/39020628186) : quatre groupes et assemblage des preuves réussis.

Les ajouts finaux de premier usage par lot, StrictMode et exclusion des associations sociales sont couverts par les tests ciblés locaux ci-dessus ; les vérifications actualisées de la [PR #703](https://github.com/dokor/argos/pull/703/checks) restent la référence pour sa dernière révision. La migration analytics est V37, après V36 consacrée à l’historique de consommation dans main.

## Recette visuelle et fonctionnelle

Commande locale : HEADER_BASE_URL=http://127.0.0.1:3458 et PLAYWRIGHT_CHANNEL=msedge, puis node scripts/e2e/admin-analytics.mjs, avec frontend de production et backend de démonstration en lecture seule sur 3459. La CI emploie Chromium.

Edge 155.0.4283.45, hauteur 900 px : largeurs 320, 390, 768 et 1280 px × FR/EN × clair/sombre. Contrôles effectués dans les 16 états : un seul h1 et main, absence de débordement horizontal de page, langue conservant la route, réglages ouverts/fermés avec Entrée, période 7 jours avec deux taux immatures indisponibles, actualisation, retour à 30 jours pour la capture, puis refus administrateur 403 retirant les données et contrôles. Les tableaux défilent dans leur propre région.

Profils synthétiques anonyme, utilisateur ordinaire et compte non vérifié : aucun appel aux métriques privées et aucune donnée affichée. Les vérifications SQL/Java portent les contrôles réels de session et de propriété ; le backend visuel fictif ne prouve pas une authentification de production.

Captures et JSON local : outputs/ui-review/account-journey/. Dix-sept PNG, dont analytics-desktop-preview.png, et admin-analytics-evidence.json (16 états). Inspection visuelle des captures desktop FR clair à 1280 px et mobile EN sombre à 320 px, complétée par une inspection interactive dans le navigateur. Le contraste, les retours de texte, les contrôles alignés et les taux indisponibles ont été examinés ; ce travail n’est pas un audit WCAG exhaustif.

## Garanties exercées

Consentement v2 renouvelé, désactivation durable, ancien accord et refus exclus ; panne de mesure sans changement du résultat métier ; aucun champ identifiant ou événement premium accepté par le contrat public. Les succès classiques et sociaux utilisent le résultat métier vérifié ; l’association de méthode reste distincte. Inscription, session, rattachement et premier usage sont uniques ; activité unique par compte/jour UTC. Les admissions unitaires et par lot rejouées ne créent pas de nouveau premier usage.

MariaDB réel : inscriptions/activité dédupliquées, maturité au jour UTC exact, refus de collecte après désactivation, purge à 90 jours sans suppression des comptes/audits, audience immuable lors du rattachement, mise à niveau sans reconstituer l’historique, cohérence des mappings QueryDSL.

Aucune connexion humaine à Google/GitHub/LinkedIn, aucun déploiement, aucune activation de collecte en production, aucune mesure de rétention réelle ou gain causal ne sont revendiqués.
