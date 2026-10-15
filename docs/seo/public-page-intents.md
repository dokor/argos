# Intentions des pages publiques

La home lance l'outil ; les guides expliquent une démarche ou un résultat.
Les intentions ci-dessous sont des hypothèses éditoriales, sans volume de recherche,
rang ni effet commercial démontré. Les routes listées sont présentes dans le dépôt
au 12 octobre 2026 ; cela ne constitue pas une vérification de leur déploiement.

| Page ou famille FR | Intention | Parcours attendu |
| --- | --- | --- |
| / | Lancer un audit transversal gratuit d'une URL publique | Formulaire, exemple, ressources |
| /exemple-rapport | Comprendre constats, preuves et corrections | Exemple fictif, méthode, audit |
| /faq | Répondre aux questions de fonctionnement | Méthode, exemple, contact |
| /ressources | Choisir une ressource | Guides publiés, exemple puis formulaire |
| /ressources/audit-technique-gratuit | Comprendre le périmètre d'un audit automatique | Checklist, méthode, audit |
| /guides/checklist-audit-site-web | Vérifier soi-même une page | Exemple, méthode, formulaire contextualisé |
| /ressources/audit-site-pme | Préparer un brief de corrections | Exemple PME, checklist, audit |
| /ressources/audit-site-ecommerce | Examiner une fiche produit publique | Exemple commerce, limites du parcours, audit |
| /methodologie-score | Interpréter score, couverture et limites | Preuves, exemple, audit |
| /ressources/accessibilite-numerique | Comprendre le contexte français et les limites automatiques | Checklist, méthode, contrôles humains |
| /test-vitesse-site-web | Lire les mesures de laboratoire disponibles | Méthode, exemple, audit transversal |
| /analyse-seo-page | Vérifier title, description, canonical et H1 | Checklist, exemple, audit |
| /verifier-entetes-securite | Interpréter les en-têtes HTTP | Références, checklist, audit |
| /test-accessibilite-site-web | Comprendre un constat automatique et ses limites | Ressource réglementaire, checklist, audit |

À propos, confidentialité et informations légales apportent identité et confiance.
Leurs objectifs ne justifient pas une nouvelle page d'acquisition générique.

## Routes, textes et langues : une seule source

Les titres, descriptions, H1 et canonical vivent dans les pages, pas dans un second
inventaire à synchroniser. Les traductions complètes sont déclarées dans
[languageRoutes](../../apps/console-web/src/lib/i18n/routes.ts), puis reprises par
les métadonnées et le sitemap. Voir le [contrat anglais](english-public-guides.md)
et les [pages d'acquisition](acquisition-page-contract.md). Aucun hreflang vers un
texte non traduit, une route absente ou une redirection vers l'accueil.

Vérifier le HTML initial FR/EN (title, description, canonical, alternates, OG et
Twitter), puis la réciprocité des langues, le sitemap et robots.txt. Les anciennes
copies du HTML de la home et matrices JSON sont des résultats datés dans Git ; les
nouveaux relevés vont dans les artefacts de recette.

## Suivi

À réception de Search Console, relever par page canonique, pays/langue et requête :
période de 28 jours et précédente, impressions, clics, CTR, position moyenne et
effectifs. Distinguer marque/non-marque ; ne pas additionner des moyennes sans
pondération. Examiner cannibalisation et snippets avant fusion ou redirection.
Suivre le formulaire avec la [mesure interne](../product/product-analytics.md)
uniquement si activée et qualifiée. Voir aussi le [suivi checklist](checklist-audit-site-web.md).
