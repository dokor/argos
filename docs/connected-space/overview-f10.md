# Vue d’ensemble F10 — #558

## Parcours et périmètre

`/account` et `/en/account` deviennent la vue d’ensemble Clarté. Trois KPI
ouvrent leur périmètre : URL prioritaires, URL sans diagnostic complet et
crédits disponibles. Le tableau de travail est une liste responsive d’URL,
avec recherche, filtres, pagination, site, tentative datée, score qualifié,
couverture et diagnostic exact. Les analyses actives sont dans un bloc distinct.
Les analyses récentes et le lancement d’un domaine complètent la page.
Le footer et le shell F02 sont conservés. Les pages de sites F03 restent accessibles.

Les filtres `attention`, `query`, `domainId`, `limit`, `offset` vivent dans
l’URL et sont validés dans le BFF et l’API Java. Le retour d’un run restaure
ces filtres, y compris après refresh et changement de langue. Un GET ne lance
aucune analyse. La relance passe par le tunnel F03 avec coût confirmé.

## Projection commune

`GET /account/overview` est disponible et accepte les mêmes filtres que
`GET /account/pages`. Extension du contrat prévu : `overview.pages` contient
l’inventaire filtré du même snapshot que les KPI. Les filtres et la pagination
ne changent pas les compteurs globaux. `recentRuns` et `activeAttempts` portent
l’identité de la page et du site ; `TrackedPage.hostname` permet un libellé réel.
Le schéma OpenAPI et les DTO/types générés évoluent ensemble.

La lecture privée repose sur `ARG_ACCOUNT_SITE_URL`, unique par site/audit.
La dernière tentative est choisie par propriétaire + audit, date puis ID,
indépendamment de son lot. Les trois totaux URL proviennent de la même CTE SQL,
avant pagination. Aucun agrégat global n’est calculé dans le navigateur.
Une URL peut être prioritaire et incomplète ; les populations ne s’additionnent pas.

Une tentative échouée n’hérite jamais des constats ni du score d’un ancien
rapport. Le dernier rapport encore disponible est identifié séparément et daté.
Un rapport expiré n’est plus présenté comme disponible. Les URL jamais analysées
et celles dont le diagnostic est inconnu sont à compléter. Les runs actifs,
y compris une ancienne tentative encore active, sont comptés séparément ; le
filtre `attention=active` porte explicitement sur les dernières tentatives.

Lectures en transaction REPEATABLE READ, propriétaire vérifié avant les requêtes.
Usage issu du registre F05 sous ses verrous habituels. Les listes sont bornées
à 100, les récents/actifs à 10, les priorités à 5. Le dernier rapport disponible
est chargé en une requête groupée, sans N+1. Aucun corps de rapport, preuve,
token ou résultat moteur n’est renvoyé par ces lectures.

## Complétude et migration V25

`ARG_AUDIT_REPORT.measurement_completeness` conserve la sortie de
`ReportCompleteness.from`, déjà utilisée par les lots F07. Le score et son
caractère provisoire ne remplacent pas cette règle. Publication dans la même
transaction que le rapport. V25 matérialise les rapports existants par groupes
de 20, de façon reprenable, avec UNKNOWN lorsque les données ne suffisent pas.
Entité et QAuditReport mises à jour ; aucun recalcul de score ni appel externe.
La projection de diagnostic F08 fournit les compteurs et la couverture.

## États et recette

Chargement, premier usage vide, filtre vide, filtre invalide, quota nul/illimité,
rafraîchissement en erreur et session expirée sont explicites. Une erreur
transitoire conserve le snapshot daté avec avertissement ; une erreur permanente
401/403/404/410 efface les données privées. Polling séquentiel uniquement tant
que des runs sont actifs, pause en onglet caché, reprises bornées, arrêt terminal.

Exigences : UI-02, UI-04, FUN-01, FUN-02, QA-04, QA-17.
`OverviewIT` exerce la fixture canonique 15/9/3/68 en MariaDB, l’isolation,
les anciennes tentatives, les dates/IDs à égalité, les données inconnues,
l’expiration, la pagination et le nombre constant de requêtes.
`connected-overview.mjs` couvre les langues, thèmes, cinq largeurs, filtres,
retour diagnostic, erreurs et quotas avec des fixtures explicitement synthétiques.
`domain-browser.mjs` vérifie aussi la vue d’ensemble sur les deux lots réellement
créés en Java/MariaDB : déduplication, totaux filtrés et retour du run.

Les captures et résultats sont dans `outputs/ui-review/clarte-overview/` et
l’artefact CI `connected-overview-<sha>`. La preuve réelle reste dans l’artefact
domaine, `real/proof.json` et `real/overview.png`. Les preuves locales ne sont
pas versionnées. Ne pas confondre un scanner axe avec une certification WCAG.

Écarts à la maquette : les données réelles déterminent les nombres et hauteurs ;
aucune variation de performance n’est inventée dans le bloc récent. Les analyses
récentes affichent leur date/statut et ouvrent le run exact. Les listes utilisent
les composants Clarté, sans nouvel écran multi-clients ni moyenne entre sites.
