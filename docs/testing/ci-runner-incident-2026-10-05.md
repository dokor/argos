# Runners CI — incident du 5 octobre 2026 (#292)

Investigation depuis main `b8e2d59f221721c308f3a39e6936c3e8d3511eaf`.
Le [run CI main](https://github.com/dokor/argos/actions/runs/37368966467) et
[l'E2E main](https://github.com/dokor/argos/actions/runs/37368966582) échouent au
niveau workflow alors que les jobs concernés n'ont aucune étape ni runner acquis.
Leurs annotations indiquent : `The job was not acquired by Runner of type hosted
even after multiple attempts`. Ce sont des échecs d'allocation, pas des assertions.

[GitHub Status](https://www.githubstatus.com/incidents/3q1yb5m7ltvb) confirme un
incident Actions depuis 19:11 UTC (21:11 Paris), avec retards/échecs d'attribution
des runners hébergés. Les jobs frontend et Lighthouse qui démarrent passent ; le
frontend a exécuté 31 tests de scripts, 149 tests applicatifs, lint/build et la
probe négative. Les déploiements self-hosted ont également terminé avec succès.
Cela ne prouve pas les contrôles restés sans runner.

## Correctifs de pipelines

- Ubuntu est fixé à `ubuntu-24.04`, au lieu de l'alias changeant `ubuntu-latest`.
  Cette stabilité de plateforme ne résout pas l'incident du fournisseur.
- CI, E2E, MariaDB et audit npm gardent seulement le run actif/pending utile par
  workflow/ref ; une nouvelle révision annule l'ancienne. Les groupes incluent
  le workflow pour éviter qu'un pipeline annule un autre. PR et main restent distincts.
- Matrices MariaDB 10.11/11.4 et npm trois apps limitées à un job parallèle par
  matrice. Les 13 noms de checks sont conservés. Pour une révision complète, le
  fan-out maximal passe de 13 à 9 jobs. `fail-fast: false` conserve les résultats
  des autres versions/apps si un test ou un scan échoue.
- Le job progress sélectionne explicitement `AuditRunProgressIT` ; migration,
  publication, claims et newsletter restent exécutés par la matrice credentials.
- Le scanner de secrets annule seulement les anciens runs d'une même PR : la
  nouvelle analyse couvre tout `base..HEAD`. Chaque push main utilise un groupe
  unique par run et conserve son scan `before..HEAD`, afin de ne pas sauter un
  commit intermédiaire sous prétexte de réduire la file.
- Les déploiements sont sérialisés **par service**, sans annulation d'un run en
  cours. Une nouvelle révision remplace l'ancienne en attente de ce même service.
  Les quatre services ont des groupes distincts pour conserver chaque déploiement.
- Les six workflows de contrôle acceptent `workflow_dispatch` après fusion, pour
  relancer un candidat précis. Les workflows de déploiement n'ajoutent pas ce trigger.

Aucun test, budget, version de MariaDB, scan ou probe n'est retiré. Aucun retry
silencieux ni `continue-on-error` ne transforme un échec en réussite. Les groupes
de concurrence ne libèrent pas les jobs déjà lancés avec l'ancienne configuration.
Aucun ancien run ou déploiement n'est annulé manuellement dans cette correction.

## Diagnostic et relance

1. Lister les jobs du run (`gh run view RUN_ID --json jobs`). Un job annulé, sans
   runner ni étapes, peut ne fournir aucun log ; consulter ses annotations avec
   `gh api repos/dokor/argos/check-runs/JOB_ID/annotations`.
2. Si un runner a exécuté des étapes, analyser celles en échec et leurs logs avant
   de classer l'erreur comme infrastructure. Un test rouge reste une régression.
3. Consulter GitHub Status. Après rétablissement, relancer les checks concernés
   avec la configuration corrigée, sur le SHA choisi. Rerun d'un ancien run utilise
   son ancienne révision/configuration : il ne valide pas cette PR.
4. Après fusion, utiliser Run workflow sur chacun des six workflows de contrôle,
   ou `gh workflow run NOM_DU_FICHIER --ref main`. Vérifier les 13 conclusions et
   le SHA ; aucun succès global ne remplace un job manquant/annulé.

La concurrence suit la [documentation GitHub officielle](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
Les déploiements restent déclenchés par push main selon leurs filtres existants ;
un workflow de contrôle manuel ne déclenche pas de déploiement.
