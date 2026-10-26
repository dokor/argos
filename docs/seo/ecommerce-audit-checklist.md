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

## Révision du 25 octobre 2026 — distinction des intentions

La checklist conserve la méthode complète du catalogue au paiement. La page
`/ressources/audit-site-ecommerce` et sa traduction annoncent désormais une
analyse technique gratuite d’une page : leur title et leur H1 distinguent
l’outil du guide. Les URL, canoniques et alternances restent inchangées.

Le scénario de priorisation partagé avec la checklist générale est remplacé
par une erreur de variante (M sélectionné, S ajouté). La simulation locale à
la page permet de reproduire le défaut et de comparer la transmission de
l’identifiant après correction. Elle ne contacte aucune boutique et ne réalise
ni commande ni paiement. Le scénario documente reproduction, correction et
critères d’acceptation ; il ne constitue pas un test d’une boutique réelle.

Une grille accessible, avec défilement confiné sur petit écran, illustre le
suivi des constats. Les CSV FR/EN contiennent six scénarios à compléter et dix
colonnes, sans résultat ni gain présumé. Des liens contextuels relient les
étapes aux contrôles d’indexabilité, au diagnostic LCP et au guide conversion.
Shopify et conversion pointent vers les contrôles panier/paiement.

Validation : lint, 69 tests ciblés dans neuf fichiers, trois tests du contrôle
éditorial, contrôle structurel FR/EN et build Next.js réussis. Les tests de la
simulation reproduisent l’erreur puis vérifient S, M et L dans les deux langues.
Les tests serveur contrôlent les ancres, les CSV et la canonique du guide.
La recette HTTP locale vérifie 18 pages FR/EN (200, un H1, canonique propre,
absence de noindex involontaire et ancres locales valides) et les deux CSV.

Après déploiement autorisé séparément, consigner cette révision dans le suivi
Search Console : indexation et canonique choisie d’abord, puis requêtes et
pages sur des périodes comparables. Ces changements n’établissent pas la cause
de l’exclusion actuelle et ne garantissent pas une indexation.

Revue du build local : WordPress EN à 1 280 px clair et 320 px sombre, WordPress
FR à 390 et 768 px clair ; guide e-commerce FR à 1 280 et 390 px sombre, EN à
1 280 px clair, grille EN à 390 puis 320 px clair. La simulation anglaise a
également été jouée au clavier (Tab, Enter, focus visible). L’accueil et le
rapport complet fictif ont été examinés à 1 280 et 390 px clair. Aucun
débordement de page observé ; la grille de 760 px défile dans son conteneur.
Les 16 destinations avec ancre entre les pages ont été vérifiées sur les
réponses HTML. Captures locales non versionnées :
`outputs/ui-review/content-indexing/`. Aucun audit de boutique réelle,
certification d’accessibilité ou test d’installation WordPress n’est revendiqué.
