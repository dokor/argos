# Page publique des offres et tarifs

Routes : `/tarifs` et `/en/pricing`, sans connexion. Liens dans la navigation et le
pied de page communs, métadonnées localisées et alternates réciproques dans le sitemap.
La livraison du code ne vaut pas publication en production.

## Offres présentées

- Sans compte : audit manuel d'une URL publique, scores et synthèse, gratuit.
- Compte gratuit : rapports détaillés sous compte vérifié, sites, URL, historique
  et partage contrôlé. Aucun quota numérique gratuit ou illimité n'est promis.
- Premium CI : 19 EUR HT/mois ou 199 EUR HT/an, payés en une fois pour l'année.
  Économie annuelle de 29 EUR, soit 12,7 % sur douze mensualités ; équivalent
  mensuel arrondi à 16,58 EUR HT. Exemples avec TVA à 20 % : 22,80 EUR TTC/mois
  et 238,80 EUR TTC/an. Le TTC applicable dépend de la situation fiscale du client.
  Les six flags de lancement restent fermés ; le CTA reste la liste d'attente.

Les limites Premium reprennent les décisions de l'epic #731 : trois clés, trente
analyses par mois et par intégration stable, domaines vérifiés illimités, un audit
simultané par compte et durée de clé d'un an au maximum. La rotation ne recrée pas
le budget. Deux mesures publiées consomment deux analyses : jusqu'à quinze contrôles
confirmés par intégration en l'absence d'autre consommation. Les budgets ne sont
pas présentés comme un pot commun de 90 analyses transférables.

La création d'issues est facultative et nécessite les permissions de la destination
et le journal Azure privé de cette version, avec d'éventuels coûts externes distincts.
Les actions publiques mènent à l'audit gratuit, à l'inscription gratuite ou à la liste
d'attente Premium déjà existante, avec consentement explicite. Aucune ressource Stripe,
aucun paiement, droit ou appel fournisseur n'est créé par cette page. Les quotas restent
mensuels avec les deux périodicités ; l'annuel ne donne pas un budget consommable
en une seule fois. Les montants frontend partagés sont contrôlés contre les montants
backend de `reference.conf` par `premium-pricing.test.ts`.

La priorité Premium prévue à l'ouverture est relative : elle ne promet aucun délai,
n'interrompt pas les analyses en cours et ne contourne ni admission, quota, ni capacité.
Elle reste désactivée jusqu'à #467. Voir [politique de file](../ci/quotas.md#priorité-premium-relative).

La carte Premium, le comparatif et la FAQ annoncent une recherche jusqu’à 500 URL
par domaine et une profondeur de 5, contre 50 et 3 avec un compte gratuit.
Cette couverture aide à repérer les fiches produit, articles et pages profondes
avant de sélectionner les audits. La découverte ne consomme pas de crédit et
ne promet pas 500 audits : les URL exclues comptent dans le plafond, et les
budgets de temps, règles robots et limites opérateur restent applicables.

## Statuts expliqués

Le guide public distingue l'offre, l'état du compte et les sept états de facturation :
NONE, ACTIVE, CANCEL_AT_PERIOD_END, PAYMENT_REQUIRED, ENDED, REFUNDED, DISPUTED.
Le contenu est un glossaire, pas le statut personnel du visiteur. Il ne charge pas
de snapshot de facturation privé. Le lien « Mon compte » de la navigation conserve
son contrôle de session existant ; le lien de gestion de facturation reste protégé
par le parcours de compte.

Les explications des remboursements et litiges décrivent la politique conservatrice
prévue. Les tarifs sont arrêtés ; les modalités commerciales/fiscales et la recette #467 restent à valider
avant ouverture ; une inscription sur la liste d'attente ne donne aucun droit.

## Composition et références

Trois cartes d'offres, un tableau comparatif, une explication du comptage, un glossaire
et une FAQ. Les deux prix et leur économie sont calculés depuis les mêmes montants.
Pas d'essai limité ni de badge « le plus populaire » sans données.

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
