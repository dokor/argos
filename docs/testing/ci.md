# CI : contrôles et diagnostic

Les sources sont les [workflows](../../.github/workflows) et le
[classificateur de chemins](../../scripts/ci/changed-paths.mjs). Les PR exécutent
les jobs concernés dans un seul workflow `CI`, avec une seule détection des
fichiers modifiés. Après merge, les tests ne repartent pas : `Deploy (Raspberry)`
déploie les services concernés, puis effectue un seul auto-audit final. Le scan
de secrets conserve son passage sur chaque push main pour contrôler les commits
effectivement intégrés. Une exécution manuelle de `CI` demande tous les contrôles.
Le passage quotidien à 04:00 UTC exécute seulement les trois audits npm. Les
matrices visuelles ont leur propre déclenchement.
En cas d'échec de détection, les jobs conservent un repli vers l'exécution.

| Contrôle | Source | Périmètre |
| --- | --- | --- |
| API backend tests | [ci.yml](../../.github/workflows/ci.yml) | Maven verify, couverture, ZAP passif isolé |
| Frontend checks | [ci.yml](../../.github/workflows/ci.yml) | Scripts CI/release, lint, Vitest et build Next dans le contexte Docker de production |
| Lighthouse checks / Playwright checks | [ci.yml](../../.github/workflows/ci.yml) | Syntaxe et contrats HTTP/concurrence |
| Intégration DB | [MariaDB](mariadb.md) | Migrations, transactions, droits et concurrence sur MariaDB 11.4 |
| Controlled audit E2E | [Procédure](controlled-e2e.md) | Navigateur, pipeline, fixtures contrôlées et restauration |
| Exhaustive visual regression | [Visual regression](../../.github/workflows/visual-regression.yml) | Matrices FR/EN, thèmes, largeurs, axe, clavier et comparaisons de captures ; API simulée |
| auth | [Authentication UX E2E](../../.github/workflows/ci.yml) | Inscription, email capturé, vérification, connexion, reset et navigation FR/EN |
| Audit egress and browser isolation | [Audit security](../../.github/workflows/ci.yml) | Contrôle final des tests de confinement Chromium et egress sur AMD64 et ARM64 natifs |
| Secrets et dépendances | [Secrets](../security/secret-remediation.md), CI | Arbre/commits introduits, dépendances npm de production |
| Auto-audit après MEP | [Contrat et configuration](post-deploy-audit.md) | Contrôle authentifié du déploiement observé et tickets dédupliqués ; secrets réservés au job de contrôle |

Java 21, Node 24.21.0 et Ubuntu 24.04 sont les versions fixées dans ci.yml lors
de cette consolidation. Lire le YAML et les lockfiles pour leur évolution ; les
anciens relevés de versions ne sont pas des consignes d'installation.

Les contrôles utilisent pull_request, contents:read et un checkout sans credential
persisté. Pas de secret de production ni runner Raspberry. Le déploiement est
un workflow séparé ; une CI verte n'est ni une validation ARM64 ni une preuve
de configuration correcte des protections de branche.

## Rejouer les vérifications

Installer les dépendances de chaque application, puis lancer ses commandes de
ci.yml. Pour les helpers sans dépendances applicatives, depuis la racine :

```sh
node --test scripts/ci/*.test.mjs scripts/e2e/*.test.mjs scripts/check-release-evidence.test.mjs scripts/release/inspect-runtime.test.mjs
```

Chaque suite JavaScript est exécutée une seule fois. Le test ciblé du pipeline
Docker vérifie la propagation des codes de sortie malgré la capture des logs ;
on ne relance plus toute la suite avec une panne ajoutée artificiellement.
Le build Docker valide le contexte de production du job frontend. Les builds des
harness navigateur restent distincts, car leurs proxys visent des API locales
différentes résolues au build.

## Déclenchement selon les changements

La comparaison utilise le merge-base pour une PR. Le déploiement compare les
SHA avant/après du push main (tous les commits du push sont couverts). Les suppressions et les
anciens chemins des renommages sont inclus. Une première révision sans base
valide demande tous les contrôles ; une comparaison Git en échec déclenche le
repli complet des jobs dépendants.

| Changement seul | Jobs applicatifs exécutés |
| --- | --- |
| Documentation | Aucun ; le scan de secrets reste systématique |
| Test unitaire frontend | Frontend checks |
| Test unitaire Java | API backend tests |
| Test MariaDB IT | API backend tests et MariaDB integration |
| Code frontend | Frontend checks, audit E2E et auth |
| Code backend | API backend tests, MariaDB, audit E2E et auth |
| Collecteur Runtime ou Lighthouse | Tests du collecteur, audit E2E, sécurité Docker |
| Script navigateur auth | Auth uniquement |
| Harness visuel | Workflow visuel ; tests de helpers si le manifeste/dispatcher change |
| Lockfile d’un service | Tests de ses consommateurs et audit de ses dépendances |
| Workflow CI partagé | Tous les contrôles |
| Routage partagé ou action commune | Repli conservateur sur tous les contrôles |

Les fixtures Java et contrats partagés déclenchent tous leurs consommateurs.
Le routage reste volontairement conservateur pour le code frontend/backend :
on ne tente pas de reconstruire un graphe d’imports fichier par fichier.
Les trois audits npm sont indépendants et démarrent en parallèle. Ils tournent
aussi chaque jour à 04:00 UTC, car une vulnérabilité peut être publiée sans
modification du lockfile. Les tests de sécurité Docker ciblent les collecteurs,
la passerelle egress, leurs configurations infra et le harness de sécurité.

CI et Secrets restent déclenchés sur chaque PR vers main : seuls les jobs
coûteux de CI sont sautés. Cela conserve les statuts attendus par la protection de
branche. Le déploiement conserve la sélection par service, les builds locaux
ARM64 et les fichiers de configuration privés existants.

`Audit egress and browser isolation` est un job final au nom fixe, distinct des
workers de la matrice AMD64/ARM64. GitHub évalue la condition d'un job avant
d'étendre sa matrice : sauter directement celle-ci produit un check `matrix.name`
sans publier les noms développés attendus par la protection de branche.
Le job final est explicitement `SKIPPED` seulement si la détection a réussi et
retourné `security=false`. Sinon, il exige la réussite de la détection, une
sélection `security=true` et la réussite de toute la matrice. Une erreur, une
annulation ou un résultat manquant ne valide pas le contrôle. Le ruleset garde
le même nom obligatoire ; une omission légitime reste un skip et ne devient
pas une preuve de sécurité réussie pour le dossier de release.

## Parcours utilisateur et matrices visuelles

Le job obligatoire `Controlled audit E2E` conserve les huit audits contrôlés,
les parcours domaine/administration avec API et MariaDB réelles, les exports PDF
et la sauvegarde/restauration. Le formulaire doit naviguer lui-même vers le
rapport ; recharger un rapport publié ne doit pas relancer l'audit.
L'authentification réelle reste dans le check obligatoire `auth`.

`Visual regression` exécute les matrices exhaustives indépendamment : chaque
lundi à 03:00 UTC, à la demande sur la ref choisie, et sur les PR modifiant les
styles, layouts, assets publics ou harness visuels listés dans son YAML. Pour
une modification visuelle uniquement en TSX hors layout, lancer ce workflow
manuellement ou attendre le passage hebdomadaire. Ce check n'est pas ajouté
aux contrôles obligatoires de fusion/release. Il n'utilise ni MariaDB ni les
collecteurs d'audit : ses réponses API sont simulées.

Un seul build Next est partagé par quatre groupes indépendants (public,
analyse, compte et domaines), exécutables simultanément sur quatre runners au
maximum. Chaque groupe conserve ses répertoires de captures distincts dans
`visual-captures-<groupe>-<sha>`. Le job final exige la réussite de tous les
groupes puis assemble la matrice complète ; un groupe rouge ne peut pas être
masqué par les autres. Le build intermédiaire est conservé un jour, les preuves
quatorze jours. Le parallélisme réduit le chemin critique mais les installations
par runner ajoutent du travail ; la disponibilité des runners limite le gain.

Les preuves fonctionnelles sont dans `controlled-e2e-<sha>` ; les captures et
le manifeste `clarte-visual-v1` dans `visual-acceptance-<sha>` et les artefacts
`visual-captures-<groupe>-<sha>` associés. Le mode `--visual-only` du manifeste exige toujours la
matrice complète, mais ne revendique aucune preuve serveur. Pour une recette
combinée, réunir les deux familles d'artefacts de la **même révision testée**
avant de lancer le mode complet de `acceptance-evidence.mjs`.

Les noms des douze checks obligatoires sont conservés. Les tests de sécurité,
les migrations/transactions et le contrôle de démarrage du backend empaqueté
restent exécutés ; le harness navigateur assemble toujours explicitement
les ressources Java (voir les limites dans la procédure E2E).

## Diagnostiquer un run bloqué ou rouge

1. Lire `gh run view RUN_ID --json jobs`. Si aucune étape ni runner n'a été
   acquis, consulter les annotations via
   `gh api repos/dokor/argos/check-runs/JOB_ID/annotations` et GitHub Status.
2. Si des étapes ont tourné, analyser leurs logs avant de conclure à une panne
   d'infrastructure. Un test rouge reste une régression à examiner.
3. Relancer sur le SHA voulu après résolution. Rejouer un ancien run utilise
   son ancienne configuration ; cela ne valide pas une correction plus récente.
4. Vérifier chaque conclusion et son SHA. Un job annulé, absent ou sauté ne prouve
   pas le contrôle correspondant pour une release.

Les groupes de concurrence annulent les anciennes révisions de contrôle d'une
même ref. Les scans de secrets sur main conservent leur plage de commits ; les
déploiements et leur auto-audit se sérialisent ensemble, sans annuler le run
en cours. La file `queue: max` conserve jusqu’à 100 runs en attente ; la limite
de GitHub reste applicable. Voir [la concurrence Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
L'incident d'allocation du 5 octobre 2026 est consultable dans l'historique Git.

## Protection de main et release

Le ruleset [main: PR and required CI](https://github.com/dokor/argos/rules/25165356)
est actif depuis le 15 octobre 2026 : PR obligatoire, douze checks issus de
GitHub Actions, aucun acteur de contournement, suppression et
force push bloqués. Aucune approbation d'un second compte n'est imposée.
La configuration et les preuves négatives sont dans
[Protection de main](main-protection.md). Un check absent bloque la fusion ;
les jobs conditionnels `SKIPPED` sont acceptés par GitHub pour les chemins non
concernés. Le dossier de release exige pour sa part des succès réellement
exécutés sur la révision candidate, y compris `auth`. Un merge ou un passage
quotidien ne constitue donc pas un dossier complet de release. Pour certifier
une révision, lancer manuellement `ci.yml` et `secrets.yml` sur la même ref,
puis vérifier que tous les runs portent le SHA
candidat. Le vérificateur de release continue de refuser un check sauté ou des
preuves d'une autre révision.

Le job d'authentification est présent dans CI sur chaque PR vers main pour
éviter qu'un filtre de workflow laisse ce check obligatoire absent. Il suit
la détection des chemins auth (sauté sur documentation/tests unitaires seuls ou
modifications des collecteurs sans changement de dépendance navigateur, repli vers
l'exécution si la détection échoue). Son nom
de job `auth` fait partie du contrat de protection : coordonner tout renommage
avec le ruleset et le vérificateur du dossier de release.

Le [snapshot V1](../archive/v1-readiness-2026-10-05.md) conserve les observations
datées et validations différées ; il ne décrit pas la configuration actuelle.

## Nettoyage du 17 octobre 2026

Les suites applicatives, MariaDB, audit E2E, auth, sécurité et dépendances
étaient déclenchées en PR puis à nouveau sur main. Par exemple, les runs
[PR CI](https://github.com/dokor/argos/actions/runs/39025942630) et
[CI après merge](https://github.com/dokor/argos/actions/runs/39026412864)
montrent cette répétition. Six workflows refaisaient aussi le checkout complet
et la détection des chemins. Les mêmes douze noms de checks restent publiés ;
aucune modification du ruleset distant ni du contrat de preuves n'est requise.

Les quatorze fichiers de workflows deviennent cinq : CI, Secrets, Visual
regression, Deploy et le workflow réutilisable d'auto-audit. Les suites et leurs
artefacts restent présents. Les installations dans des runners isolés et les
builds Next des harness visant des API différentes restent nécessaires. Les
builds locaux ARM64 de production restent distincts des builds de vérification.

Pour redéployer un service sur main :

```sh
gh workflow run deploy.yml --ref main -f service=console-web
```

Le choix `all` redéploie les quatre services. Un push déploie chaque service
concerné une seule fois, séquentiellement, puis nettoie les images une seule
fois. L'auto-audit attend la réussite de tous les services sélectionnés et
vérifie leurs révisions exactes avant ses deux analyses. Un échec de déploiement
empêche ce verdict global ; le workflow reste rouge et doit être diagnostiqué.
