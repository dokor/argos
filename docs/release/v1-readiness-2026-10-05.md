# Dossier go/no-go V1 — #259

Évaluation du **5 octobre 2026** : **NO-GO technique**, décision finale humaine
**en attente**. Décideur proposé : @dokor, à confirmer. Aucun déploiement exécuté.
La clôture de #259 exige un GO humain explicite et les preuves de sortie demandées.

## Révision et portée des preuves

- Main inspecté : `86625b6156f53ad048e087138be8e01d05a9c0be`, après PR #264–#266.
- Candidat de **code CI**, non candidat de release approuvé :
  `4fa53e332fb88b4eacc837ca8aa004af211b5a55` ([PR #268](https://github.com/dokor/argos/pull/268)).
- [Run CI quatre applications](https://github.com/dokor/argos/actions/runs/37307710975) :
  API backend tests, Frontend checks, Lighthouse checks, Playwright checks réussis ;
  les trois probes de régression sont réussies, leurs commandes test ont échoué comme attendu.
- Règles documentaires proposées : [PR #267](https://github.com/dokor/argos/pull/267),
  tête `102bc6b` ; tests Java locaux 270 réussis dont 14 fixtures dans un test de contrat.
  Cette branche indépendante **n'est pas dans le candidat 4fa53e3**.
- Contrôles locaux du candidat JS : Node 24.13.0, frontend 109 tests + lint/build,
  Lighthouse 6 tests, Playwright 9 tests, syntaxe et health des points d'entrée.
- Ce dossier s'appuie sur un snapshot GitHub des issues/PR et une lecture du code.
  Aucun test de production, de navigateur réel ou de transaction MariaDB concurrente
  n'est revendiqué. Unitaire, état GitHub, CI et validation Raspberry sont distincts.

Une modification du code, configuration, lockfile, image ou migration invalide les
preuves affectées. Après fusion, choisir le SHA final de main et rejouer les quatre
checks et le parcours contrôlé. Le SHA de cette PR documentaire n'est pas un SHA
déployé. Aucun tag de release n'est créé.

## Matrice de prérequis

Toutes les lignes sont rattachées au candidat de code ci-dessus ; les états GitHub
ont été relevés le 5 octobre 2026. Aucun prérequis n'a été exclu par le mainteneur.
CODE_VERIFIED signifie code/PR et tests locaux ou CI, pas validation opérationnelle.

| Exigence | Issue / PR | Résultat | Preuve / limite | Responsable proposé |
|---|---|---|---|---|
| Accès privés et tokens | #218 / PR #239 ne traite que #217 | BLOCKED | #218 ouvert ; @PublicApi et DTO contenant tokens/resultJson encore présents | Security + mainteneur |
| Secrets et rotation | #219 | UNVERIFIED | Ouvert ; aucune attestation de rotation/scan ni preuve de purge | Security + exploitant |
| Budget et disponibilité | #223 | UNVERIFIED | Ouvert ; aucune mesure Raspberry/deadline globale validée | Backend + DevOps |
| Stockage tokens | #226 | BLOCKED | Ouvert ; champs reportToken/publicToken encore utilisés | Security + Backend |
| Écritures/rate-limit | #227 | UNVERIFIED | Ouvert ; pas de preuve de limites d’usage ni newsletter uniforme | Security + Backend |
| Publication atomique | #228 | BLOCKED | Ouvert ; complete puis publishIfAbsent séparés ; pas de preuve DB concurrente | Backend + QA |
| Comparabilité | #44 | UNVERIFIED | Ouvert ; preuve de méthode compatible dans l’historique absente | Produit + Backend |
| Confiance/couverture | #48 | UNVERIFIED | Ouvert ; qualification accessibilité distincte de couverture pondérée des scores | Produit + QA |
| Global par domaine | #249 / PR #254 | CODE_VERIFIED | PR fusionnée ; 25 % par domaine, renormalisation et tests ScoreService présents et CI verte | Produit + Tech Lead |
| Priorités gain/cause | #250 | UNVERIFIED | Ouvert ; aucune preuve de calibration/déduplication des causes | Produit + QA |
| Audit technique | #128 / PR #238 | UNMERGED_DOCUMENT | PR fermée sans fusion ; document retrouvé à 3c959ebe ; absent sur main | Mainteneur + Tech Lead |
| Accessibilité | #257 / #260–#263 / PR #264–#267 | PARTIAL | Trois PR fusionnées ; règles runtime pending ; matrice #267 en revue | Juridique/Produit + QA |
| CI quatre apps | #258 / PR #268 | CI_VERIFIED | 4 jobs + 3 probes négatives verts sur 4fa53e3, run 37307710975 | DevOps + QA |
| Required checks | #258 | UNVERIFIED | 403 connecteur ; procédure disponible, enforcement non vérifié | Administrateur dépôt |
| Modules HTTP/HTML | #151/#152 / PR #162/#161 | CODE_VERIFIED | Issues fermées, PR fusionnées ; tests unitaires CI verts, pas de parcours réel courant | Backend + QA |
| Runtime/Lighthouse | #153/#154 / PR #160/#164 | CODE_VERIFIED | PR fusionnées ; contrats Node et Java testés, pas de preuve Chromium ARM64 courante | Backend + QA |
| SSL/Observatory | #155/#156 / PR #163/#165 | CODE_VERIFIED | PR fusionnées ; mocks unitaires, services externes non audités dans ce lot | Backend + QA |
| ZAP/Tech | #157/#158 / PR #166/#159 | CODE_VERIFIED | PR fusionnées ; tests unitaires, pas de validation de tous les modules sur site contrôlé | Security + QA |
| Parcours réel et concurrence | #64 / #228 | UNVERIFIED | Issue #64 ouverte ; absence d’environnement MariaDB + 4 services contrôlé et de preuve E2E | QA + Backend |
| Dépendances JS | #259 constat daté | UNREVIEWED_RISK | npm audit : Lighthouse 25 alertes dont 9 high ; Playwright 3 dont 1 high ; exploitabilité non analysée | Security + mainteneur |
| Sauvegarde/restauration | #259 / infra/RUNBOOK.md | UNVERIFIED | Runbook diagnostic présent ; restauration MariaDB et retour après migration non démontrés | DevOps + exploitant |
| Raspberry / SHA déployé | #259 / deploy-*.yml | UNVERIFIED | Workflows auto push main présents ; pas de connexion au Pi ni preuve de révision/santé/ressources | Exploitant |
| Décision de sortie | #259 | NO_GO | Aucune exclusion de prérequis acceptée ; GO humain absent | @dokor, à confirmer |

Liens vers les [issues](https://github.com/dokor/argos/issues) et
[PR](https://github.com/dokor/argos/pulls) du dépôt. Les responsables ci-dessus
sont des rôles proposés, pas des assignations ou validations acquises.

## Réconciliation sans doublons

**#249** : [PR #254 fusionnée](https://github.com/dokor/argos/pull/254), merge
`59e3a44f2fcfeac19f89948747372270b4ee469b`. ScoreService sur le candidat a
quatre poids 0,25, renormalise sur les domaines mesurables et produit un global
indisponible 0/0 sans mesure. Les tests ScoreService passent dans la CI candidate.
La comparabilité historique (#44), la couverture (#48) et la calibration produit
restent des sujets distincts. Proposer la clôture/réconciliation au mainteneur,
sans réimplémentation ni clôture automatique.

**#128** : [PR #238](https://github.com/dokor/argos/pull/238) fermée **non fusionnée**.
Le document existe dans
[la révision 3c959ebe](https://github.com/dokor/argos/blob/3c959ebe963f1a68cfa5d325de0865e909c3d49a/docs/audits/2026-07-backend-audit.md)
et les chantiers #217–#237 existent. Il est absent sur main ; le mainteneur doit
décider de récupérer ce livrable ou de consigner son acceptation externe. Les
constats de juillet ne sont pas tous revérifiés ici. Aucune nouvelle roadmap créée.

**#218** : [PR #239](https://github.com/dokor/argos/pull/239) indique explicitement
que le contrôle d'accès a été sorti de son périmètre. Sa fusion prouve le
durcissement SSRF #217, pas la protection des tokens. La lecture actuelle trouve
AuditsWs @PublicApi et AuditService exposant encore des champs sensibles.
Il s'agit d'un constat statique ; aucun token réel n'a été récupéré.

**#228** : AuditProcessorService appelle complete puis publishIfAbsent. Les mocks
de succès/erreur ne prouvent pas l'atomicité de transactions concurrentes MariaDB.
Une CI unitaire verte ne résout pas cette exigence.

## Risque dépendances observé

npm audit consulté le 5 octobre 2026, lockfiles du candidat, sans mise à jour :
Lighthouse : 16 moderate + 9 high ; Playwright : 1 low + 1 moderate + 1 high.
Ce sont des alertes de dépendances, incluant propagation transitive, pas autant
d'exploitations démontrées. Exemples :
[ws](https://github.com/advisories/GHSA-58qx-3vcg-4xpx),
[extract-zip](https://github.com/advisories/GHSA-jmr9-qjv8-65gv),
[path-to-regexp](https://github.com/advisories/GHSA-37ch-88jc-xwx2).
La CI #258 n'est pas un scan de sécurité bloquant. Il faut une analyse
d'exploitabilité et une correction ou acceptation de risque nominative avant GO.
Aucun npm audit fix ni upgrade navigateur n'a été exécuté dans ces trois lots.

## Protocole de validation restant

Sur un environnement représentatif **autorisé** (MariaDB isolée, quatre services,
versions/images identifiées), choisir des fixtures web sous contrôle du projet :
page saine, erreurs connues, redirection, timeout, anti-bot simulé et LHR vide/partiel.
Ne pas utiliser un site tiers comme substitut de preuve sans autorisation.

1. Consigner SHA candidat, SHA/config des quatre services, architecture, versions
   Node/Java/Chromium, policy/fingerprint, migrations et identifiant de fixture.
2. Soumettre un audit et constater QUEUED → RUNNING → COMPLETED, progression et
   exactement un rapport accessible par son lien privé ; interroger aussi la DB.
3. Pour chaque panne, vérifier couverture, états indisponibles, données partielles
   et absence de note zéro fabriquée/verdict de conformité. Comparer FR/EN.
4. Deux workers/POST concurrents : barrières de départ et DB réelle ; un claim par
   run, aucune publication dupliquée/orpheline, reprise et idempotence vérifiées.
5. Vérifier anonymement/admin les listes, historique, runs/statut et écriture :
   refus attendu, absence de token/resultJson/erreur interne, quota atteint et
   newsletter uniforme. Preuves privées expurgées, jamais un vrai token public.
6. Mesurer séparément attente en file et exécution, pic RAM des services/DB, taux
   d'échec et traces OOM. Seuils proposés pour discussion : cible fonctionnelle
   annoncée ~20 s d'exécution, plafond d'audit à définir dans #223 ; aucun seuil
   RAM chiffré accepté sans connaître le Pi et les autres charges.
7. Vérifier restoration d'une sauvegarde MariaDB en environnement isolé, cohérence
   Flyway et rapport. Préserver l'ancienne image/config. Une migration non
   réversible exige restauration compatible ou correction avant, pas seulement
   docker compose sur l'ancienne image.
8. Après autorisation et déploiement par l'exploitant : relever le SHA réellement
   déployé, health des quatre services, un audit de contrôle, RAM/CPU/OOM et la
   cohérence des migrations ; compléter les preuves liées à ce SHA.

Le [runbook existant](../../infra/RUNBOOK.md) couvre les services locaux.
Ses mentions historiques Node20/node:20-slim ne décrivent pas les Dockerfiles
actuels (image Playwright 1.58.2-jammy). Relever réellement node --version dans
l'image Raspberry et vérifier ≥22.19 pour Lighthouse ; le succès de CI Node24
n'atteste pas cette compatibilité ARM64.

Les workflows deploy-*.yml réagissent déjà aux pushes main sur un runner
auto-hébergé. Cette PR ne modifie pas leur ordonnancement et ne vaut pas
autorisation de production ; le mainteneur doit prendre en compte ces déclencheurs
avant fusion des PR applicatives, car CI et déploiement ne sont pas séquencés.

## Décision à consigner dans #259

Copier ce tableau dans l'issue et joindre des preuves expurgées après validation :

| Champ | Valeur actuelle |
|---|---|
| Évaluation technique | NO-GO — prérequis bloquants et preuves opérationnelles manquants |
| Décision humaine finale / décideur / date | en attente / proposé @dokor / non renseignée |
| SHA/tag candidat de release | non désigné ; 4fa53e3 est uniquement le candidat de code CI |
| SHA déployé | inconnu |
| Exclusions acceptées / justification / risque | aucune |
| Sites et seuils de référence validés | à valider |
| Santé, audit de contrôle, backup/restore Raspberry | non exécutés |
| Conditions de réévaluation | résoudre ou faire accepter explicitement les écarts, choisir le SHA final, rejouer les preuves |

Une fusion documentaire ne convertit jamais NO-GO en GO. #259 reste ouverte
jusqu'à la décision GO humaine et aux preuves exigées. Revue ADE 1.2.1 :
Tech Lead/QA/DevOps/Security, sans prétendre approuver la sortie V1.
