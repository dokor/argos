# Guide d’audit e-commerce

Les premières requêtes Search Console autour d’« audit site e-commerce » donnent
une piste éditoriale. Leur faible volume et quelques jours d’observation ne
permettent pas d’estimer la demande ou de promettre des clics supplémentaires.
Les variantes avec ou sans espace ou trait d’union sont traitées dans un seul
article, sans pages distinctes pour chaque graphie.

- FR : `/guides/checklist-audit-ecommerce`
- EN : `/en/guides/ecommerce-audit-checklist`
- Première version et traduction : 19 octobre 2026, date du texte dans le dépôt.
- Auteur : Antoine Le Louët, signature éditoriale existante, lien vers À propos.

La page `/ressources/audit-site-ecommerce` conserve son rôle de diagnostic d’une
URL publique. Le nouveau guide répond à une intention de méthode : choisir un
échantillon, vérifier catalogue, variantes, vitesse, panier et paiement, garder
les preuves, puis prioriser. Il complète la checklist technique générale et la
page Shopify. La page e-commerce, la checklist générale et l’index des ressources
pointent vers le guide ; le guide propose les lectures complémentaires et un
formulaire d’audit public.

Les deux langues sont rendues dès le serveur, avec canoniques propres,
hreflang réciproques, sitemap et schéma Article utilisant le composant JsonLd
commun avec nonce CSP. Les dates sont stables dans `lib/editorial.ts`.

Les sources Google Search Central, web.dev et W3C WAI liées dans l’article ont
été consultées le 19 octobre 2026. L’exemple de boutique est explicitement
fictif. Aucun chiffre de conversion, gain commercial ou audit client n’est
inventé. Les limites du diagnostic d’une URL, des mesures de laboratoire, du
balisage Product et des scores automatiques sont expliquées dans le texte.

Après publication, utiliser l’onglet Pages de Search Console pour vérifier
quelle URL reçoit les impressions de ces requêtes, puis suivre le guide et
la page de diagnostic sur des périodes comparables. Distinguer indexation,
impressions, position et clics ; une variation isolée n’établit pas l’effet
causal de l’article. Aucune fusion ni mise en production ne fait partie de
cette livraison.

## Vérification de la livraison

`npm run lint`, `npm test` (139 fichiers / 1 233 tests, plus les trois tests
éditoriaux) et `npm run build` passent. Le test existant du catalogue de
ressources attend désormais 18 cartes et contrôle la destination anglaise du
nouveau guide.

Le build de production local a été examiné dans le navigateur intégré : guide
FR/EN, thèmes clair/sombre, largeurs 1 280, 768, 390 et 320 px, sommaire,
changement de langue et focus du formulaire. Les liens depuis les ressources
et la page e-commerce ont été suivis. L’accueil et un rapport fictif complet
ont aussi été contrôlés à 1 280 et 390 px. Aucun débordement horizontal observé
sur le guide ; aucune certification d’accessibilité n’en est déduite.

Les réponses HTTP des deux guides ont été contrôlées : 200, un H1, canonique
propre, hreflang réciproques, absence de noindex, présence au sitemap et nonce
CSP sur le schéma Article. Captures et note de revue locales, non versionnées :
`outputs/ui-review/ecommerce-guide/`.
