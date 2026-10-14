# F13 — Recette intégrée de Clarté (#560)

La recette porte sur la branche empilée contenant F01–F12 et F14, pas sur une
fusion de ces lots dans `main`. La PR F13 et son manifeste CI identifient le
commit réellement testé, le head de PR et le run. Une CI verte ne constitue
ni une autorisation de mise en service ni une certification d'accessibilité.

## Preuves au commit testé

Le workflow [Controlled audit E2E](../../.github/workflows/controlled-e2e.yml)
rejoue les harness existants sur un build de production, une MariaDB 11.4
jetable et les vrais collecteurs Chromium. Il termine par
[`acceptance-evidence.mjs`](../../scripts/e2e/acceptance-evidence.mjs) :

- vérification de la présence des matrices nominales FR/EN, clair/sombre,
  320/390/768/1056/1440 (390/1056 pour les observations F14) ; un run limité
  aux smoke tests ne suffit pas ;
- vérification des captures référencées et empreintes SHA-256 des résultats ;
- vérification des scénarios réellement publiés, du retour domaine conservé,
  des refus administratifs et de la sauvegarde/restauration ;
- seize paires maquette/produit, huit écrans en FR clair 1056/390, avec contrôle
  des empreintes de la référence figée ; aucun remplacement de baseline ;
- manifeste dans `connected-acceptance-<sha>` avec provenance, navigateurs,
  nombres de cas, références aux autres artefacts et limites.

Le manifeste échoue si un résultat requis manque. Il n'attribue pas de succès
à la revue humaine et ne transforme pas une réponse simulée en preuve serveur.
Le mode local `--preview` est explicitement **non lié à un SHA**. La CI utilise
un checkout propre ; les résultats unitaires et SQL restent ceux des jobs CI
et MariaDB séparés. Les artefacts sont retenus quatorze jours : les conserver
dans le registre de livraison avant expiration si une conservation plus longue
est nécessaire. La PR contient les liens et le bilan de la revue.

## Matrice des exigences

Les preuves ci-dessous sont rejouées par la CI de F13. Les noms désignent les
classes ou scripts existants ; les résultats effectifs sont ceux du run cité
dans la PR, pas des cases précochées. La couche est essentielle à leur lecture.

| ID | Preuve et périmètre | Limite |
|---|---|---|
| QA-01 | `connected-shell`, `analysis`, `account`, `usage`, `domains`, `overview`, `admin`, `evidence` ; seize paires de captures | Données visuelles synthétiques, comparaison de composition et non égalité pixel |
| QA-02 | Même matrice : axe, h1/footer, débordement ; clavier menu, recherche, dialogues, Escape/retour du focus ; taille racine 200 % étendue au dashboard, domaine et fiche admin | Taille racine injectée, pas zoom natif du navigateur ; lecteur d'écran et contraste exhaustif non vérifiés |
| QA-03 | `AccountLifecycleIT`, `BatchIT`, `OverviewIT` : deux propriétaires du même hôte, sessions/CSRF, lectures et mutations privées ; `admin-browser` refuse l'utilisateur standard | Fournisseurs externes simulés |
| QA-04 | `OverviewIT.canonicalCountersAndFilteredPaginationUseTheSamePrivateProjection` ; 15/9/3/68, filtres et récents ; `domain-browser` vérifie les deux lots réels | Aucun KPI calculé sur une page de pagination |
| QA-05 | Tests de couverture/composition et `browser` : healthy, partial, empty, unavailable, timeout, antibot ; rendu du rapport partiel | Pas de promesse de mesure sur un site arbitraire |
| QA-06 | `DomainSummaryProjectionTest`, `BatchIT.f08CanonicalPublicationPrivateSummariesAndRetention` : déduplication, couverture, règles et exclusions | Les fixtures visuelles utilisent parfois un sous-ensemble différent du canonique |
| QA-07 | `domain-browser` et `connected-domains` : synthèse → pages filtrées → run exact → retour avec filtre | Pas d'URL de rapport fictif dans le parcours réel |
| QA-08 | Tests crawler/normaliseur/egress et `DiscoveryIT` : DNS, redirections, XML, limites, robots, concurrence et annulation | Charge hostile à grande échelle non simulée |
| QA-09 | `BatchIT` : admission tout-ou-rien, rollback, clés concurrentes, plafond global ; `UsageIT` | MariaDB réelle, pas un mock de transaction |
| QA-10 | `BatchIT` : reprise mixte sans navigateur, lease, fencing, annulation/publication, rollback des crédits ; `AuditPublicationIT`, `AuditClaimIT` | Injection contrôlée ; pas de panne matérielle de production |
| QA-11 | `UsageIT`, `BatchIT`, `AccountLifecycleIT` : périodes, anciennes réservations, publication et annulation concurrentes | Horloge contrôlée |
| QA-12 | `AccountLifecycleIT`, tests OAuth, `connected-account` : preuve email, dernier accès, réauthentification, archive/suspension et erreurs fournisseur | SMTP et Google/GitHub/LinkedIn réels restent une recette d'exploitation |
| QA-13 | `AccountLifecycleIT` et `admin-browser` : ADMIN protégé, quota sous engagé, stale version, journal atomique, révocation et réauthentification | Pas de mutation de compte réel |
| QA-14 | `domain-browser` : rafraîchissement sans resoumission, retour depuis la liste, deux lots distincts et ancien lot conservé | Dépend de la DB du harness, pas d'un timer simulant une fin |
| QA-15 | Suites frontend/backend, `browser`, `public-header`, `connected-cleanup`, historique ; PDF FR/EN F14 | Pas de trafic production |
| QA-16 | `ConnectedModelIT`, `AccountLifecycleIT` : Flyway sur base neuve, bootstrap ADMIN ; démarrage du package et QueryDSL en CI ; restore isolé | Aucun reset ni reprise sélective des tables de production |
| QA-17 | `OverviewIT.queryCountDoesNotGrowWithPageSizeAndReadsNoReportBodies` : 215 URL, pages 1/100, trois requêtes sans report_json/result_json ; `manySitesUseBoundedProjectionsAndDeterministicPages` : 25 sites ; tests du hook de polling et transition navigateur active→terminale | Preuve de requêtes bornées, pas benchmark p95 ni dimensionnement de l'hôte cible |
| QA-18 | Collecteurs/Java/rapport F14 + `browser` : vrai 503, chemin DOM, persistance, paramètre sensible exclu et PDF FR/EN | Échantillon borné ; chemins URL masqués, initiateur non collecté |

Sources : [tests MariaDB](../testing/mariadb.md), [harness réel](../testing/controlled-e2e.md),
[recette comptes](../testing/accounts.md), [contrat F14](evidence-f14.md),
[matrice d'acceptation](acceptance.md). Les suites visuelles se trouvent dans
[`scripts/e2e`](../../scripts/e2e), les tests d'intégration dans
[`services/domain/report`](../../apps/api-backend/src/test/java/com/dokor/argos/services/domain/report).

## Comparaison avec la maquette

La composition conserve sidebar, bandeau, trois KPI, surfaces à rayon 9 px,
accent violet et footer. La référence possède une marge et un cadre de
présentation absents du produit ; sa largeur utile diffère donc à viewport
égal. Les captures ne servent pas à calculer un pourcentage de fidélité.

| Écran comparé | Écart produit documenté |
|---|---|
| Dashboard | 15/9/3/68 selon le canonique, recherche et pagination ; statut/complétude/couverture séparés. Bloc récent daté, sans variation LCP inventée |
| Liste des domaines | Liens vers le dernier lot persistant, état vide/erreur, périmètre privé ; données et dates réellement reçues |
| Synthèse | Périmètre et limites du crawler, exclusions par règle, crédits du lot et historique ajoutés. Mobile plus long, KPI empilés pour garder les libellés lisibles |
| Pages affectées | Filtres serveur et tableau défilant dans une région accessible ; pas de scroll horizontal global |
| Diagnostic | Lecteur partagé existant, complétude distincte du score, provenance et preuves F14 ; pas de snippets inventés |
| Compte | Rubriques profil/sécurité/connexions, réauthentification et dernier moyen d'accès ; pas de seconde identité |
| Quotas | Registre réservé/consommé/libéré et périodes ; aucun tarif ou paiement factice |
| Administration | Quota engagé, version, motifs contrôlés, confirmations et journal ; pas de modification d'un ADMIN |

La navigation devient compacte à 900 px (décision F02). Les textes et cibles
interactives sont plus grands que les petits libellés de la maquette. Les
illustrations, badges de démonstration et valeurs exemplaires ne sont pas des
fonctionnalités attendues. Les vues sombres/EN et les autres largeurs sont
contrôlées par les suites produit, sans référence sombre figée équivalente.

La revue de F13 consigne les images réellement examinées et les éventuels
écarts bloquants dans la PR. Les nouveaux scénarios de texte agrandi et le
contrôle d'arrêt du polling sont des tests du rendu produit avec API simulée.
L'échantillon ne démontre ni utilisabilité auprès de clients ni conformité WCAG.

## Mise en service et réserves

Suivre le [runbook d'initialisation](commissioning-f13.md). Le nouveau départ
concerne l'espace connecté ; les tables techniques/public et les comptes
partagent des relations. Aucune suppression sélective n'est fournie.

L'espace de démonstration reste fermé en production. Les intégrations API/CI
sont annoncées « Bientôt » sans bouton d'activation fictif. Les actions de site,
domaine, compte, quota et administration utilisent les services livrés ; les
écritures principales sont exercées par les harness réels.

La clôture de cette recette ne clôture pas automatiquement l'epic : l'intégration
des PR empilées, les vérifications d'exploitation ci-dessus, la décision de
mise en service et tout abandon effectif de données restent distincts.
