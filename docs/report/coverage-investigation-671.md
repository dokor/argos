# Investigation de couverture — issue #671

## Preuve réelle disponible au 18 octobre 2026

Un rapport de production a été fourni et autorisé dans le chat. Après son exécution, sa synthèse publique et son API affichent **77 %**, et non 96 %. Le lien, le jeton, les URL, le titre, les identifiants et les horaires exacts restent hors de ce dépôt. Le JSON brut reste uniquement dans le dossier local ignoré `outputs/coverage-private/`.

La fixture [coverage-production-a.json](fixtures/coverage-production-a.json) conserve exclusivement les 56 lignes de couverture figées, les agrégats et les compteurs d’exécution. Ce sont des données réelles assainies, distinctes de la fixture **fictive** [coverage-96.json](fixtures/coverage-96.json). La synthèse autorisée n’expose pas le numéro de run, le profil, la version de scoring ni les empreintes de méthode : ces données restent inconnues, sans déduction à partir du catalogue actuel.

| Contrôle absent | Domaine | Poids | Raison enregistrée | Points globaux manquants |
| --- | --- | ---: | --- | ---: |
| `lighthouse.score.accessibility` | a11y | 10 | `DEADLINE_EXCEEDED` | 4,608295 |
| `lighthouse.score.best-practices` | security | 6 | `DEADLINE_EXCEEDED` | 2,764977 |
| `lighthouse.score.performance` | performance | 22 | `DEADLINE_EXCEEDED` | 10,138249 |
| `lighthouse.score.seo` | seo | 8 | `DEADLINE_EXCEEDED` | 3,686636 |
| `runtime.network.bytes_estimated` | performance | 4 | `CHECK_MISSING` | 1,843318 |
| **Total** | | **50** | | **23,041475** |

Le propriétaire des quatre premières lignes est Lighthouse, celui de la dernière est runtime. Aucune source réelle n’a été conservée pour ces cinq mesures absentes : `measurementModule=null`, `measurementSources=[]`. Les mesures présentes conservent leur provenance dans la fixture.

Reconstitution : poids du catalogue enregistré **223**, moins **6** unités exclues explicitement = **217** attendues. Les exclusions sont `http.antibot.challenge` et `http.errors` (`CONDITIONAL_SIGNAL_ABSENT`), ainsi que `http.redirect.to_https` (`INPUT_ALREADY_HTTPS`), de poids 2 chacune. Les 50 unités absentes donnent **167 / 217 = 76,9585253456 %**, arrondis à **77 %**, et **23 % non couverts** après arrondi séparé. Aucun poids absent n’est compté comme mesuré.

Les domaines se réconcilient aussi : performance **47/73 → 64 %**, sécurité **82/88 → 93 %**, référencement **27/35 → 77 %**, accessibilité **11/21 → 52 %**. Le seuil global suffisant de 80 % n’est pas atteint ; le score est provisoire. L’exécution est pourtant terminée à 100 % : 6 modules terminés, 1 partiel et 1 en échec. Cette progression ne constitue pas une couverture de 100 %.

## Ce que la preuve établit, et ses limites

- Le budget Lighthouse a été dépassé pour ce run. Réessayer après examen de la disponibilité et du budget du service est une action possible ; le JSON public ne permet pas d’attribuer ce délai à la page, à la file interne ou au runner.
- Le contrôle du poids réseau n’a pas été publié. `CHECK_MISSING` ne donne pas sa cause technique : aucune absence de Content-Length, réponse inachevée ou version déployée n’est affirmée à partir de cette seule donnée. Le code supprime ce contrôle quand le total est inconnu. La [PR #713](https://github.com/dokor/argos/pull/713) corrige déjà la collecte des réponses sans Content-Length ; elle ne prouve ni la version exécutée dans ce run, ni que tous les corps ont pu être mesurés.
- Observatory et SSL sont mesurés dans cet échantillon. Ils n’expliquent pas son écart. Aucun incident récurrent de ces intégrations ne peut être déduit de ce seul run.
- Le contrôle manuel du navigateur confirme les pourcentages globaux et par domaine de l’API. La synthèse publique ne donnait pas accès au détail de couverture : le changement associé réutilise `CoverageDetails` dans un accordéon public, avec les mêmes champs déjà publiés dans l’API. Les preuves et corrections privées restent régies par l’accès au rapport complet.
- Le rapport original est immuable. Aucun recalcul avec une nouvelle policy, nouvelle collecte ou modification du score n’a été effectué. L’accès au rapport complet, à l’administration et au PDF de ce run n’était pas disponible pour cette vérification.
- Le calcul peut atteindre 100 % lorsque tout le poids applicable est effectivement mesuré ; il ne plafonne pas à 96 %. Les fixtures vérifient cette propriété, sans prouver qu’un run réel à 100 % a été observé ni que chaque cible est entièrement mesurable.

Un défaut de présentation distinct a aussi été reproduit à la demi-unité : avec 193/200, deux arrondis indépendants pouvaient afficher 97 % mesurés et 4 % non couverts. Le résumé utilise désormais le complément du pourcentage mesuré arrondi (97 % / 3 %), tandis que la contribution détaillée reste 3,5 points. Les poids et le ratio figés restent inchangés ; ce défaut d’arrondi ne démontre pas une cause des 96 %.

## Reproduire la décomposition et comparer des échantillons

```sh
node scripts/explain-coverage.mjs docs/report/fixtures/coverage-production-a.json
node scripts/explain-coverage.mjs --cohort rapport-a.json rapport-b.json rapport-c.json
node --test scripts/explain-coverage.test.mjs
```

L’outil accepte le DTO public (`scores.coverage`), le résultat interne figé (`score.coverage`) et les fixtures (`coverage`). Il vérifie les poids, les états, l’unicité des clés, le ratio enregistré et les domaines conservés. Un total incohérent est signalé et ne participe pas aux fréquences de causes. Les contrôles non applicables restent exclus ; une couverture arrondie à 100 % et une mesure partielle ne deviennent pas une mesure complète.

Le mode `--cohort` compte les 96 % exacts et arrondis, leur plage de ratios et les contrôles/causes absents, avec leur fréquence et leur plage de contributions. Les empreintes de scoring et de mesure/profil séparent les méthodes ; elles ne sortent pas dans la synthèse. Quand elles manquent, les rapports restent isolés, sans supposer des profils identiques. La fréquence porte sur les fichiers fournis, **pas sur l’ensemble de la production** : sélectionner des runs distincts et plusieurs cibles, sans doubler le JSON interne et public d’un même run. Les erreurs de lecture n’exposent ni chemin privé ni extrait du JSON.

Conserver séparément, dans un espace privé, la correspondance échantillon ↔ run/date/profil/version/statut technique. Exporter les JSON figés via les accès autorisés, sans lancer de nouvel audit pour remplacer un historique. Examiner la sortie avant partage ; les données d’entrée ne doivent jamais être ajoutées au dépôt en bloc.

## Investigation encore nécessaire avant clôture de #671

Le seul run réel fourni dans cette passe est à 77 %. Il ne satisfait donc pas le critère d’un **rapport réel à 96 %** décomposé, ni l’étude de récurrence sur plusieurs cibles. Les données à 96 % et à 100 % restent nécessaires ; une demande de liens complémentaires a été adressée à l’utilisateur. La fixture fictive à 96 % (215/223 avec Observatory absent) reste un test de calcul et d’affichage, sans valeur de preuve d’incident.

Sur plusieurs runs autorisés : relever les métadonnées privées manquantes, vérifier les groupes de méthode, distinguer ratios identiques et arrondis, rapprocher les lignes absentes des statuts assainis, comparer API/rapport complet/administration/PDF. L’utilisateur a confirmé ne pas disposer d’autres rapports pour cette passe. Si une cause récurrente de collecte est confirmée, joindre une fixture assainie et corriger ou ouvrir un ticket ciblé. **Cette livraison ne ferme pas automatiquement #671.**

## Validation de la livraison

- 26 tests frontend ciblés : résumé FR/EN, ouverture du détail public, conservation de la restriction des preuves/corrections, arrondi à la demi-unité, provenance et limites historiques.
- 39 tests Node : décomposition du run réel et du catalogue fictif à 96 %, absence/exclusion/anti-bot, provenance multiple, partiel, 100 % mesuré ou seulement arrondi, ratios/domaines incohérents, séparation des méthodes et sélection CI. Les tests de l’outil et ses fixtures sont désormais exécutés dans la CI frontend.
- Build de production avec webpack réussi ; TypeScript valide. Lint sans erreur, avec l’avertissement préexistant de `ReportPriorityList.tsx`, hors des fichiers modifiés. `git diff --check` valide.
- Revue du build sur **données fictives uniquement** : FR sombre 1440/390 px, EN clair 320/768 px, FR clair 768 px ; activation et contrôle du thème sombre anglais. Accordéon activé par Entrée, focus visible, un seul h1, aucune erreur console observée ni débordement horizontal aux tailles contrôlées. La cause, le poids, la source inconnue et la possibilité de nouvelle tentative restent lisibles sur mobile.
- Captures locales dans `outputs/ui-review/671-*.png`, sans données du rapport réel. Les formats complets PDF et les accès privés du run réel n’ont pas été vérifiés visuellement ; le composant partagé garde les explications et le même dénominateur figé.
