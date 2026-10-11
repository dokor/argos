# Modèle de lecture partagé du rapport

`buildReportModel(report)` est une projection pure du DTO stocké. La page FR et
son équivalent EN réutilisent la même projection pour la synthèse, la grille des
domaines, les filtres, les constats et les liens des actions. Les futurs exports
doivent utiliser `findings`, `groups`, `counts` et `priorities` de cette projection,
sans exporter seulement les éléments visibles sous le filtre courant. Aucun export
PDF n'est ajouté dans ce lot (#43).

## Identité et domaines

- `Issue.id` est la clé canonique (`AuditCheckResult.key` dans le compositeur Java).
  Un id répété conserve la première ligne, sa sévérité, ses preuves et son domaine ;
  les provenances des lignes dupliquées sont réunies. Aucun rapprochement par titre.
- Une ligne historique sans id reste un constat distinct. Sa clé positionnelle est
  stable pour ce document et évite les collisions avec les ids explicites. Elle ne
  peut pas résoudre une clé de priorité : aucune identité métier n'est inventée.
- Le domaine est le premier domaine explicite reconnu dans `categoryKey`, puis
  `categoryKeys`, puis `tags` : performance, security, seo, a11y. En cas de plusieurs
  domaines historiques, le principal explicite prévaut, sinon le premier reconnu
  dans l'ordre stocké. Aucun domaine n'est déduit du nom d'un outil ou du titre.
- Les modules et valeurs non métier restent des provenances. Sans domaine reconnu,
  le constat appartient à « Domaine non renseigné ». Chaque constat appartient à
  exactement un groupe ; la somme des groupes est le total unique.
- Les compteurs de sévérité viennent uniquement des constats uniques de
  `report.issues` (`info` est présenté comme opportunité). Les comptes stockés dans
  `scores.byCategory[].issues` ne servent plus à l'affichage de la page.
- Les quatre groupes métier existent même sans score ou sans constat. Le groupe
  inconnu apparaît s'il contient des constats. Un score absent est indisponible,
  jamais un zéro inventé. Les valeurs de score présentes ne sont pas recalculées.

## Actions et navigation

La sélection et l'ordre restent ceux de `summary.priorities` (six cartes au plus).
La résolution utilise l'union ordonnée et dédupliquée de `findingKey` et
`relatedFindingKeys`, par égalité exacte avec les ids explicites des constats.

- Résolution complète : un lien par constat unique, y compris pour une action
  regroupée. Le nombre accessible reflète les constats réellement résolus.
- Résolution partielle : les liens disponibles restent utilisables, un message
  explicite indique les membres absents.
- Aucun lien valide, ou ancienne priorité sans clé : contexte de l'action conservé,
  message FR/EN indiquant que le lien détaillé manque. Aucun repli par titre.

Dans la page, un clic enlève le filtre de sévérité incompatible, ouvre le détail,
le fait défiler et place le focus sur son `summary`. La route et la langue restent
inchangées. Les ancres sont déterministes à partir des clés, sans URL ni jeton.

## Diagnostic historique et tests

`fixtures/historical-report.json` est une reproduction synthétique anonymisée des
incohérences décrites dans #362, datée comme l'exemple historique. Ce n'est pas
une copie du rapport privé : ses données brutes ne sont pas disponibles ici.

La fixture distingue les trois couches : le document stocké contient sept lignes,
un id répété et des comptes de catégorie obsolètes ; le contrat ancien mélange
outils et domaines et omet une clé ; l'ancien rendu n'affiche que cinq entrées dans
les groupes tirés des scores. La projection affiche six constats uniques répartis
en 2/1/0/1/2, garde la note 73 et la note d'accessibilité 65. Une action sans clé
reste orpheline malgré un titre identique ; une action regroupée ne résout que ses
deux membres disponibles.

Les tests couvrent aussi le contrat actuel, les catégories vides, les ids absents
et les collisions, les priorités regroupées, la conservation des scores et
sévérités, les filtres, le focus et les compteurs du rendu. Le backend et le barème
ne changent pas ; les rapports stockés ne sont pas migrés.
