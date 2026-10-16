# Mesure produit interne — #42

Désactivée par défaut. Trois conditions sont nécessaires : autorisation de déploiement Java `product-analytics.enabled=true`, autorisation BFF `PRODUCT_ANALYTICS_ENABLED=true` avec `ADMIN_API_TOKEN`, et réglage administrateur enregistré en base. Les drapeaux de déploiement restent des garde-fous : les autoriser une fois demande une modification de configuration et un redémarrage, puis les bascules courantes se font dans Administration → Statistiques. Aucun fournisseur tiers.

## Pilotage administrateur — #656

La migration V32 crée ARG_PRODUCT_SETTING (ligne singleton, désactivée initialement). GET /api/account/admin/analytics/settings expose enabled, requestedEnabled, deploymentAllowed, version et lastCollectedAt ; le BFF ajoute bffAllowed. PATCH exige enabled (booléen), expectedVersion (entier sûr) et confirmation=true, une session ACTIVE ADMIN relue côté serveur et le double contrôle CSRF origine/cookie/en-tête, lié à la session. Aucun ancien token d’administration ne donne accès à ce réglage.

L’interface demande de vérifier l’information de confidentialité avant activation. Une configuration bloquée ou une erreur de stockage ne devient jamais un succès. La désactivation du réglage mémorisé reste possible même si le déploiement bloque déjà la collecte. La version optimiste et le verrou de la ligne sérialisent les modifications concurrentes ; une version obsolète donne 409, à actualiser avant une nouvelle décision.

Chaque événement prend le même verrou dans sa transaction, sans cache local : après validation de la désactivation, les écritures suivantes sont omises sur toutes les instances. L’activation ouvre une nouvelle fenêtre : les runs antérieurs ne reçoivent aucune attribution et les anciennes attributions ne reçoivent pas de nouvelle vue de rapport. Les compteurs historiques restent consultables pendant leur rétention, avec date de dernière écriture effective. La purge horaire de 90 jours reste indépendante du réglage. Les changements réels sont journalisés atomiquement dans ARG_ADMIN_EVENT avec auteur, date, état avant/après et identifiant de requête, sans utilisateur cible artificiel ni données privées.

Les informations publiques de confidentialité FR/EN et le bandeau de consentement ont été revus : consentement facultatif explicite, acceptation/refus, retrait, minimisation, absence de tiers et rétention sont déjà décrits. Le point de lecture de consentement interroge désormais l’état effectif backend avec le credential serveur et se ferme en cas d’erreur ; les refus individuels restent respectés indépendamment de l’activation globale.

Accord explicite facultatif, choix accepter/refuser équivalents, retrait depuis le bouton Mesure produit. Cookie HttpOnly SameSite Strict de session, aucun identifiant de personne. Pas de localStorage, URL soumise, token, IP, email, contenu privé ou paramètre libre dans les tables de mesure. Les requêtes de lecture existantes du rapport restent nécessairement protégées par leur token ; celui-ci ne devient pas un événement.

Compteurs journaliers UTC : pages publiques fermées, exemple affiché, CTA audit, soumission rejetée (validation/service/rate_limit). Une attribution par run créé après consentement. Terminaison/échec dérivés de l’état métier, premier affichage réellement rendu dédupliqué par run. Rafraîchissements et polling ne gonflent pas les rapports consultés. Le retrait arrête les nouveaux événements du navigateur ; les états des runs déjà consentis et compteurs agrégés ne sont pas rétroactivement effacés.

Administration `/account/admin/analytics` et `/en/account/admin/analytics`, périodes 7/30/90 jours. Lecture via `/api/account/admin/analytics` avec la session de compte ACTIVE ADMIN, rôle relu côté Java. Cohortes de création et sources/langue/emplacement, file/traitement/total médiane p90 p95 par rang proche. Dates manquantes/inversées exclues explicitement ; traitement/total sur runs COMPLETED seulement ; cohorts récentes immatures. Aucun taux visite→rapport, visiteur unique, gain causal ou objectif inventé. Limite 100000 runs, affichée si atteinte. Les compteurs utilisent des jours UTC, les runs une fenêtre glissante : dénominateurs distincts.

Tables propres purgées chaque heure : attributions >90 jours ; compteurs au-delà de 90 jours UTC. Cette purge ne touche aucun audit/run/rapport. Pannes de collecte sans impact sur audit ; aucune reprise ni SDK tiers. Endpoints de collecte et agrégats protégés par credential serveur ; BFF valide origine, consentement, champs fermés et corps ≤2048 octets.

Validation : tests de contrats/consentement hors collecte, percentiles/cohortes, migration MariaDB réelle en CI. Première base de comparaison à constituer après activation autorisée ; aucun résultat réel annoncé.

## Définitions et lecture des résultats

Les événements réellement acceptés sont définis par les schémas backend et BFF,
pas par l'ancien dictionnaire de projet #42. Un clic n'est pas une soumission,
une page vue n'est pas un visiteur unique et un poll n'est pas une vue de rapport.
Les dimensions sont bornées (route publiée, langue, emplacement, catégorie),
jamais du texte ou une URL provenant de l'utilisateur.

File = started_at − created_at ; traitement = finished_at − started_at.
Lire la définition du total et les exclusions dans ProductAnalyticsService avant
d'annoncer un délai utilisateur : le rendu navigateur ajoute son propre temps.
Publier période UTC, effectifs valides, exclusions, médiane/p90/p95, échecs et
couverture. Une cohorte récente peut encore contenir des runs non terminés.
Ne pas convertir consultations/audits en taux individuel, ni navigateur fermé en
abandon. Distinguer échec métier, refus de collecte et collecte perdue.

Une comparaison avant/après exige des fenêtres et effectifs comparables ; la cible
initiale est 28 jours, sans causalité déduite d'une variation brute. Search Console
complète pages/requêtes sans recevoir les rapports privés. La première baseline
reste à constituer après activation autorisée. Les informations de confidentialité,
la durée et la purge doivent être vérifiées dans la configuration effective.
