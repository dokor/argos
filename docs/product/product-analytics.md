# Mesure produit interne — #42

Désactivée par défaut : backend product-analytics.enabled=false ; BFF PRODUCT_ANALYTICS_ENABLED absent. Activation exige les deux drapeaux et ADMIN_API_TOKEN côté serveur, après revue des informations publiques. Aucun fournisseur tiers ni intervention en production dans cette PR.

Accord explicite facultatif, choix accepter/refuser équivalents, retrait depuis le bouton Mesure produit. Cookie HttpOnly SameSite Strict de session, aucun identifiant de personne. Pas de localStorage, URL soumise, token, IP, email, contenu privé ou paramètre libre dans les tables de mesure. Les requêtes de lecture existantes du rapport restent nécessairement protégées par leur token ; celui-ci ne devient pas un événement.

Compteurs journaliers UTC : pages publiques fermées, exemple affiché, CTA audit, soumission rejetée (validation/service/rate_limit). Une attribution par run créé après consentement. Terminaison/échec dérivés de l’état métier, premier affichage réellement rendu dédupliqué par run. Rafraîchissements et polling ne gonflent pas les rapports consultés. Le retrait arrête les nouveaux événements du navigateur ; les états des runs déjà consentis et compteurs agrégés ne sont pas rétroactivement effacés.

Dashboard administrateur /dashboard/analytics, périodes 7/30/90 jours. Cohortes de création et sources/langue/emplacement, file/traitement/total médiane p90 p95 par rang proche. Dates manquantes/inversées exclues explicitement ; traitement/total sur runs COMPLETED seulement ; cohorts récentes immatures. Aucun taux visite→rapport, visiteur unique, gain causal ou objectif inventé. Limite 100000 runs, affichée si atteinte. Les compteurs utilisent des jours UTC, les runs une fenêtre glissante : dénominateurs distincts.

Tables propres purgées chaque heure : attributions >90 jours ; compteurs au-delà de 90 jours UTC. Cette purge ne touche aucun audit/run/rapport. Pannes de collecte sans impact sur audit ; aucune reprise ni SDK tiers. Endpoints de collecte et agrégats protégés par credential serveur ; BFF valide origine, consentement, champs fermés et corps ≤2048 octets.

Validation : tests de contrats/consentement hors collecte, percentiles/cohortes, migration MariaDB réelle en CI. Première base de comparaison à constituer après activation autorisée ; aucun résultat réel annoncé.
