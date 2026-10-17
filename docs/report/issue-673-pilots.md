# #673 — Diagnostic et quatre fiches pilotes, lot 1

Diagnostic du 17 octobre 2026, base `main` à `3122361d`. Ce document accompagne une
livraison partielle de #673. Il ne constitue pas une recette humaine et ne ferme
pas l’issue. Les observations de production et leur fréquence n’ont pas été
consultées. Les exemples et rapports de recette de ce lot sont fictifs.

## État de départ et couverture vérifiable

La PR #685 a livré les guides bilingues, les exemples étiquetés fictifs, les
replis et le partage de `FindingGuide` entre rapport indépendant, rapport privé,
rapport partagé et PDF complet. Les synthèses utilisent `findingContent`.

- [Inventaire statique](rule-inventory.md) : 75 clés de producteurs/policy,
  dont 57 avec fiche spécifique et 18 avec repli. Il inclut les stubs de
  disponibilité et contrôles informatifs, pas seulement des constats publiés.
- Catalogue : 86 identifiants de guides spécifiques, dont des identifiants
  historiques. Une fiche présente ne prouve pas sa qualité ni sa validation.
- [Inventaire Lighthouse](lighthouse-rule-inventory.json) : 156 identifiants
  configurés dans les quatre catégories de Lighthouse **13.5.0**, dont 27 avec
  guide spécifique et 129 avec repli explicite. Il est extrait de la configuration
  du paquet réellement installé et vérifie la version déclarée par le service.
  Ce sont des **candidats**, pas 156 constats effectivement émis : le résultat doit
  avoir un mode `binary`, `numeric` ou `metricSavings`, un score sous 0,9, et être
  retenu parmi au plus 12 diagnostics. Les résultats manuels, informatifs,
  indisponibles et réussis ne deviennent pas des constats.
- ZAP : `10038` est notamment projeté vers `http.security.csp`. Les autres
  `zap.alert.<pluginId>` restent un ensemble ouvert lié aux règles du service
  interrogé ; sa version et ses règles installées ne sont pas connues ici. Le
  repli ne vaut pas une fiche spécifique relue.

Les deux inventaires se complètent et ne s’additionnent pas en un nombre de
constats uniques. La couverture des **émissions réellement observées** sur un
panel autorisé et la recette exhaustive restent à réaliser. Les tests de ce lot
exercent les producteurs des quatre pilotes avec des entrées contrôlées.

## Matrice des quatre pilotes

| Famille et identifiants | Détection réellement appliquée | Faits disponibles | Écart constaté et réponse du lot |
| --- | --- | --- | --- |
| Titre — `html.title` | Texte du titre extrait du HTML reçu ; zéro → FAIL ; longueur < 10 ou > 80 → WARN. Bornes heuristiques Argos. | Longueur, statut ; le titre brut ne fait pas partie du nouvel instantané. | Ancienne fiche liée à la documentation des snippets, méthode actuelle attribuable à tort à l’historique. Référence corrigée vers les titres ; distinguer absent/vide, court et long ; figer longueur et bornes à la production. |
| Images — `html.images.alt_coverage` | Compte les img sans attribut alt. Alt vide accepté. Toute absence → WARN ; pourcentage arrondi ≤ 20 → sévérité faible, sinon moyenne. Zéro image → INFO, hors constats publiés. | `imgCount`, `imgAltMissingCount`, ratio arrondi ; aucun emplacement exact, aucune fonction sémantique établie. | Un compteur ne permet pas de retrouver une image ou de la qualifier d’informative. Fiche avec recherche dans la réponse HTML, distinction décoration/information/action et vérification humaine ; limites explicites sur le DOM modifié par JS. |
| CSP — `http.security.csp` | HTTP : état de Content-Security-Policy de la réponse finale et sous-ensemble reconnu de script-src/default-src. ZAP peut émettre la même clé selon sa règle 10038. | HTTP : absent, vide, configuration reconnue/non reconnue ; source effective issue de la fusion. La nouvelle preuve ne conserve ni politique brute, ni nonce, ni URL. | Le guide était choisi par clé malgré des méthodes différentes ; les détails d’une autre source pouvaient se fusionner. L’instantané appartient uniquement à l’observation sélectionnée. Une alerte ZAP ne reçoit pas la méthode HTTP. Distinguer Report-Only et application effective. |
| LCP — `lighthouse.audit.largest-contentful-paint` | Sélection Argos selon le score normalisé, tri par poids de catégorie puis score, plafond 12. Durée uniquement si numericValue et unité explicite. | Score, critère de sélection, version Lighthouse si fournie ; numericValue/numericUnit optionnels ; observations bornées éventuelles. | Durée, diagnostic et cause doivent rester distincts. Fiche d’investigation par phases, répétition au même profil, aucune ressource ou cause devinée. |
| Variantes LCP — `lighthouse.audit.lcp-discovery-insight`, `lighthouse.audit.lcp-breakdown-insight` | Même sélection Argos, diagnostics respectivement de découverte et de décomposition. | Détails numériques éventuels propres au diagnostic, pas automatiquement la durée totale LCP. | Les trois clés partageaient le même guide. Guides séparés : début de découverte vs phase coûteuse ; ne jamais présenter un gain estimé comme le LCP mesuré. |

Sources de vérité : `HtmlModuleAnalyzer`, `HttpModuleAnalyzer` et
`SecurityHeaderValidation`, `LighthouseModuleAnalyzer`, puis `CheckMergerService`
et `ReportEvidence`. Les seuils numériques affichés pour un pilote versionné
proviennent de son instantané, pas de nombres recopiés dans le composant.

## Contrat de données ajouté

`Issue.structuredEvidence.detection` est optionnel :

```json
{
  "version": "finding-detection-v1",
  "ruleKey": "html.title",
  "ruleVersion": "html-title-v1",
  "source": "html",
  "scope": "RECEIVED_HTML",
  "result": "SHORT",
  "values": { "length": 3, "minimum": 10, "maximum": 80 }
}
```

Cet exemple est fictif. Les producteurs attachent cet instantané avant fusion et
publication. Il ne contient que des codes bornés et des nombres finis autorisés.
`toolVersion` conserve seulement une version numérique Lighthouse réellement
fournie. Aucun HTML, sélecteur libre, contenu d’image, en-tête brut, chemin,
paramètre, token ou message tiers n’est ajouté pour obtenir plus de précision.

La projection vérifie clé et source effective. La fusion n’emprunte pas
l’instantané d’une observation secondaire. Les instantanés inconnus ou incohérents
ne servent pas à affirmer une méthode. Ils ne sont pas dupliqués dans la preuve
textuelle historique. La lecture n’en reconstruit jamais un depuis la version
actuelle des analyseurs.

Trois versions indépendantes restent distinctes : catalogue éditorial
`report-content-v6`, schéma d’explication `finding-detection-v1` et révision de
règle (`html-title-v1`, `html-image-alt-v1`, `http-csp-v1`,
`lighthouse-audit-selection-v1`). Le contrat de mesure `analysis-measurements-v4`
et la policy V13 sont inchangés : aucune règle, unité, valeur, poids, sévérité ou
sélection n’est modifiée par ce lot. Il n’y a ni migration SQL ni réécriture des
rapports historiques. Un changement de sémantique devra réviser règle et contrat
de mesure selon sa portée.

`findingExplanation` applique les variantes de source et les faits enregistrés ;
`findingContent` et `FindingGuide` le réutilisent pour éviter une divergence
entre observation, plan d’action, détails et PDF. Une méthode absente ou future
conserve une correction prudente sans recevoir les bornes actuelles. L’exemple
de code, lorsqu’il existe, est toujours marqué fictif et ne décrit pas le site.
Le plan d’action utilise un résumé court ; les étapes complètes restent dans la
fiche, pour éviter leur répétition dans le PDF. Un compteur ou un état d’en-tête
ne reçoit pas un message de mesure scalaire indisponible : l’absence d’un nombre
unique ne signifie pas l’absence de preuve.

## Besoins restants et priorité proposée

| Priorité | Besoin | Limite actuelle / prochain lot |
| --- | --- | --- |
| P1 | Recette réelle sur les quatre domaines | Faire reformuler problème, preuve, action et résultat attendu par un propriétaire et un développeur ; corriger avant extension. |
| P1 | Fréquence réelle et couverture des émissions | Utiliser les agrégats existants de statistiques de problèmes et un panel autorisé. Ne pas utiliser le nombre de clés du catalogue comme fréquence. |
| P1 | Autres règles Lighthouse candidates et alertes ZAP | Prioriser celles réellement observées ; fiches distinctes ou repli documentant les données manquantes. L’inventaire de configuration ne remplace pas la lecture d’un résultat. |
| P2 | Localisation HTML et détail des phases LCP | Étudier des emplacements structurels bornés et des durées de phases typées, après vérification de confidentialité ; aucune réintroduction de snapshots bruts ou de chemins privés. |
| P2 | Version/méthode exacte des autres producteurs | Étendre l’instantané uniquement depuis leurs faits réels, avec tests de source, historique et unités. Les versions historiques inconnues le restent. |
| P2 | Méthode CSP ZAP | Conserver à terme version du service, révision du plugin et périmètre réel ; le pilote explique aujourd’hui honnêtement cette absence. |

Cette priorité est qualitative ; aucune statistique de production n’est supposée.

## Critères éditoriaux et références vérifiées

Pour chaque pilote : observation factuelle indépendante de l’impact ; portée
limitée au chargement et à la source mesurés ; étapes situant où agir et ce qu’il
faut vérifier ; résultat reproductible séparé d’une hausse du score ; exemple
adaptable seulement si utile ; aucune stack supposée. La présence d’un champ ou
la longueur d’un texte ne prouvent pas sa clarté.

Références primaires consultées le 17 octobre 2026 :

- [Google Search Central — titres](https://developers.google.com/search/docs/appearance/title-link) : titre descriptif propre à la page, sans borne universelle en caractères.
- [W3C WAI — arbre de décision alt](https://www.w3.org/WAI/tutorials/images/decision-tree/) : alternative selon information, décoration ou fonction.
- [MDN — CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) : déploiement progressif, Report-Only et application.
- [web.dev — optimisation LCP](https://web.dev/articles/optimize-lcp) : identification de l’élément et des phases ; ne pas présumer la cause.

## Panel reproductible et recette humaine à obtenir

`node scripts/preview-report-pilots.mjs` démarre un backend GET uniquement sur
`127.0.0.1:3028`. Fournir `API_BASE=http://127.0.0.1:3028` au build **et** au
démarrage de Next. Parcours FR/EN : `/report/review-pilots-baseline`,
`review-pilots-limits`, `review-pilots-source`, `review-pilots-breakdown`,
`review-pilots-historical`, `review-pilots-partial`. Ils utilisent uniquement les
cas fictifs de `fixtures/pilot-findings.json`, jamais des identifiants d’accès réels.

La baseline présente les quatre fiches. Les variantes couvrent titre absent/vide
ou long, CSP non reconnue ou source ZAP, ratio sans durée, discovery/breakdown,
méthode historique absente et rapport partiel. Les tests couvrent également une
révision future et un instantané incohérent.

Pour chaque lecteur, faire lire au moins une fiche par domaine, puis demander :
« Qu’a observé Argos ? Qu’est-ce qui reste inconnu ? Où agir ? Comment savoir que
la correction fonctionne ? ». Noter les mots du lecteur, ses hésitations et la
correction apportée, puis refaire une lecture. Inclure un cas sans preuve précise
et un historique. La recette doit être faite par un profil non technique et un
développeur/prestataire ; une relecture de l’agent ou les tests ne la remplacent pas.

| Profil | Date / langue / variante | Reformulation et incompréhensions | Correction et nouvelle lecture |
| --- | --- | --- | --- |
| Propriétaire non technique | À obtenir | Aucun retour reçu | À réaliser |
| Développeur / prestataire | À obtenir | Aucun retour reçu | À réaliser |

La validation automatisée et visuelle exécutée pour cette PR est consignée dans
la description de PR et ses résultats CI. La recette humaine reste ouverte.

## Vérifications locales du lot

- `mvn test` : 995 tests, aucun échec ni erreur, un test ignoré. Les nouveaux cas
  passent par les producteurs HTML/HTTP/Lighthouse, la fusion de sources,
  l’assainissement, la sérialisation et le composeur. Une comparaison avec/sans
  instantané vérifie que le calcul de score HTML reste identique.
- `npm test` : suite complète de 1 198 tests réussis, puis 51 tests ciblés réussis
  après les ajustements de résumé, de titres et de présentation des preuves.
  Parité web/PDF testée pour les 12 cas de pilotes, dans les deux langues.
- Build de production webpack/TypeScript réussi. Lint sans erreur, avec un
  avertissement préexistant dans `ReportPriorityList.tsx`, hors des changements.
- Inventaires statique et Lighthouse régénérés et vérifiés ; test Node du
  générateur Lighthouse réussi, syntaxe des scripts de recette vérifiée.
- `node scripts/e2e/report-pilots.mjs` : 24 cas fictifs réussis sur le build de
  production. Baseline FR/EN, clair/sombre, 390/768/1440 px ; six variantes dans
  les deux langues à 320 px en clair. Quatre accordéons parcourus au clavier sur
  chaque baseline, un seul h1, aucun débordement ni erreur de page dans ces cas.
- Quatre PDF complets exportés (baseline et historique, FR/EN), 13 pages chacun.
  Le texte des guides est comparé à celui du navigateur ; les aperçus n’exposent
  pas l’identifiant fictif du rapport. Les 52 pages sont rendues avec Poppler et
  contrôlées pour l’absence de page vide ; des planches représentatives de
  pagination, exemples et limites ont été inspectées visuellement.

Les captures, PDF et résultats locaux sont dans
`outputs/ui-review/issue-673-pilots/` (non versionnés). Ces vérifications ne sont
ni une certification d’accessibilité, ni une validation de production, ni les
retours des deux profils humains requis. Les enrichissements de localisation,
les autres règles et la recette exhaustive restent hors de ce premier lot.

## Maintenance

Après changement d’un collecteur : réviser les méthodes touchées, produire les
faits à leur source, conserver le cas historique et tester les unités. Régénérer
`node scripts/report-rule-inventory.mjs` puis son `--check`. Après installation
des dépendances Lighthouse verrouillées, régénérer
`node scripts/report-lighthouse-inventory.mjs` puis son `--check` ; la vérification
refuse une version installée différente de la version déclarée. Revoir les
références pour leur pertinence, pas seulement leur statut HTTP.
