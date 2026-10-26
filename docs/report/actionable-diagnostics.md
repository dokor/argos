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

Le catalogue `report-content-v10` confronte les fiches aux clés réellement produites par les huit
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

### Emplacements conservés pendant une collecte réelle

L'extracteur Lighthouse conserve les fichiers des arbres `chains`/`children`, les
positions ligne/colonne des localisations de code et les durées de tâches longues.
Un résultat LCP sans élément propre utilise uniquement la décomposition LCP du
même passage ; TBT et Max Potential FID utilisent les tâches longues de ce passage.
La fiche affiche leur provenance et distingue durée, phases observées et économies
estimées. Plusieurs positions d'un même fichier sont regroupées sans les perdre.
Le document racine `/` peut être désigné sans exposer un chemin privé.

Les échecs bfcache conservent leurs motifs. Un ensemble explicitement classé
« Aucune action possible » / « Not actionable » par Lighthouse reste informatif.
Un ensemble mixte ou un libellé inconnu conserve le traitement habituel ; aucun
motif inconnu n'est déclaré inoffensif. La fiche n'incite pas à supprimer
`Cache-Control: no-store` des réponses privées.

ZAP accepte les niveaux numériques des exports et les libellés de son API réelle.
Un risque inconnu rend le module indisponible plutôt que de produire un faux
résultat sain. La confiance de la source est conservée. Les sous-alertes CSP du
même plugin gardent leurs motifs, directives et procédures spécifiques. Pour
l'absence de jeton CSRF, le numéro de formulaire signalé et sa balise sont vérifiés
contre le HTML collecté avant de produire un sélecteur structurel ; aucune valeur
de champ ni balise brute n'est publiée. Le signal impose de vérifier la protection
serveur et ne suffit pas à conclure à une faille exploitable.

La fiche TLS expose l'hôte, le serveur retenu et la date d'expiration auprès de la
correction. Les fichiers, sélecteurs et cibles restent visibles sans ouvrir les
détails de méthode. La [recette réelle](../testing/report.md#vérifier-les-emplacements-sur-une-collecte-réelle)
décrit comment vérifier ces cibles au-delà de la présence des textes.

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

## Recette sur plusieurs sites réels — 26 octobre 2026

Quatre collectes supplémentaires ont utilisé les huit analyseurs de production et
le vrai démon ZAP passif, sans soumettre de formulaire. Les sorties finales vont
de 21:47:13 à 21:48:52 UTC. Les huit services ont répondu sur chaque cible ; cela
n'implique pas que chaque contrôle individuel soit mesurable (W3C : couverture 98 %).

| Page publique | Constats finaux | Preuves confrontées au site |
|---|---:|---|
| The Internet — `/javascript_error` | 27 | Expression fautive à la ligne 8, colonne 52, dans le document exact ; cookie de réponse ; suites TLS faibles |
| The Internet — `/broken_images` | 31 | `asdf.jpg` et `hjkl.jpg` répondent 404 ; les cibles alt et ratio retrouvent les images concernées |
| W3C BAD — `/WAI/demos/bad/before/home.html` | 32 | 41 cibles HTML/Lighthouse résolues dans le DOM réel ; le script piwik signalé répond 404 |
| badssl — `https://mixed.badssl.com/` | 31 | URL HTTP à la ligne 18, colonne 29 ; image exacte, bannière Server, TLS 1.0/1.1 et terminaison identifiée |

Ces 121 fiches correspondent à 62 règles distinctes. Les fiches rendues ont été
ouvertes dans le navigateur ; la revue a examiné leurs corrections, pas seulement
leur présence. Vingt ressources statiques distinctes ont été rechargées : 17 réponses
200 et les trois 404 attendus. Les pages sont des démonstrations volontairement
problématiques ; elles ne constituent pas un échantillon représentatif de tous les sites.

Corrections issues de cette recette :

- HTML conserve les sélecteurs structurels des images sans alt, liens sans href et
  titres h1 concernés. Les absences de balises/en-têtes gardent leur état explicite.
- Runtime conserve les chemins statiques et coordonnées de source. Les exceptions
  inline désignent le document analysé, sans exposer de nouveau chemin privé.
  Une erreur de chargement d'image n'est plus expliquée comme du code JavaScript à réécrire.
- Lighthouse lit `sourceLocation`, retrouve les nœuds `link-text` dans les artefacts
  du même passage et conserve le motif contenu mixte de DevTools. Le chemin DOM exact
  distingue des images partageant un sélecteur qui peut correspondre à 25 nœuds.
- L'URL masquée d'une ressource peut être retrouvée localement par sa référence dans
  la chronologie du navigateur. Cette commande ne transmet rien ; si la requête a changé
  ou n'apparaît pas dans la chronologie, il faut l'examiner dans Réseau. Ce repli n'est
  pas présenté comme une URL déjà connue du rapport.
- Observatory lit le détail v2 `/analyze?host=...`, avec correspondance stricte du scan.
  Son périmètre commence à la racine HTTP de l'hôte, distinct du chemin de la page.
- L'import HTTP dans ZAP conserve Secure/HttpOnly/SameSite et les occurrences séparées
  de Set-Cookie tout en masquant les valeurs. Leur suppression créait de fausses alertes
  (HttpOnly sur The Internet ; Secure et HttpOnly sur W3C). Les fiches indiquent désormais
  l'occurrence du cookie, l'en-tête ou la ligne de réponse correspondant à la preuve.
- TLS nomme les protocoles et suites faibles de la terminaison retenue ; Tech nomme
  l'en-tête et la version observée. Les scores agrégés restent des résumés, pas des causes.

Validation : 1 050 tests Maven, aucun échec, une intégration ignorée par défaut puis
exécutée avec succès contre le vrai démon ZAP ; 28 tests Runtime et 26 Lighthouse.
Après stabilisation, la suite frontend complète passe ses 1 291 tests dans 147 fichiers.
TypeScript, ESLint et build Next de production passent. Le rendu FR sombre/clair et EN
clair est vérifié sur ordinateur, sans débordement aux dimensions observées. La demande
de viewport mobile n'a pas été appliquée par l'outil navigateur : aucun succès responsive
à 390 px n'est revendiqué pour cette recette.
Les captures et vérifications DOM détaillées sont locales dans
`outputs/ui-review/multisite-audits/` du checkout principal ; les réponses assainies et
les vérifications HTTP sont dans `outputs/live-audit/` du worktree.

Limites : pas de file/base/publication testée par le lanceur manuel, pas de preuve de
correction sur les sites tiers, pas de validation universelle des règles ou d'un domaine
entier. Les diagnostics Lighthouse sélectionnés et les timings varient entre passages.
Les rapports historiques ne retrouvent pas rétroactivement une donnée supprimée.
PDF différé. La documentation des méthodes et limites reste visible.

## Reproduction locale des fixtures

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
