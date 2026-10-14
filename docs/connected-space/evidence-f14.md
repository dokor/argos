# F14 — Preuves collectées du diagnostic (#538)

Exigences : QA-18, UI-05, FUN-05. Ce prérequis de F13 est traité avant la
recette globale, conformément aux dépendances de `delivery-plan.md`.

## Données publiées

`Issue.structuredEvidence.observed` est optionnel. Le schéma additif
`observed-evidence-v1` contient `source` (runtime/lighthouse), `state`
(AVAILABLE/UNAVAILABLE), `items`, `inspected`, `truncated` et `redacted`.
Ce champ ne change ni score, poids, sévérité, classement, quotas ni couverture.
La projection domaine reconnaît les observations valides comme preuve disponible.
Aucune migration ou recomposition des rapports historiques : sans champ,
l’ancien rendu et son explication d’absence sont conservés.

- **Runtime** : événements `requestfailed` et réponses HTTP 5xx réellement
  observés. Maximum dix incidents retenus ; compteur de collecte et troncature
  distincts. Origine, référence de ressource, type fourni par Playwright,
  statut HTTP ou code Chromium `net::ERR_*` si disponible. La propriété
  première partie/tiers utilise le domaine final après redirection et la règle
  existante des domaines enregistrables ; sa liste compacte de suffixes ne
  constitue pas une Public Suffix List complète.
- Chaque constat ne reçoit que son sous-ensemble : échec réseau du site,
  réponse 5xx du site ou incidents tiers. Les ressources les plus lourdes ne
  sont plus présentées comme si elles étaient les endpoints en erreur.
- **Lighthouse** : parcours des conteneurs de détails connus (`items`, `node`,
  `subItems`, `value`, `source`, `location`). Ressources effectivement fournies
  et chemins DOM structurels `index,TAG` effectivement produits par Lighthouse.
  Dix observations dédupliquées maximum, profondeur six et 400 entrées inspectées.
  Les structures non reconnues ne sont pas converties en preuve fictive.

`inspected` désigne les événements réseau examinés pour Runtime et les
entrées parcourues pour Lighthouse (y compris celles non exploitables) ; ce n’est ni un décompte d’éléments
uniques de la page, ni le dénominateur d’un taux. L’échantillon Runtime est
filtré après collecte : l’absence de détail pour un constat ne signifie pas
qu’il n’existe aucune ressource concernée.

## Confidentialité et limites explicites

La politique existante conserve **l’origine seulement** des URL. Les entrées
URL de plus de 2 048 caractères et les origines de plus de 512 caractères
sont écartées avant projection. F14 ne
réintroduit pas les chemins privés, userinfo, query ou fragments. Une référence
hexadécimale de 16 caractères (préfixe SHA-256 origine + chemin, sans userinfo,
query ou fragment) distingue les ressources ; ce n’est pas un lien navigable,
un secret d’accès ni un identifiant global garanti sans collision. Les chemins
restent à retrouver dans le diagnostic source ou les outils du navigateur.

Les sélecteurs contenant ID/classes/valeurs d’attribut, snippets HTML, texte DOM,
messages d’erreur libres, en-têtes, cookies et piles ne font pas partie du
contrat. Les seuls emplacements DOM conservés sont des chemins structurels
bornés ; shadow DOM, iframes et autres formes non reconnues peuvent rester
indisponibles. Aucun élément HTML n’est reconstruit depuis un compteur.
L’initiateur précis du script n’est pas collecté et le rendu le dit.

Les observations sont assainies à la sortie des collecteurs, validées de
nouveau par une liste de champs/types autorisés en Java, puis traversent la
barrière de sérialisation existante. Le rendu utilise du texte échappé, jamais
`innerHTML` ni de liens vers les ressources. Un résultat absent ou entièrement
filtré est explicitement indisponible ; la troncature est visible.

## Web, PDF et preuve de recette

Le composant `ObservedEvidence` est commun au détail interactif et au PDF
complet. Le PDF de synthèse conserve son périmètre résumé sans détails de
chaque constat. FR/EN, contexte connecté, footer et styles existants conservés.

- Collecteurs : URL sensibles, déduplication Lighthouse, bornes, type de preuve,
  absence explicite ; contrat HTTP Runtime avec attribution finale et code réseau.
- Java : parsing, association aux bons constats, persistance/sanitisation,
  composeur et projection domaine ; les anciennes mesures restent distinctes.
- Frontend : même contenu/limites dans le composant et le PDF, anciens rapports,
  absence et états tronqués.
- `connected-evidence.mjs` : 32 cas (390/1056 × FR/EN × clair/sombre × quatre
  états), ouverture/fermeture clavier, titres/footer, overflow et scan axe.
  Huit captures des chemins DOM et deux contrôles de largeur supplémentaires
  à 320/768 en EN sombre. Fixtures visuelles explicitement fictives, sans prétention de preuve serveur.
- `ControlledAuditE2eIT` / `browser.mjs` : vrais collecteurs sur page isolée,
  événement HTTP 503, preuve DOM Lighthouse, transport Java, publication en
  MariaDB, absence de paramètre sensible et deux PDF complets FR/EN.

Le harness HTTP local désactive uniquement dans sa configuration de lancement
les upgrades HTTPS automatiques de Chromium : il ne possède volontairement
aucun endpoint TLS. Les protections réseau et les flags de production restent
identiques ; les assertions exigent de vraies observations Runtime et Lighthouse.

Captures et PDF vont dans l’artefact CI `connected-evidence-<sha>`, pas dans la
référence figée. Résultats au SHA et limites d’exécution dans la PR. La revue
ciblée ne remplace pas F13, une certification WCAG, une recette avec fournisseurs
réels ou une vérification humaine de toutes les causes proposées par les outils.
Aucune fusion, réinitialisation de base ou mise en production dans ce lot.
