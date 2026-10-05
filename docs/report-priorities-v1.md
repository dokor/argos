# Classement des priorités — priority-impact-v1 (#250)

## Contribution, pas promesse de résultat

Le classement lit les contributions déjà calculées par `ScoreService`.
Pour un check scorable de poids positif : `loss = weight - score`,
bornée de 0 au poids. Le `score` inclut le ratio continu effectif ;
aucune seconde implémentation du barème n'est introduite.

`domainScoreGain = 100 × loss / domaine.maxScore`.
`globalScoreGain = domainScoreGain × poids_effectif_du_domaine`.
Le poids effectif vient du snapshot, après renormalisation des domaines
mesurables de V10 (#249). Ce gain est le maximum du modèle si ce check
atteint un ratio de 1, avec les autres mesures et dénominateurs constants.
Une correction réelle peut changer plusieurs mesures, leur applicabilité et
le dénominateur : le résultat d'un nouvel audit n'est pas garanti.

Un finding de poids nul reste actionnable, mais ses trois valeurs de gain
sont null et son motif est `NO_DIRECT_SCORE_GAIN`. Sans trace scorée,
domaine ou coefficient fiable, le motif est `SCORE_UNAVAILABLE` et aucun
gain global n'est inventé. Une ancienne composition globale n'est pas
recalculée sous V10.

## Ordre déterministe et informations explicites

Le tri est lexicographique : gain global décroissant (null traité comme
absence de gain), puis gravité critical/important/info, confiance
HIGH/MEDIUM/LOW/UNKNOWN, effort XS/S/M/L/inconnu, domaine, cause, finding et
module. La version du classement est indépendante de `scoringVersion`.
La gravité demeure visible même lorsqu'une contribution supérieure fait
passer une action moins sévère devant une autre. Les actions sans gain sont
classées par gravité et les mêmes départages.

La confiance accepte uniquement `check.details.measurementConfidence`
HIGH/MEDIUM/LOW, sinon UNKNOWN. Le nombre de sources ne prouve pas la
fiabilité d'une mesure. Le travail de couverture/confiance #48 reste
distinct : les analyzers actuels sans métadonnée explicite produisent UNKNOWN.
L'effort accepte uniquement `check.details.estimatedEffort` XS/S/M/L ;
sinon il reste null, y compris pour les issues détaillées. Aucune durée,
confiance ou estimation d'effort n'est inférée de la seule sévérité.

## Causes racines connues

Les clés canoniques HTTP regroupent déjà les alertes ZAP correspondantes
via `CheckMergerService` ; la priorité conserve toutes leurs sources.
Une cause occupe une place au maximum, six causes sont retenues.

Pour Observatory, les `failedPolicies` connues sont reliées exactement à
CSP, HSTS, X-Frame-Options, X-Content-Type-Options et Referrer-Policy.
Quand **toutes** les politiques en échec ont un finding HTTP/ZAP
actionnable correspondant, l'agrégat Observatory ne prend pas une place
supplémentaire. Sa source et son identifiant corroborent les actions liées.
Sa perte de score n'est pas attribuée arbitrairement aux en-têtes : le
gain de chaque action reste celui de son check représentatif.

Si la liste est absente/vide, contient une politique inconnue ou un
finding absent, l'agrégat reste une action distincte. Les titres, textes et
l'ensemble de la catégorie Sécurité ne servent jamais à déduire une cause.
Cette règle est un regroupement de symptômes connus, pas une preuve
d'équivalence de périmètre entre les outils.

## Contrat et présentation

Chaque priorité expose `findingKey`, `categoryKey`, `rootCauseKey`,
`relatedFindingKeys`, `sources`, `rank`, `rankingVersion`,
`rankReason`, `confidence` et les contributions optionnelles.
La carte FR/EN explique le motif, le gain théorique, la confiance inconnue,
les constats regroupés et les limites du modèle.

Les champs ajoutés restent optionnels pour les anciens rapports persistés ;
les anciennes cartes et efforts sont lus tels quels. Les compteurs du
Hero continuent à lire `issues`, la liste détaillée conserve les findings,
et les cartes lisent uniquement `summary.priorities`.

## Validation ADE 1.2.1

Perspectives Tech Lead, Backend, Frontend, UX, QA et Security. Les tests
couvrent gain supérieur à sévérité moindre, poids effectifs d'un domaine
partiel, ratio continu, poids nul, égalités, confiance/effort explicites,
groupement multi-source, causes inconnues, ordre permuté, plafond de six
et compatibilité JSON historique. Le classement ne fait aucun appel
réseau, n'ajoute aucun collecteur ni contenu DOM aux preuves publiques.
