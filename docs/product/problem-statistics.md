# Statistiques agrégées des problèmes — #19

Cadrage et variante « Classement éditorial » validés avec l’opérateur le 17 octobre 2026. Lecture réservée aux comptes actifs, vérifiés et administrateurs : `/account/admin/analytics/problems`, également en anglais. API BFF same-origin : `GET /api/account/admin/problem-statistics?days=90&category=security`. Seuls `days=30|90` et les quatre domaines métier sont admis ; paramètres inconnus ou répétés refusés. Aucun export ou publication publique, aucune génération d’article dans ce lot.

## Population et métriques

La période contient les 30 ou 90 jours UTC complets précédant le jour courant : début inclus, fin exclusive. La date utilisée est celle de publication du rapport, pas celle d’admission du run. Les rapports doivent exister, appartenir à un run COMPLETED et ne pas avoir expiré selon la politique active. Une réanalyse en échec sans rapport ne remplace donc pas le dernier rapport publié.

La sélection retient le dernier rapport de chaque `ARG_AUDIT.domain_id` (un hostname normalisé), toutes URL et tous utilisateurs confondus. Tri par publication décroissante, puis ID décroissant pour départager deux dates identiques. Les sous-domaines restent distincts. La sélection précède le filtre méthodologique : un dernier rapport incompatible ne fait jamais réapparaître un ancien résultat compatible. Ce rapport décrit l’URL analysée ; il n’est pas une mesure exhaustive du site.

Le rapport retenu doit avoir la version et l’empreinte exactes du barème courant, la même version de couverture, des états de couverture cohérents pour tout le catalogue pondéré et au moins un contrôle mesuré. Aucune note ni méthode historique n’est recalculée. Rapports partiels admis : seuls leurs contrôles MEASURED alimentent les dénominateurs. UNAVAILABLE, BLOCKED_BY_ANTIBOT et NOT_APPLICABLE sont exclus pour le contrôle concerné. Les détails diagnostiques non pondérés n’ont pas de population de mesure comparable et sont exclus du classement V1.

Pour chaque clé de contrôle : fréquence = domaines concernés / domaines où ce contrôle est mesuré. La présence d’un constat canonique dans `report.issues` détermine le numérateur ; les priorités ne sont jamais une source de comptage. Déduplication par identifiant de constat, première occurrence, selon `CanonicalFindings`, puis clé primaire `(report_id, check_key)`. Les clés canoniques communes à plusieurs outils ne créent pas plusieurs occurrences. Des contrôles différents décrivant des symptômes proches restent des lignes distinctes.

Le classement est trié par fréquence décroissante, puis nombre concerné et clé stable. La sévérité affichée est la plus élevée observée pour le contrôle dans la cohorte. Le filtre métier ne modifie pas les compteurs de cohorte. Aucune fréquence n’est calculée pour un contrôle absent ou non mesuré.

L’écran indique rapports de la période, hostnames distincts, domaines retenus, audits retenus partiels, domaines exclus et domaines dont la projection reste en attente. Les nombres de rapports et domaines n’ont pas le même dénominateur que chaque fréquence. Les données en attente rendent explicitement le classement temporairement incomplet.

## Diffusion et limites

Seuil validé : au moins **10 domaines mesurés et 10 domaines concernés** par ligne. En dessous, la ligne et son taux sont absents. Une sélection vide signifie « aucun résultat diffusable », jamais « aucun problème ». Absence de rapports distinguée d’un classement vide.

Les sorties contiennent des clés publiques du catalogue, catégories, sévérités, versions, dates et effectifs. Aucun hostname, URL, identifiant d’utilisateur, run/rapport, token, titre libre ou preuve n’est renvoyé. Les titres sont localisés depuis le catalogue éditorial du frontend. Le seuil limite la diffusion de petits groupes ; il ne constitue pas une garantie d’anonymat, notamment face à des comparaisons répétées. Les fenêtres et filtres restent bornés, l’accès administratif vérifié côté serveur, les réponses `private, no-store`.

Échantillon volontaire et biaisé par l’usage d’Argos, les URL soumises, les outils disponibles et les exclusions de barème. Les taux ne représentent pas l’ensemble du Web, ne s’additionnent pas et ne comparent pas des barèmes différents.

## Persistance, reprise et rétention

V36 ajoute les métadonnées de projection au rapport et la table `ARG_REPORT_PROBLEM_CHECK` : uniquement clé, catégorie, sévérité nullable (null = contrôle mesuré sans constat). Entités et Q* mises à jour. Aucun nouveau texte privé ni credential. Les faits et le marqueur sont écrits dans la transaction de publication, avec rollback commun au rapport et au run. Une nouvelle tentative de publication ne les duplique pas.

Les lectures utilisent une CTE et des agrégats SQL sur les colonnes projetées. Elles ne sélectionnent ni `report_json`, ni `result_json`, ni `diagnostic_json`. Les index bornent la fenêtre et la recherche des rapports non projetés ; un coût de tri et d’agrégation reste proportionnel à la cohorte, sans cache global indépendant des autorisations.

Le scheduler reprend au plus 25 rapports par minute, sous transaction et `FOR UPDATE SKIP LOCKED`, dans les 90 derniers jours. Un blob historique de plus de 2 MiB, invalide, sans couverture complète ou de méthode incompatible est marqué traité mais inexploitable. La reprise est idempotente, n’est jamais déclenchée par un GET et ne réécrit pas les JSON sources. Le marqueur empêche les tentatives infinies sur des rapports invalides. Une future évolution de la version de projection nécessitera une migration explicite, sans recalcul silencieux des rapports.

La FK `ON DELETE CASCADE` supprime les faits avec leur rapport. Les rapports expirés sont exclus immédiatement, même avant la purge physique. La projection ne prolonge pas la conservation de son rapport source.

## Vérification

Tests de projection : doublons, contrôles non mesurés, absence de problème, barème différent, couverture absente/ambiguë et absence de données privées. Tests service : fenêtres UTC, paramètres, rôle et session. Tests MariaDB `ProblemStatisticsIT` : migrations, réanalyses, dernier rapport incompatible, seuils, audits partiels, rapports expirés et du jour courant, reprise bornée/idempotente, rollback et cascade. Tests frontend : FR/EN, effectifs et méthode, états vides, filtres, erreurs, annulation des requêtes et révocation d’accès.

Pour une revue locale fictive : `node scripts/e2e/problem-statistics-preview.mjs`, puis lancer Next avec `API_BASE=http://127.0.0.1:3049` (y compris au build pour les rewrites). Serveurs exclusivement loopback en lecture, ports 3048/3049. Ouvrir `/account/admin/analytics/problems` et `/en/account/admin/analytics/problems`. Ne jamais déployer ces fixtures.
