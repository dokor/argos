# Cas ciblés : emplacement, correction et vérification

Recette du 26 octobre 2026, après les cinq collectes publiques décrites dans
[le bilan du rapport](../report/actionable-diagnostics.md).
Le visuel reste dans le système existant. La validation porte sur la précision
du diagnostic, sa conservation jusqu'au rapport et le résultat de la correction.

## Périmètre réellement vérifié

| Population | Preuve | Ce que cela démontre |
| --- | --- | --- |
| 56 règles axe du catalogue Lighthouse | Documents fautifs/corrigés exécutés dans Chromium avec la version axe installée | Le sélecteur est unique ; le chemin DOM, y compris SVG, retrouve le même nœud ; la correction retire la violation ou rend légitimement le contrôle non applicable |
| 37 autres règles Lighthouse | Analyseurs installés avec artefacts contrôlés, calculs de minification, helpers et contrats de diagnostics | Les fichiers, lignes, éléments et mesures restent attachés au bon diagnostic ; le résultat corrigé n'est plus sélectionné |
| 93 cas Lighthouse combinés | Analyseur Java → sérialisation assainie → compositeur public ; affichage FR/EN | Les preuves sont identiques après stockage et présentes hors du volet technique ; aucun constat corrigé n'est publié |
| 115 candidats Lighthouse 13.5.0 | Union des cas ciblés et observations des cinq pages publiques | Aucune règle du catalogue borné ne reste sans cas identifié ; cela ne signifie pas 115 corrections mesurées sur des sites réels |
| 75 clés internes | Matrice des 32 clés observées en réel, 13 autres constats testés et 30 clés informatives/d'indisponibilité | Les mesures et pannes de collecte ne sont pas transformées en défauts du site |

La [matrice versionnée](../report/targeted-rule-coverage.json) donne la méthode
de chaque cas. Les modèles de traces de performance sont contrôlés : ce ne sont
pas des chargements réels ni des preuves de gain de vitesse. `layout-shifts` et
`total-byte-weight` ont des contrats de diagnostic rejoués ; les cas CLS et tiers
emploient des helpers installés, pas une nouvelle capture de trace.
Les valeurs `notApplicable` après suppression d'un attribut interdit sont
distinguées d'une réussite et d'une mesure absente.

Les treize autres constats sont : titre HTML, statut HTTP, destination HTTPS,
redirection HTTPS, nombre de redirections, Content-Type, robots.txt absent,
erreurs 5xx, erreurs tierces, nombre de requêtes, transfert estimé, validité du
certificat et TLS 1.2. Les tests interrogent les vrais analyseurs sur des réponses
contrôlées, avec conservation de l'emplacement et comparaison avant/après lorsque
le résultat est modifié. Les mesures globales de requêtes restent globales : leur
seul total ne permet pas d'accuser un fichier.

ZAP possède un espace de règles ouvert. La couverture ne prétend pas énumérer ses
futurs plugins : les alias connus et les contrats génériques (en-tête, cookie,
formulaire, positions multiples dans le corps et solution source) sont testés.
Une preuve/solution absente reste explicitement indisponible.

## Corrections issues des cas

- Les sous-éléments axe, attributs ARIA cités et chemins SVG ne sont plus perdus.
  La fiche distingue les alternatives citées par axe d'un attribut réellement
  présent ; `aria-expanded`, `aria-valuenow` et la faute `aria-labl` ont des
  indications conditionnelles sur les valeurs et les états à vérifier.
- robots.txt est situé à la racine de l'hôte avec sa ligne réelle ; la procédure
  demande d'ouvrir ce fichier, qui n'est pas nécessairement chargé par la page.
- Les liens de documentation ne deviennent plus des ressources fautives ; les
  scripts sans erreur de source map sont exclus de la liste des fichiers concernés.
- Recalculs forcés, travail des tiers, temps d'exécution et décalages gardent leurs
  mesures. Deux positions d'un même script ne perdent plus leurs durées distinctes.
- TTI, CLS, INP et travail du thread principal utilisent les diagnostics associés
  du même passage lorsque leurs propres résultats ne contiennent aucun emplacement.
  La provenance est affichée ; une cible déplacée n'est pas présentée comme une cause certaine.
- La latence du document distingue serveur, redirections et compression à partir
  des booléens du diagnostic. Le statut HTTP, l'explication Lighthouse et le motif
  `unload` du cache arrière/avant sont visibles avec la correction correspondante.
- Runtime conserve les chemins des plus gros fichiers avec leurs octets mesurés.
  ZAP garde jusqu'à dix positions/en-têtes d'une même alerte.
- Les bits SSL Labs sont décodés : `12` signifie expiration et nom d'hôte incorrect,
  pas douze problèmes. Les réparations et contrôles de chaîne, SNI, échéance,
  révocation, signature et clé sont distincts.

Sources de sémantique : paquet Lighthouse 13.5.0 installé,
[WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) et
[certificats SSL Labs API v3](https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md#cert).

## Reproduire

Depuis la racine, avec les dépendances des services installées et Chromium disponible :

```sh
node scripts/review/verify-targeted-a11y.mjs
node scripts/review/verify-targeted-lighthouse.mjs
node scripts/review/build-targeted-corpus.mjs
```

Les deux premières commandes produisent les résultats détaillés dans
`outputs/targeted-rules/`. La troisième régénère les 93 entrées synthétiques de
`apps/api-backend/src/test/resources/targeted-rules/lighthouse-cases.json`.
`write-targeted-coverage.mjs` régénère la matrice si les cinq rapports réels
locaux du bilan précédent sont également disponibles ; ils ne sont pas requis en CI.

Depuis `apps/api-backend` :

```sh
mvn test -Dtest=TargetedRuleReportTest -Dargos.targeted.export=../../outputs/targeted-rules/report-cases.json
```

La suite Maven ordinaire lit le corpus committé, sans service externe. L'export
optionnel permet au serveur `scripts/review/live-audit-preview.mjs` de présenter
`/report/review-targeted-<audit-id>?view=technical` sur le frontend local.
Utiliser le backend de démonstration sur 3018, le lecteur sur 3019, puis Next sur
3020 avec `API_BASE=http://127.0.0.1:3019`. Ces rapports sont des **cas contrôlés**.
Ils ne doivent être ni déployés ni présentés comme des audits de targeted.example.

## Validation finale

- Maven : 1 046 tests comptabilisés, aucun échec, une intégration ZAP ignorée par
  défaut. Le test de composition vérifie les 93 couples avant/après.
- Services Node : 58 tests réussis. Cas ciblés : 56/56 et 37/37.
- Frontend : suite complète, 148 fichiers et 1 483 tests réussis, puis 215 tests
  ciblés après les dernières corrections. TypeScript, ESLint des fichiers touchés,
  inventaire des règles et build de production passent.
- Revue navigateur : recalcul forcé FR clair sur ordinateur ; ARIA EN sombre à
  390 × 844 avec ouverture clavier ; robots.txt FR sombre à 320 × 844.
  Aucun débordement horizontal dans ces vues. Les captures sont locales dans
  `C:/Users/antoi/IdeaProjects/argos/outputs/ui-review/targeted-rules/`.
  Aucune capture initiale comparable n'a été conservée pour cette itération.

Limites : pas de file/base/transaction de publication testée par cette recette,
pas de contrôle manuel de lecteur d'écran ni de conformité WCAG revendiquée.
Le thème émet toujours son avertissement d'hydratation préexistant en Next dev ;
le service de prompt IA est absent de ces fixtures. Les anciennes collectes ne
récupèrent pas rétroactivement leurs preuves perdues. PDF toujours différé.
