# Client CI Premium Argos — préversion 0.4.0

Client Node.js 24, autonome, sans dépendance npm, Docker, compte interactif ou
accès aux conteneurs Argos. **L’accès serveur reste désactivé jusqu’à la recette
#467.** Le connecteur GitHub #739 peut publier sur opt-in, avec GITHUB_TOKEN et
un registre privé Azure du client. Le connecteur GitLab #740 est également
disponible sur opt-in, avec un credential dédié au projet.
`publication-preview` vérifie la preuve et calcule
seulement le nombre de constats confirmés éligibles, sans mutation Git.

La documentation développeur publique sur le site reste le lot #742.
[Politique de synchronisation et décisions humaines](../../docs/ci/issue-synchronization.md).
[Configuration, stockage, chiffrement et reprise du publisher GitHub](../../docs/ci/github-publication.md).
[Configuration, droits et reprise du publisher GitLab](../../docs/ci/gitlab-publication.md).
[English instructions](README.en.md). Contrats : [admission](../../docs/ci/admission.md),
[erreurs](../../docs/ci/errors.md), [verdict](../../docs/ci/verdicts.md),
[exports privés](../../docs/ci/private-exports.md), [OpenAPI](../../docs/ci/openapi-v1.json).

## Installation reproductible

Copier le [modèle GitHub Actions](templates/github-actions.yml) ou le
[modèle GitLab CI](templates/gitlab-ci.yml). Ils téléchargent uniquement le
fichier `dist/argos-ci.mjs` à une révision complète, vérifient son SHA-256 fixé
dans le modèle, puis l’exécutent. Aucun checkout, npm install ou script du projet
audité n’est exécuté. Le checksum attendu doit venir de cette distribution revue,
pas d’un fichier téléchargé avec le programme. Une mise à jour exige de revoir
ensemble révision, version, politique et checksum.

On peut aussi copier ce fichier vérifié dans un environnement Node 24 Windows,
Linux ou macOS. Utiliser un répertoire physique privé (sans symlink), un compte
de runner dédié et un ACL privé sous Windows. `--version` et `--help` sont hors
ligne. Les modèles SaaS visent GitHub.com et GitLab.com ; les instances privées
et les registries de distribution privées ne sont pas supportées dans cette version.

## Configuration

| Variable | Usage |
| --- | --- |
| ARGOS_API_KEY | Secret machine obligatoire ; jamais un argument CLI, email, mot de passe ou token de rapport |
| ARGOS_TARGET_URL | URL HTTPS publique autorisée, sans query, fragment, credential ou port alternatif |
| ARGOS_SAMPLES | 2 par défaut ; 1 reste exploratoire et produit CONFIRMATION_REQUIRED |
| ARGOS_TIMEOUT_SECONDS | Budget global 1..3600 s, défaut 1200 s ; configurer le job CI avec une marge supérieure |
| ARGOS_LANG | fr (défaut) ou en |
| ARGOS_ENVIRONMENT | production (défaut), staging ou preview ; simple déclaration |
| ARGOS_DEFAULT_BRANCH | Branche GitHub de confiance, défaut main ; utiliser la branche par défaut réelle |
| ARGOS_IDEMPOTENCY_KEY | UUID canonique optionnelle de l’intention initiale ; conserver après toute ambiguïté |
| ARGOS_EXPORT_PRIVATE | 1 pour écrire un artefact local privé, absent par défaut |
| ARGOS_OUTPUT_DIR | Répertoire physique privé, défaut .argos-ci ; refus de symlink et d’écrasement |
| ARGOS_EXPORT_RUN_ID | Run COMPLETED de la même admission, pour la commande export |

L’origine API est fixée à `https://argos.lelouet.fr`. Aucun paramètre ne peut la
remplacer. La clé ne quitte pas cette origine ; TLS reste vérifié, les redirections
et formats inconnus sont refusés, les succès sont bornés à 64 Kio et erreurs à
4 Kio. L’échéance par requête, corps compris, est au plus 15 secondes et reste
dans le budget global. Ne pas utiliser `NODE_OPTIONS`, un loader, une désactivation
TLS, `set -x`, `curl -v`, un dump d’environnement ou une sortie de corps HTTP.
Les modèles neutralisent NODE_OPTIONS et imposent TLS. Un mode verbose n’existe
pas ; les arguments inconnus sont refusés sans être recopiés.

Le contexte CI fournit dépôt, SHA, run/pipeline, tentative et job producteur.
En local, fournir aussi ARGOS_REPOSITORY (groupe/projet), ARGOS_SHA (40 hex),
ARGOS_INVOCATION (identifiant:tentative, sans espace, par exemple 123:1) et
ARGOS_PRODUCER_ID (nom du producteur). Utiliser une nouvelle invocation pour un
nouveau contrôle intentionnel. Pour plusieurs intentions dans le même pipeline,
attribuer explicitement des UUID distinctes et durables. L’intention dérivée est
stable pour le même dépôt/fournisseur/run, y compris une nouvelle tentative du
job. Changer l’URL ou le nombre de mesures sous cette intention doit donner un
conflit serveur ; cela ne crée pas automatiquement un audit différent.

## Commandes et reprises

```sh
node argos-ci.mjs doctor
node argos-ci.mjs intent
node argos-ci.mjs audit
node argos-ci.mjs resume
```

`doctor` lit politique, identité et preflight. Il vérifie configuration, clé,
trois scopes (audits:write, results:read, usage:read), droit courant, cible déclarée
vérifiée et quota disponible. Il ne résout pas le DNS cible, ne contacte pas le
site, ne crée ni run, réservation, fichier ou ticket. READY est un précontrôle,
pas une réservation ni une garantie de capacité future. Les valeurs des variables
et les cibles reçues ne sont pas imprimées. Une erreur contient code, étape,
action contrôlée FR/EN, lien documentaire de confiance et requestId si disponible.
Les liens /docs/errors sont réservés pour #742 ; ce README et le catalogue
versionné sont utilisables avant leur publication en ligne.

`audit` vérifie la politique avant admission, cherche l’intention, puis soumet
le même corps et la même UUID. Une réponse perdue entraîne d’abord une recherche
par clé ; un POST ne peut être rejoué qu’avec la même clé et le même corps, au
plus trois tentatives dans le budget. Un ID retrouvé seul ne prouve pas que des
paramètres modifiés correspondent : seul le succès du POST idempotent les confirme.
Une réponse illisible arrête le contrôle après récupération en lecture, sans
promouvoir le résultat en GO. Les refus permanents ne sont pas réessayés.
Les lectures transitoires ont trois tentatives au plus, backoff/jitter et
Retry-After. Le polling du verdict est séquentiel, environ 5 puis 10 secondes.
Il ne recalcule jamais un GO depuis le score ou l’export.

`resume` est **strictement en lecture** : il reprend l’intention initiale, y
compris après une rotation de clé conservant intégration et périmètre. Garder
sa configuration initiale ; cette commande ne valide pas de nouveaux paramètres
de cible. Elle ne poste jamais, ne recrée pas un rapport expiré et ne réserve
aucun crédit. Après perte du droit commercial, une clé encore valide peut lire
son passé ; une clé expirée/révoquée exige une rotation dans le même emplacement.

SIGINT/SIGTERM interrompt requêtes et attente ; la deadline globale couvre aussi
les corps bloqués. Une fin forcée du runner peut empêcher tout dernier diagnostic.
**Elle n’annule pas l’admission serveur.** Les runs restent soumis aux échéances,
à la reprise du scheduler et à la libération des réservations du backend ; reprendre
la même intention, ne pas en fabriquer une autre. La recette #467 devra vérifier
le reaper et les annulations en conditions réelles.

Deux mesures réservent deux analyses ensemble, exécutées séquentiellement. Chaque
rapport produit, même partiel, consomme une analyse ; sans rapport, la réservation
est libérée selon le contrat serveur. Base Premium : 30 analyses/mois par
intégration stable de clé, trois clés incluses, une analyse simultanée par compte,
domaines vérifiés illimités, clé valable un an. QUOTA_EXCEEDED ne boucle pas,
même avec un Retry-After long. Une rotation ne réinitialise pas la consommation.

## Résultats et publication séparée

| Code | Signification |
| --- | --- |
| 0 | GO, ou commande de précontrôle terminée |
| 1 | SITE_NO_GO confirmé |
| 2 | CONTROL_FAILED : authentification, droit, transport, délai ou mesure insuffisante |
| 3 | Publication activée échouée/indéterminée ; le verdict d’audit reste celui du job de contrôle |

Une seule ligne JSON bornée expose version, verdict, codes, statut de publication,
diagnostic contrôlé et éventuellement digest. Aucun DTO privé n’apparaît dans
stdout/stderr, résumé ou annotation. Le SHA et l’environnement sont déclaratifs :
`deploymentRevisionAttested=false`, sans preuve de révision réellement déployée,
comparaison historique, rollback ou exception propre au site Argos.

Avec ARGOS_EXPORT_PRIVATE=1, un GO ou SITE_NO_GO écrit `evidence.json` (`ci-evidence-v2`) : verdict
filtré et provenance, sans cible, texte brut ni credential. Sa durée de vie est
au plus sept jours ET limitée par l’expiration des deux rapports sources ; taille 64 Kio. Un contrôle impossible ne produit aucun
artefact de constats. Le fichier est privé, créé exclusivement (0600 sur Unix),
sans écrasement ; nettoyer le dossier local après usage. Les métadonnées et
constats restent privés même si leur contenu vient d’un catalogue contrôlé.

L’upload est volontaire. Les modèles le conditionnent au consentement et à une
vérification API de confidentialité de la destination ; sur GitLab ils exigent
aussi `keep_latest_artifact=false` pour que le dernier succès n’échappe pas à
l’expiration. Réduire les accès du dépôt/projet et des artefacts, appliquer au
plus sept jours, et supprimer les copies chez le fournisseur avant tout changement prévu
de visibilité, immédiatement en cas de dérive, ou sur demande de suppression. Une copie externe n’est pas révoquée
par DELETE côté Argos. Les diagnostics éventuels restent au plus 24 h ; les
modèles n’uploadent pas les logs ni un diagnostic séparé.

`export` est une commande volontaire en lecture. Elle vérifie le run COMPLETED,
summary-v1 et details-v1, le catalogue, la taille et l’identité, puis écrit seulement
`details.json` privé. Ne pas interpréter omittedFindings comme une couverture
exhaustive ; seul verdict-v1 décide. Les modèles n’uploadent pas ce fichier.
Les rapports serveur expirent au plus après 30 jours. DELETE terminal sous
audits:write + results:read est décrit dans l’OpenAPI, sans nouveau crédit.

`publication-preview` n’utilise pas de clé Argos. Sur GitHub, fournir
ARGOS_EVIDENCE_SHA256 et ARGOS_EVIDENCE_PRODUCER depuis les sorties du producteur
de la même exécution, et télécharger exclusivement son artifact-id. Sur GitLab,
la preuve vient de l’API du pipeline courant (job nommé argos_control, hors jobs
remplacés, même SHA), puis du digest contrôlé de sa trace. Le token protégé
ARGOS_GITLAB_READ_TOKEN doit avoir seulement read_api sur ce projet ; il ne va
jamais chez Argos. Le hash n’est pas lu dans l’artefact. Dépôt, SHA, tentative,
producteur, environnement, version, schéma, expiration, fichier régulier sans
symlink/hardlink et taille sont vérifiés avant parsing/publication. Un échec
ne déclenche jamais de nouvel audit. Les publishers doivent revérifier
la visibilité juste avant chaque écriture et réconcilier les créations ambiguës.

La version 0.2 exige une preuve relue depuis quinze minutes maximum. Après une
attente plus longue, `resume` dans un job sans droits Git réactualise le verdict,
l’admission et les deux synthèses, avec la clé et l’UUID d’intention d’origine,
dans un dossier neuf. Zéro POST/nouvelle analyse ; la date de début des mesures
reste inchangée. Transmettre ensuite le nouveau digest hors artefact au job Git
séparé. Une preuve v1 ne peut pas être promue localement en v2. Une suppression
après la relecture n’est pas une révocation instantanée de cette copie : la fenêtre
de fraîcheur de quinze minutes doit être acceptée dans #467.

La prévisualisation accepte ARGOS_PUBLICATION_ENVIRONMENTS,
ARGOS_PUBLICATION_CATEGORIES et ARGOS_PUBLICATION_SEVERITIES (CSV de valeurs
connues), ARGOS_PUBLICATION_LABELS et ARGOS_PUBLICATION_MAX_NEW (0..10, défaut 5).
Le moteur commun ajoute DISABLED par défaut, aperçu sans mutation, identité
stable, budgets persistants, réconciliation et décisions humaines. Ses
[exemples GitHub/GitLab](examples/) restent désactivés et utilisent des IDs fictifs.
Il exige un journal privé durable et un verrou partagé vérifié ; les futurs
connecteurs ne peuvent pas activer SYNC en annonçant ces garanties sans les
implémenter. Les fermetures sont respectées par défaut ; une réouverture exige
une observation postérieure à la décision et une condition atomique prouvée.

## Intégration des modèles

GitLab avec publication : utiliser [gitlab-publication.yml](templates/gitlab-publication.yml)
à la place du modèle de contrôle/aperçu ci-dessous. Il transfère seulement une
preuve chiffrée, vérifie la provenance par API/trace, utilise un token read_api
séparé du token api de publication et les SAS r/rw du registre privé dans des
environnements distincts. Les rôles acceptés sont Planner/Reporter, jamais
Maintainer/admin ; token de projet privilégié, identité dédiée seulement sur
choix explicite. [Offres, limites, configuration et recette requise](../../docs/ci/gitlab-publication.md).
Les instances Self-Managed restent hors périmètre. Publication off par défaut,
aucune réouverture, reprise du seul publisher ou resume sans nouvelle analyse.

GitHub : protéger la branche par défaut et l’environnement `argos-ci`, ajouter
ARGOS_API_KEY à cet environnement et ARGOS_TARGET_URL aux variables. Le modèle
accepte push sur main et le lancement manuel ; la branche par défaut est aussi vérifiée défensivement
par le client. Aucun événement PR, pull_request_target ou workflow_run, aucun
checkout de code client. Le token GitHub de lecture est limité aux étapes de
vérification de destination. Seul le job optionnel isolé `argos_publish` reçoit
issues:write et actions:read, sans clé API Argos. Activer
ARGOS_PRIVATE_ARTIFACTS=true et/ou ARGOS_PUBLICATION_PREVIEW=true uniquement
dans un dépôt privé. Un SITE_NO_GO échoue au contrôle et autorise la prévisualisation
du même artefact ; un CONTROL_FAILED ne peut pas produire de constats.

Pour la publication effective : suivre le [raccordement GitHub](../../docs/ci/github-publication.md)
et configurer `ARGOS_PUBLICATION_CONFIG`, `ARGOS_GITHUB_PUBLISH`, ainsi que les
SAS du registre privé dans les environnements séparés. `publication-stage`
produit uniquement une preuve chiffrée transférable sept jours même dans un
dépôt public ; `publish-github` vérifie les digests externes, la provenance et la
fraîcheur de quinze minutes, puis utilise le moteur #738. Aucune réouverture
GitHub automatique. Le lancement manuel `operation=resume` demande l’UUID
initial et ne crée aucune analyse. Un publisher relancé seul consomme la
tentative originale sortie par le contrôle, jamais une autre exécution.

GitLab.com : runner Linux shell **dédié, protégé**, tag argos-ci, Node 24.21.0 et
curl installés, répertoire neuf par job (`GIT_STRATEGY: empty`), sans cache projet.
Protéger la branche par défaut, les variables masquées/cachées et leur portée
d’environnement ; interdire leur accès aux MR. Ne pas lancer du code projet dans
ces jobs, y compris dans before_script/after_script/hooks ajoutés par include.
Le modèle n’accepte que push/web/schedule sur la branche protégée par défaut.
Le job de prévisualisation facultatif s’exécute après un échec site sans masquer
le code du contrôle. Sur un contrôle impossible, aucune écriture Git n’a lieu.
Les CI de déploiement peuvent ordonner ces jobs après leur déploiement approuvé ;
aucun déploiement n’est exécuté par les modèles.

Les modèles lancent `audit`, dont l’admission applique le preflight pour une
nouvelle intention. `doctor` reste disponible séparément pour diagnostiquer
l’installation ; il ne bloque ainsi pas une reprise historique après épuisement
du quota ou perte du droit de nouvelle admission. Sur GitLab, la reprise de
prévisualisation exige encore la trace contrôlée du producteur : configurer son
effacement au plus après 24 h, puis refuser la reprise si elle a disparu. Ne pas
prolonger cette rétention pour contourner une preuve manquante. La rétention des
logs du fournisseur doit être validée avant ouverture #467, séparément des artefacts.

Sources officielles : [sécurité des événements GitHub](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target),
[artefacts GitHub](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts),
[jobs GitLab](https://docs.gitlab.com/api/jobs/), [rétention GitLab](https://docs.gitlab.com/ci/jobs/job_artifacts/#keep-artifacts-from-most-recent-successful-jobs),
[configuration des projets](https://docs.gitlab.com/api/projects/).

## Validation et limites avant ouverture

```sh
node scripts/ci/build-client.mjs --check
node --test scripts/ci/portable-client*.test.mjs
```

Le bundle est reconstruit déterministement depuis les catalogues et validateurs
versionnés du serveur. Les tests exécutent le processus autonome hors dépôt,
un vrai serveur TLS local, les contextes GitHub/GitLab, la réponse POST perdue,
les preuves de transfert et les scénarios hostiles. Le routage local existe
uniquement dans un preload de test, jamais dans la distribution ou les modèles.
Ils ne prouvent pas une recette des services hébergés GitHub/GitLab, une
publication de ticket réelle ou la configuration de production. Ces recettes,
l’isolation réelle des runners, la confidentialité/rétention, le reaper et la
documentation en ligne doivent être acceptés dans #467 avant toute activation.
