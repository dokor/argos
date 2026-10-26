# Rapports exploitables : problème, emplacement, correction, vérification

## Problème traité

Le rapport affichait une hiérarchie de scores et de précautions avant les actions.
Un constat imposait plusieurs ouvertures successives pour lire son impact, sa correction
et sa vérification. Surtout, le collecteur Lighthouse supprimait les chemins des ressources
et les sélecteurs : une origine et une référence opaque ne permettaient pas de trouver
le fichier à modifier. Ajouter du texte dans le frontend ne pouvait pas réparer cette perte.

## Principes retenus

| Référence | Principe repris dans Argos |
| --- | --- |
| [Search Console, indexation des pages](https://support.google.com/webmasters/answer/7440203) et [inspection d’URL](https://support.google.com/webmasters/answer/9012289) | Distinguer une vue regroupée d’un diagnostic sur une page précise ; afficher le périmètre examiné. |
| [Bing Site Scan](https://www.bing.com/webmasters/help/site-scan-623520c9) | Relier les problèmes aux pages concernées et distinguer les niveaux de gravité. |
| [Semrush, Issues report](https://www.semrush.com/kb/541-site-audit-issues-report) et [Crawled Pages](https://www.semrush.com/kb/543-site-audit-crawled-pages) | Passer d’un problème commun aux URL affectées et aux indications de correction. |
| [Lighthouse, scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring) | Une note agrégée n’est pas une correction. Les diagnostics éclairent les métriques ; leurs gains estimés ne sont pas des points de score garantis. |
| [Chrome, image delivery](https://developer.chrome.com/docs/performance/insights/image-delivery) | Présenter les ressources avec leurs mesures, puis indiquer quoi changer et comment comparer le résultat. |

Ces références guident l’architecture de l’information ; Argos ne reproduit pas leurs données
de terrain, leur index, ni leur profondeur d’exploration.

## Parcours livré

1. URL et périmètre, résultat et limites de couverture.
2. Actions prioritaires, chacune avec une première étape et un accès direct au constat.
3. Scores par domaine, puis mesures détaillées repliables. Hébergement et relance sont secondaires.
4. Une fiche ouverte montre immédiatement l’observation et son emplacement, l’impact,
   les étapes de correction et la vérification attendue. La méthode et les références restent repliables.
5. Recherche par problème, clé technique, chemin de ressource ou sélecteur.
6. Les contrôles réussis, non mesurés, non applicables et informatifs ont un inventaire séparé.
   L’absence d’un constat ne devient jamais un succès implicite.
7. Dans un lot de pages, les exemples et les liens du filtre par règle ouvrent directement
   le même constat dans le rapport de la page. Les ressources restent propres à chaque analyse.

## Contrat et construction

- `observed-evidence-v1` reçoit des champs optionnels `resourcePath`, `selector`, `metrics`.
  Le service Lighthouse les extrait des lignes structurées du diagnostic avant la suppression
  générique des URL. Le backend les revalide avant publication. Les chemins ne sont pas déduits
  des références hachées ; le chemin DOM interne n’est pas présenté comme un sélecteur CSS.
- Les ressources statiques sont conservées sous forme origine + chemin. Requêtes, fragments,
  identifiants de connexion, extraits HTML, sélecteurs d’attributs, routes applicatives et chemins
  identifiés comme sensibles sont exclus. Longueurs, profondeur, nombre de visites, échantillons
  et métriques numériques sont bornés. Cette liste conservatrice peut masquer des ressources légitimes.
- Les métriques associées à une ligne restent avec sa ressource. Les octets sont affichés en kB/Ko
  décimaux ; `wastedMs` et `wastedBytes` sont explicitement des économies estimées.
  Un ratio Lighthouse n’est jamais transformé en durée.
- `report-diagnostics-v1` fige le périmètre d’une page et les résultats conservés par Argos.
  Il ne prétend pas inventorier tous les audits internes exécutés par Lighthouse.
- La composition retire des problèmes du site les contrôles déclarés non mesurés ou non applicables
  par la couverture, déduplique les clés et compte chaque constat dans un seul domaine principal.
- `priority-actions-v3` conserve le classement existant mais retire la note de catégorie Lighthouse
  du plan d’action quand des diagnostics Lighthouse concrets existent dans le même domaine.
  La note et son constat technique restent consultables. Les scores ne sont pas recalculés.
- Les synthèses publiques excluent les preuves et le nouvel inventaire ; les droits d’accès restent
  appliqués par les endpoints existants. Les reconstructions de DTO conservent les diagnostics privés.

## Compatibilité et limites

### Couverture des explications et corrections

Le catalogue `report-content-v9` confronte les fiches aux clés réellement produites par les huit
modules. Les 115 audits de la configuration Lighthouse 13.5.0 susceptibles de produire un résultat
`binary`, `numeric` ou `metricSavings` disposent de textes FR/EN : problème et effet, emplacement
à examiner, modification concrète et résultat attendu. Cela couvre des candidats, pas 115 problèmes
présents sur chaque page : l’émission dépend aussi du score, du mode effectif et du plafond de 12.
Les audits manuels et informatifs sont exclus de cette promesse et restent dans l’inventaire complet.

Les corrections TLS distinguent certificat invalide, renouvellement, activation de TLS 1.2/1.3
et retrait des anciens protocoles. Observatory expose les politiques effectivement échouées et
réutilise les procédures des en-têtes reconnus. Ses détails absents ne sont pas reconstitués.

ZAP constitue un ensemble ouvert de règles. Le backend conserve désormais `description` et
`solution` en texte simple, borné et assaini, en gardant la gravité maximale lors de la déduplication.
Les règles CORS et X-Powered-By ont aussi une fiche FR/EN ; les autres alertes dynamiques affichent
la solution de leur source avec sa langue d’origine explicitement indiquée. Une ancienne alerte
sans solution ne reçoit plus une fausse recommandation « corriger selon les bonnes pratiques ».
Les alias ZAP vers les en-têtes HTTP conservent les procédures dédiées existantes.

`findingCoverage.test.ts` contrôle les clés des analyseurs et le catalogue Lighthouse.
`apps/lighthouse-service/reportable-audits.test.mjs` confronte ce catalogue à la configuration
et aux métadonnées du paquet installé ; une évolution de Lighthouse ne peut pas passer silencieusement.
Les deux inventaires documentaires sont régénérés par `scripts/report-rule-inventory.mjs` et
`scripts/report-lighthouse-inventory.mjs` (Node 22.19+). Pour mettre à jour le catalogue Lighthouse,
exécuter `reportableAudits()` depuis `apps/lighthouse-service/reportable-audits.mjs`, conserver son
résultat JSON dans `lighthouseAuditCatalogue.json`, puis rédiger les fiches manquantes avant validation.

Références de rédaction : métadonnées du paquet Lighthouse installé et liens officiels par règle,
[audits d’accessibilité Lighthouse](https://developer.chrome.com/docs/lighthouse/accessibility/scoring),
[diagnostics de performance](https://developer.chrome.com/docs/performance/insights),
[TLS](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security),
[Observatory](https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring),
[ZAP CORS](https://www.zaproxy.org/docs/alerts/10098/) et
[ZAP X-Powered-By](https://www.zaproxy.org/docs/alerts/10037/).

Les nouveaux emplacements nécessitent une nouvelle collecte : les rapports déjà enregistrés
ne contiennent pas les fichiers supprimés précédemment. L’interface dit alors que le chemin
n’est pas disponible et explique comment le retrouver. Un ancien rapport sans inventaire ne
permet pas d’affirmer qu’un contrôle a réussi. Les titres inconnus gardent leur identité source,
sans inventer une procédure spécifique ou une traduction.

Le rapport individuel couvre une URL, pas l’intégralité d’un domaine. Les lots existants gardent
leur périmètre de pages sélectionnées. Cette modification ne crée pas de nouveau crawler.
La refonte du PDF est différée ; les composants éditoriaux partagés continuent d’être testés
avec son rendu HTML, sans validation de pagination ni nouvel export PDF dans cette tâche.

## Reproduction locale

Depuis la racine, lancer `.agents/skills/argos-visual-review/scripts/preview-backend.mjs`
sur 3018, puis `node scripts/e2e/report-actionable-fixture.mjs` sur 3019.
Lancer le frontend avec `API_BASE=http://127.0.0.1:3019` et le port 3020.
La route `/report/review-actionable-fixture` présente trois cas fictifs : police, image lourde,
image sans alternative accessible. `/report/review-questions?view=technical` montre le contrat ancien.
`/report/review-guidance-fixture?view=technical` rassemble les huit collecteurs, une règle ARIA,
un certificat proche du renouvellement, une règle ZAP avec solution et une ancienne règle sans solution.
Les fixtures sont en lecture seule, liées à la boucle locale et n’utilisent aucune donnée de production.

## Validation de la couverture éditoriale (26 octobre 2026)

- Maven : 1 041 tests, aucun échec, une intégration ZAP ignorée faute de démon local ; cette
  intégration est exécutée dans la CI avec son conteneur dédié.
- Lighthouse : 23 tests réussis, dont comparaison du catalogue avec le paquet installé.
- Frontend : 146 fichiers / 1 284 tests réussis, plus les contrôles éditoriaux. Les inventaires
  obsolètes ont été régénérés après l’ajout des fiches ; leur dérive provoque bien un échec.
- TypeScript, ESLint des composants modifiés et build Next de production vérifiés.
- Navigateur : règle ARIA et ZAP en FR sombre sur ordinateur, ARIA en EN clair à 390 × 844,
  Observatory en FR sombre à 390 × 844, ouverture clavier, expiration TLS, alerte historique
  sans solution. Aucun débordement horizontal dans les variantes mobiles observées.
- La CI de la première révision attendait des mesures visibles avant l’ouverture de leur
  nouvelle section repliée. Les parcours E2E sont adaptés pour ouvrir cette section et
  vérifier les mêmes données ; le contrôle des emplacements vérifie maintenant qu’ils restent
  visibles lorsque seule la méthode est refermée.
- Les nouvelles captures locales portent le préfixe `guidance-` dans le même dossier de revue.
  Elles ne remplacent pas un test utilisateur ni une vérification manuelle des 115 fiches dans
  des sites réels. Les tests de couverture portent sur les collecteurs et la version installés.

## Validation de la première refonte

- Backend : 1 014 tests dans la suite Maven, aucun échec.
- Lighthouse : 22 tests, dont extraction des fichiers/sélecteurs, métriques par ressource,
  filtrage des données sensibles, bornes, contrat HTTP et nettoyage des processus.
- Frontend : suite complète initiale de 1 274 tests, 1 272 réussis ; un test de compte a dépassé
  son délai sous charge et une assertion de liste ne prenait pas encore en compte les étapes ajoutées.
  Après adaptation de cette assertion et des liens profonds, les 7 fichiers ciblés passent : 47 tests,
  dont le test de compte isolé et les nouveaux parcours de recherche et d’inventaire.
- Build Next.js de production et vérification TypeScript réussis.
- Navigateur : FR sombre sur ordinateur, FR sombre et EN clair à 390 × 844 ; ouverture depuis
  le plan d’action, recherche par fichier, mesures d’image, sélecteur, corrections, inventaire,
  focus clavier, ancien contrat et absence de débordement horizontal vérifiés.
- Captures locales : `C:/Users/antoi/IdeaProjects/argos/outputs/ui-review/actionable-report/`.
  Elles ne sont pas publiées dans la PR. Le rendu initial a été examiné dans le navigateur,
  mais aucune capture comparative initiale n’a été conservée sur disque.
- Limite préexistante observée : avertissement d’hydratation de `html[data-theme]` dans le serveur
  de développement, déjà présent avant les modifications. Un avertissement lié au remplacement
  d’un texte pendant le rechargement à chaud a motivé une nouvelle vérification après rechargement.
  La fixture ne fournit pas le service de prompt IA ; son état indisponible est attendu.
