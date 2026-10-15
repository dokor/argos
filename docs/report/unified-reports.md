# Rapports unifiés

Le lecteur commun sert le rapport public, le rapport du propriétaire connecté, le rapport partagé et l’exemple pédagogique FR/EN. La vue d’ensemble présente les scores, la mosaïque des mesures et trois priorités. Le plan d’action et les constats techniques conservent les filtres et liens vers les preuves.

## Accès et partage

`GET /api/reports/{token}` et `GET /api/reports/shared/{token}` retournent une synthèse (`access: summary`). Les preuves, recommandations détaillées, calcul détaillé, données techniques, analyse d’accessibilité et introduction humaine sont retirés côté serveur. Les masquer dans l’interface ne suffit pas.

Les routes authentifiées `/api/account/reports/{token}` et `/api/account/shared-reports/{token}` exigent une session vérifiée. Un destinataire possédant le lien peut lire les détails, sans accès à l’historique ni aux actions du propriétaire. Le propriétaire conserve son lecteur privé `/account/runs/{id}`.

Le propriétaire vérifié crée un lien par `POST /api/account/runs/{id}/share`, avec CSRF et `{days: 7|30|0}` (0 : jusqu’à expiration du rapport). Un nouveau lien invalide le précédent. `DELETE` sur cette même route révoque le partage. Le jeton aléatoire est distinct du token du rapport ; seul son SHA-256 est conservé. La rétention du rapport reste applicable. La migration **V29__report_sharing.sql** doit précéder le démarrage de cette version du backend.

La synthèse incite à créer un compte pour sauvegarder les rapports, suivre les prochains audits et accéder à une analyse détaillée. Le retour après connexion conserve le rapport demandé. Un partage n’attribue pas la propriété du rapport au destinataire.

## Mesures observées

Les mesures proviennent des données des modules, indépendamment de la liste des constats en échec :

| Groupe | Mesures | Source |
|---|---|---|
| Chargement | LCP, FCP, réponse HTTP, chargement de page | Lighthouse, HTTP, runtime |
| Ressources | poids transféré estimé, requêtes, HTML en UTF-8, scripts | runtime, HTML |
| Erreurs | JavaScript, console, requêtes échouées, HTTP 4xx/5xx | runtime |

Les treize tuiles sont toujours présentes. Une donnée absente, invalide ou issue d’un module indisponible affiche « Non mesuré » ; zéro reste une mesure. Les rapports historiques ne sont pas enrichis rétroactivement. Aucun TTI n’est affiché. LCP/FCP utilisent les repères 2,5/4 s et 1,8/3 s ; les autres métriques n’ont pas de seuil inventé. Ces mesures ponctuelles ne modifient pas le calcul du score.

Les PDF reprennent la mosaïque et revérifient l’accès à leur préparation. Sans connexion, seule la synthèse est proposée. Les copies déjà enregistrées ne peuvent pas être révoquées. L’URL est affichée avec son chemin complet, en conservant la suppression des credentials et paramètres sensibles.

## Vérifications

`mvn clean test` couvre notamment la projection publique, les mesures manquantes/zéro, la propriété, la rotation, la révocation et l’expiration des partages (tests SQL H2). `npm test` couvre les parcours publics/connectés, les liens de langue, les retours autorisés et les protections BFF/CSRF. La [recette d’intégration](integration-644.md) vérifie aussi la migration sur MariaDB 11.4.5 et 24 exports PDF réellement paginés par Chromium.
