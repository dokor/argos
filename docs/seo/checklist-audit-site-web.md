# Suivi après publication — checklist d’audit de site web (#301)

La page canonique est `/guides/checklist-audit-site-web`. Les formulations SEO de l’issue sont des hypothèses tant que les données de Search Console n’ont pas été consultées. Ne pas inventer de volume de recherche.

## Après mise en ligne

1. Vérifier que l’URL finale renvoie la page attendue, que son HTML contient le H1 et la canonical, que `robots.txt` l’autorise et que `/sitemap.xml` la liste. Inspecter l’URL dans Search Console pour voir la canonique choisie et l’état d’indexation.
2. Dans le rapport **Performances** de Search Console, filtrer sur l’URL exacte de la page. Relever chaque semaine impressions, clics, CTR et requêtes. Examiner notamment `checklist audit site web`, `checklist audit technique site web`, `comment auditer un site web`, `audit SEO technique étapes`, `audit performance site web` et `vérifications sécurité site web`, sans supposer qu’elles génèrent déjà du trafic.
3. Compter dans les logs serveur du BFF les événements `audit_bff_backend_response_ok` dont `details.sourceRoute` vaut `/guides/checklist-audit-site-web`. Ils correspondent aux créations d’audit réussies depuis le formulaire en fin de guide. Le champ est limité à cette route et n’est pas transmis au backend Java. Vérifier que `APP_LOGS_ENABLED` n’est pas désactivé en production. Comparer ce nombre aux clics organiques comme repère, sans le traiter comme un taux de conversion exact : des visiteurs peuvent venir d’autres canaux ou bloquer la mesure.

## Liens à compléter

La page pointe aujourd’hui vers la ressource existante qui explique les résultats et vers la FAQ qui décrit le rapport privé. Quand la [méthodologie du score (#300)](https://github.com/dokor/argos/issues/300) et l’[exemple de rapport (#69)](https://github.com/dokor/argos/issues/69) seront publiés, remplacer ces liens par leurs nouvelles routes publiques et vérifier qu’elles répondent avant déploiement.
