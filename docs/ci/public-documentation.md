# Documentation développeur publique — #742

Pages proposées en PR : /docs et /en/docs, puis auth, domains, github, gitlab,
issues, api, errors, usage et changelog sous ces préfixes. Ces routes sont
publiques et indexables, avec canonical/hreflang et sitemap. Elles ne lancent
aucun audit et ne changent aucun droit. **premium-ci.enabled reste false
jusqu’à la recette complète #467** ; la livraison de code n’est pas un déploiement.

La composition reprend la maquette développeur validée : navigation publique,
recherche locale dans les rubriques, article central, sommaire latéral/accordéon
mobile, exemples copiables et erreurs filtrables avec ancres stables. Les
ancres suivent exactement le client #741 (minuscules, underscores devenant
tirets). Les liens du compte #464 sont maintenant localisés vers ces pages.

## Sources et entretien

- Prose FR/EN : src/components/docs/content.ts dans console-web. Ne pas reprendre
  les anciennes routes/profils fictifs de la maquette.
- Erreurs : ci-error-catalog.json existant, issu du catalogue Java contrôlé ;
  jamais de texte reçu d’une exception ou d’une réponse de fournisseur.
- Modèles : ci-integration-templates.json existant, partagé avec le compte.
  Le modèle GitLab de publication remplace le standard ; PREVIEW réutilise
  les variantes de lecture seule vérifiées, pas simplement un changement de
  mode JSON avec les permissions de SYNC.
- OpenAPI : docs/ci/openapi-v1.json, recopié à l’identique dans le contexte
  autonome frontend (import pour la référence, public/docs pour le téléchargement).
  Mettre à jour avec node scripts/contracts/sync-ci-public-docs.mjs ;
  vérifier avec --check. La copie publique ne contient aucun credential.
- Installation : commit complet et SHA-256 de la distribution indépendante,
  vérifiés contre les modèles et le fichier distribué. Aucune dépendance npm
  ou Action publique Argos inventée.

Les exemples restent inertes : aucune zone de saisie de clé, exécution,
exploration API, télémétrie de copie ou envoi au support. La copie ne transmet
que l’exemple affiché au presse-papiers et expose un échec contrôlé. La
recherche reste en mémoire, sans query de navigation, stockage persistant ou
service de recherche externe. Les mécanismes de consentement du shell public
restent indépendants ; les docs n’ajoutent aucun événement de mesure.

## Vérification reproductible

- npm test, npm run lint et npm run build dans apps/console-web.
- node --test scripts/ci/public-docs.test.mjs : parité OpenAPI/modèles,
  SHA-256, syntaxe shell/Node sans exécution des exemples.
- DOCS_BASE_URL=http://127.0.0.1:3020 node scripts/e2e/developer-docs.mjs,
  après build/start Next avec API_BASE cohérent au build et au démarrage.
  Le harnais utilise uniquement des données fictives, intercepte les routes
  du shell public et refuse tout appel CI ou externe. Il vérifie lecture
  anonyme, FR/EN, thèmes, 320/390/768/1440 px, recherche, filtres, clavier,
  ancres exactes du client, copie des modèles complets, métadonnées et JSON.
- La suite docs est un groupe dédié de Visual regression ; captures et résultats
  sont joints aux artefacts de la révision CI. Le contrôle du header public
  couvre aussi le nouveau lien Développeurs et son seuil responsive.

La revue automatique ne démontre ni conformité WCAG complète, ni utilisation
avec lecteur d’écran, ni recette des plateformes hébergées. Aucun exemple
n’autorise la désactivation TLS/SSRF/isolation/provenance ou le partage des
secrets à un contributeur non fiable.
