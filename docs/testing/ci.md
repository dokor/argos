# CI : contrôles et diagnostic

Les sources sont les [workflows](../../.github/workflows) et le
[classificateur de chemins](../../scripts/ci/changed-paths.mjs). Les PR exécutent
les jobs concernés ; un push main ou workflow_dispatch demande la matrice complète.
En cas d'échec de détection, les jobs conservent un repli vers l'exécution.

| Contrôle | Source | Périmètre |
| --- | --- | --- |
| API backend tests | [ci.yml](../../.github/workflows/ci.yml) | Maven verify, couverture, ZAP passif isolé |
| Frontend checks | [ci.yml](../../.github/workflows/ci.yml) | Scripts CI/release, lint, Vitest, build Next et probe négative |
| Lighthouse checks / Playwright checks | [ci.yml](../../.github/workflows/ci.yml) | Syntaxe, contrats HTTP/concurrence et probe négative |
| Intégration DB | [MariaDB](mariadb.md) | Migrations, transactions, droits et concurrence sur MariaDB 11.4 |
| Controlled audit E2E | [Procédure](controlled-e2e.md) | Navigateur, pipeline, fixtures contrôlées et restauration |
| auth | [Authentication UX E2E](../../.github/workflows/auth-experience.yml) | Inscription, email capturé, vérification, connexion, reset et navigation FR/EN |
| Secrets et dépendances | [Secrets](../security/secret-remediation.md), workflows dédiés | Arbre/commits introduits, dépendances npm de production |

Java 21, Node 24.21.0 et Ubuntu 24.04 sont les versions fixées dans ci.yml lors
de cette consolidation. Lire le YAML et les lockfiles pour leur évolution ; les
anciens relevés de versions ne sont pas des consignes d'installation.

Les contrôles utilisent pull_request, contents:read et un checkout sans credential
persisté. Pas de secret de production ni runner Raspberry. Les déploiements sont
des workflows séparés ; une CI verte n'est ni une validation ARM64 ni une preuve
de configuration correcte des protections de branche.

## Rejouer et vérifier la propagation des échecs

Installer les dépendances de chaque application, puis lancer ses commandes de
ci.yml. Pour les helpers sans dépendances applicatives, depuis la racine :

```sh
node --test scripts/ci/changed-paths.test.mjs scripts/ci/frontend-build-pipelines.test.mjs scripts/check-release-evidence.test.mjs scripts/release/inspect-runtime.test.mjs
```

Depuis chaque application JS :

```sh
node ../../scripts/verify-ci-failures.mjs frontend
# ou lighthouse / playwright
```

La probe crée sa fixture réservée, exige un code non nul et le marqueur
CI_NEGATIVE_PROBE, puis la retire. Un échec réel n'est jamais ignoré.

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
éviter qu'un filtre de chemins laisse ce check obligatoire absent. Son nom
de job `auth` fait partie du contrat de protection : coordonner tout renommage
avec le ruleset et le vérificateur du dossier de release.

Le [snapshot V1](../archive/v1-readiness-2026-10-05.md) conserve les observations
datées et validations différées ; il ne décrit pas la configuration actuelle.
