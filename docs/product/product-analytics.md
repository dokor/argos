# Mesure produit interne — #42

Désactivée par défaut : backend product-analytics.enabled=false ; BFF PRODUCT_ANALYTICS_ENABLED absent. Activation exige les deux drapeaux et ADMIN_API_TOKEN côté serveur, après revue des informations publiques. Aucun fournisseur tiers ni intervention en production dans cette PR.

Accord explicite facultatif, choix accepter/refuser équivalents, retrait depuis le bouton Mesure produit. Cookie HttpOnly SameSite Strict de session, aucun identifiant de personne. Pas de localStorage, URL soumise, token, IP, email, contenu privé ou paramètre libre dans les tables de mesure. Les requêtes de lecture existantes du rapport restent nécessairement protégées par leur token ; celui-ci ne devient pas un événement.

Compteurs journaliers UTC : pages publiques fermées, exemple affiché, CTA audit, soumission rejetée (validation/service/rate_limit). Une attribution par run créé après consentement. Terminaison/échec dérivés de l’état métier, premier affichage réellement rendu dédupliqué par run. Rafraîchissements et polling ne gonflent pas les rapports consultés. Le retrait arrête les nouveaux événements du navigateur ; les états des runs déjà consentis et compteurs agrégés ne sont pas rétroactivement effacés.

Dashboard administrateur /dashboard/analytics, périodes 7/30/90 jours. Cohortes de création et sources/langue/emplacement, file/traitement/total médiane p90 p95 par rang proche. Dates manquantes/inversées exclues explicitement ; traitement/total sur runs COMPLETED seulement ; cohorts récentes immatures. Aucun taux visite→rapport, visiteur unique, gain causal ou objectif inventé. Limite 100000 runs, affichée si atteinte. Les compteurs utilisent des jours UTC, les runs une fenêtre glissante : dénominateurs distincts.

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
