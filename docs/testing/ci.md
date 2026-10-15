# CI : contrôles et diagnostic

Les sources sont les [workflows](../../.github/workflows) et le
[classificateur de chemins](../../scripts/ci/changed-paths.mjs). Les PR exécutent
les jobs fonctionnels concernés ; un push main ou workflow_dispatch demande tous
les contrôles fonctionnels. Les matrices visuelles ont leur propre déclenchement.
En cas d'échec de détection, les jobs conservent un repli vers l'exécution.

| Contrôle | Source | Périmètre |
| --- | --- | --- |
| API backend tests | [ci.yml](../../.github/workflows/ci.yml) | Maven verify, couverture, ZAP passif isolé |
| Frontend checks | [ci.yml](../../.github/workflows/ci.yml) | Scripts CI/release, lint, Vitest et build Next dans le contexte Docker de production |
| Lighthouse checks / Playwright checks | [ci.yml](../../.github/workflows/ci.yml) | Syntaxe et contrats HTTP/concurrence |
| Intégration DB | [MariaDB](mariadb.md) | Migrations, transactions, droits et concurrence sur MariaDB 11.4 |
| Controlled audit E2E | [Procédure](controlled-e2e.md) | Navigateur, pipeline, fixtures contrôlées et restauration |
| Exhaustive visual regression | [Visual regression](../../.github/workflows/visual-regression.yml) | Matrices FR/EN, thèmes, largeurs, axe, clavier et comparaisons de captures ; API simulée |
| auth | [Authentication UX E2E](../../.github/workflows/auth-experience.yml) | Inscription, email capturé, vérification, connexion, reset et navigation FR/EN |
| Secrets et dépendances | [Secrets](../security/secret-remediation.md), workflows dédiés | Arbre/commits introduits, dépendances npm de production |

Java 21, Node 24.21.0 et Ubuntu 24.04 sont les versions fixées dans ci.yml lors
de cette consolidation. Lire le YAML et les lockfiles pour leur évolution ; les
anciens relevés de versions ne sont pas des consignes d'installation.

Les contrôles utilisent pull_request, contents:read et un checkout sans credential
persisté. Pas de secret de production ni runner Raspberry. Les déploiements sont
des workflows séparés ; une CI verte n'est ni une validation ARM64 ni une preuve
de configuration correcte des protections de branche.

## Rejouer les vérifications

Installer les dépendances de chaque application, puis lancer ses commandes de
ci.yml. Pour les helpers sans dépendances applicatives, depuis la racine :

```sh
node --test scripts/ci/*.test.mjs scripts/e2e/acceptance-evidence.test.mjs scripts/check-release-evidence.test.mjs scripts/release/inspect-runtime.test.mjs
```

Chaque suite JavaScript est exécutée une seule fois. Le test ciblé du pipeline
Docker vérifie la propagation des codes de sortie malgré la capture des logs ;
on ne relance plus toute la suite avec une panne ajoutée artificiellement.
Le build Docker remplace le second build Next du job frontend. Les builds des
harness navigateur restent distincts, car leurs proxys visent des API locales
différentes résolues au build.

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

Les preuves fonctionnelles sont dans `controlled-e2e-<sha>` ; les captures et
le manifeste `clarte-visual-v1` dans `visual-acceptance-<sha>` et les artefacts
visuels associés. Le mode `--visual-only` du manifeste exige toujours la
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
déploiements se sérialisent par service sans annuler un déploiement en cours.
L'incident d'allocation du 5 octobre 2026 est consultable dans l'historique Git.

## Protection de main et release

Le ruleset [main: PR and required CI](https://github.com/dokor/argos/rules/25165356)
est actif depuis le 15 octobre 2026 : PR obligatoire, douze checks issus de
GitHub Actions, branche à jour, aucun acteur de contournement, suppression et
force push bloqués. Aucune approbation d'un second compte n'est imposée.
La configuration et les preuves négatives sont dans
[Protection de main](main-protection.md). Un check absent bloque la fusion ;
les jobs conditionnels `SKIPPED` sont acceptés par GitHub pour les chemins non
concernés. Le dossier de release exige pour sa part des succès réellement
exécutés sur la révision candidate, y compris `auth`.

Le workflow d'authentification se déclenche sur chaque PR et push main pour
éviter qu'un filtre de workflow laisse ce check obligatoire absent. Son job suit
la détection des chemins E2E (sauté sur documentation seule, repli vers
l'exécution si la détection échoue). Son nom
de job `auth` fait partie du contrat de protection : coordonner tout renommage
avec le ruleset et le vérificateur du dossier de release.

Le [snapshot V1](../archive/v1-readiness-2026-10-05.md) conserve les observations
datées et validations différées ; il ne décrit pas la configuration actuelle.
