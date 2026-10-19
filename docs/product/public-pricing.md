# Page publique des offres et tarifs

Routes : `/tarifs` et `/en/pricing`, sans connexion. Liens dans la navigation et le
pied de page communs, métadonnées localisées et alternates réciproques dans le sitemap.
La livraison du code ne vaut pas publication en production.

## Offres présentées

- Sans compte : audit manuel d'une URL publique, scores et synthèse, gratuit.
- Compte gratuit : rapports détaillés sous compte vérifié, sites, URL, historique
  et partage contrôlé. Aucun quota numérique gratuit ou illimité n'est promis.
- Premium CI : à venir, aucun Checkout proposé. Les montants restent à décider :
  affichage prévu en EUR HT avec mention TTC, mensuel/annuel et réduction annuelle
  sans taux inventé. Les six flags de lancement restent fermés.

Les limites Premium reprennent les décisions de l'epic #731 : trois clés, trente
analyses par mois et par intégration stable, domaines vérifiés illimités, un audit
simultané par compte et durée de clé d'un an au maximum. La rotation ne recrée pas
le budget. Deux mesures publiées consomment deux analyses : jusqu'à quinze contrôles
confirmés par intégration en l'absence d'autre consommation. Les budgets ne sont
pas présentés comme un pot commun de 90 analyses transférables.

La création d'issues est facultative et nécessite les permissions de la destination
et le journal Azure privé de cette version, avec d'éventuels coûts externes distincts.
Les actions publiques mènent à l'audit gratuit, à l'inscription gratuite ou à la liste
d'attente Premium déjà existante, avec consentement explicite. Aucun nouveau prix,
paiement, droit ou appel fournisseur n'est créé par cette page.

## Statuts expliqués

Le guide public distingue l'offre, l'état du compte et les sept états de facturation :
NONE, ACTIVE, CANCEL_AT_PERIOD_END, PAYMENT_REQUIRED, ENDED, REFUNDED, DISPUTED.
Le contenu est un glossaire, pas le statut personnel du visiteur. Il ne charge pas
de snapshot de facturation privé. Le lien « Mon compte » de la navigation conserve
son contrôle de session existant ; le lien de gestion de facturation reste protégé
par le parcours de compte.

Les explications des remboursements et litiges décrivent la politique conservatrice
prévue. Les modalités commerciales/fiscales, tarifs et recette #467 restent à valider
avant ouverture ; une inscription sur la liste d'attente ne donne aucun droit.

## Composition et références

Trois cartes d'offres, un tableau comparatif, une explication du comptage, un glossaire
et une FAQ. Pas de faux prix, de remise chiffrée, d'essai limité, de badge « le plus
populaire » sans données ou de sélecteur de périodicité sans montant à comparer.

Conventions observées dans les pages officielles de
[Linear](https://linear.app/pricing) et [Checkly](https://www.checklyhq.com/pricing/) :
offres accessibles d'abord, comparaison explicite des fonctions, périodicité annoncée
et réponses aux questions de facturation. Le texte et le rendu restent propres à Argos,
avec SCSS Modules, tokens sémantiques, langues FR/EN et thèmes clair/sombre.

## Vérification

`PricingPage.dom.test.tsx` vérifie les parcours publics sans appel de facturation,
l'absence de Checkout, le consentement non coché, les liens localisés, le glossaire,
le rendu serveur, les canonicals et le sitemap. Les autres contrats de navigation
et d'inscription Premium restent couverts par leurs suites existantes.

`scripts/e2e/public-pricing.mjs`, dans le groupe visuel `public`, vérifie six largeurs
(320, 390, 768, 1056, 1182, 1440), deux langues et deux thèmes : alignement des CTA,
défilement du tableau au clavier, focus visible, FAQ, ancres sous l'en-tête, absence
de débordement de page, de mutation et d'appel fournisseur, contrôles axe automatisés.
Le harnais `public-header.mjs` inclut également les deux nouvelles routes.
Captures et résultats : `outputs/ui-review/public-pricing/`.
