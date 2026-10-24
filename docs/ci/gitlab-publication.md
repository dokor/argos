# Publication GitLab optionnelle — #740

Client `0.4.0-preview.1`, moteur commun #738, après le publisher GitHub #739.
**premium-ci.enabled=false reste maintenu jusqu’à la recette complète #467.**
Les analyses, leurs lectures et leurs quotas exigent toujours la clé API Argos.
Le credential GitLab reste exclusivement dans la CI du client.

## Périmètre et droits

Cette version supporte **GitLab.com**, API v4, avec les champs de sécurité et
de provenance vérifiés ci-dessous. Aucun endpoint Self-Managed/Dedicated n’est
supporté par le client livré ; changer CI_SERVER_URL n’autorise pas une origine
privée. Aucun accès privé n’est ajouté depuis Argos. Une future variante doit
fixer son origine, vérifier TLS et sa version, puis repasser les tests.

| Usage | Credential et rôle |
| --- | --- |
| Provenance et scellement | ARGOS_GITLAB_READ_TOKEN, scope read_api uniquement, accès réel au projet/traces vérifié |
| Publication | ARGOS_GITLAB_PUBLISH_TOKEN, scope api uniquement, rôle Planner 15 ou Reporter 20 ; identité numérique déclarée et vérifiée |
| Secret Argos | ARGOS_API_KEY uniquement dans argos-ci, jamais dans argos-publisher |
| Registre privé | SAS lecture seule dans argos-ci, SAS rw dans argos-publisher, limités au même blob Azure privé |

Les rôles retenus lisent les issues confidentielles ; Guest ne suffit pas pour
prouver l’inventaire complet. Planner est le rôle le plus restreint accepté ;
l’accès réel aux traces doit être testé selon la politique CI du projet.
Reporter peut être choisi explicitement si cette politique l’exige. Developer,
Maintainer, Owner, compte administrateur ou scopes supplémentaires sont refusés
par cette recette : aucun élargissement silencieux. Une lecture réussie ne
prouve pas le droit du POST, qui peut encore être refusé par une politique.
`api` n’est **pas** un scope « issues uniquement » : il autorise les opérations
API permises par le rôle. Ne pas ajouter sudo, write_repository ou un rôle admin.

Préférer un token de projet avec expiration et `ARGOS_GITLAB_CREDENTIAL_KIND=project-token`
(défaut). Son utilisateur bot doit correspondre au projet et à destination.botId.
Sur GitLab.com, la création de ces tokens demande une offre GitLab Premium ou
Ultimate, distincte de Premium Argos. Sur Self-Managed/Dedicated leur disponibilité
commerciale diffère, mais ces instances restent hors périmètre de ce client.

Si le token de projet n’est pas disponible, le client peut choisir explicitement
`ARGOS_GITLAB_CREDENTIAL_KIND=dedicated-user` : compte non administrateur réservé
à cette automatisation, PAT api expirant, membre de ce seul projet et sans autre
usage. L’API vérifie l’ID courant, le rôle et la liste des projets membres avant
écriture. Ce choix comporte les risques d’un PAT attaché à un utilisateur :
ne pas utiliser un compte personnel ou l’ajouter ensuite à d’autres projets.
Ce n’est jamais un repli automatique. CI_JOB_TOKEN n’est pas utilisé pour créer
des issues ; sa présence ne remplace pas le credential dédié.

Les deux credentials sont introspectés via GET /user et
GET /personal_access_tokens/self : état actif, non révoqué, utilisateur et scope
exact, expiration UTC future. Le client ne crée, ne renouvelle ni ne révoque de
token à la place de l’utilisateur. Utiliser l’interface GitLab pour la rotation,
mettre à jour la variable protégée puis reprendre le publisher. Une rotation
qui conserve l’identité du bot conserve les associations d’issues ; créer un
nouveau bot n’autorise pas à adopter l’ancien historique sans migration contrôlée.

## Configuration du modèle

Utiliser [gitlab-publication.yml](../../clients/ci/templates/gitlab-publication.yml)
**à la place** du modèle [gitlab-ci.yml](../../clients/ci/templates/gitlab-ci.yml),
qui reste un modèle de contrôle/aperçu privé. Ne pas inclure les deux : cela
créerait deux jobs de contrôle concurrents. Le nouveau modèle continue les
analyses quand la publication est désactivée.

1. Configurer un runner shell Linux dédié/protégé, tag argos-ci, Node 24.21.0 et
   curl ; répertoire neuf GIT_STRATEGY=empty, aucun cache/code projet ni hook
   ajouté. Protéger la branche par défaut et les deux environnements.
2. Définir ARGOS_TARGET_URL et la configuration JSON revue depuis
   [publication.gitlab.json](../../clients/ci/examples/publication.gitlab.json)
   en variable protégée ARGOS_PUBLICATION_CONFIG, identique dans les deux jobs.
   Remplacer ID numérique du projet, chemin et ID du bot. Garder mode DISABLED,
   consentements false et reopenResolved=false au départ.
3. En variables protégées, masquées/cachées, sans expansion : ARGOS_API_KEY et
   ARGOS_GITLAB_JOURNAL_READ_SAS_URL limités à l’environnement argos-ci ;
   ARGOS_GITLAB_PUBLISH_TOKEN et ARGOS_GITLAB_JOURNAL_SAS_URL limités à
   argos-publisher. ARGOS_GITLAB_READ_TOKEN est fourni séparément aux deux
   environnements. Aucune clé Argos ou écriture Git dans le publisher/source
   respectivement. Le client refuse un token de publication dans la commande
   audit, doctor, resume ou export.
4. Préparer un registre privé Azure **distinct de celui d’un autre fournisseur**,
   avec les mêmes garanties de [stockage que GitHub](github-publication.md#pourquoi-un-registre-privé-supplémentaire).
   Son destinationId et repository correspondent au projet GitLab. Un seul
   blob est partagé par tous ses workflows/runners/environnements. SAS r au
   scellement, rw au publisher ; aucune permission de liste/suppression.
5. Désactiver keep_latest_artifact dans GitLab, fixer les droits d’accès CI aux
   membres du projet et organiser l’effacement des traces/diagnostics sous 24 h.
   Le credential publisher n’est pas élargi pour obtenir le droit d’effacer des
   traces. Cette rétention effective est à prouver avant #467.
6. Quand la configuration est revue, choisir PREVIEW pour une simulation complète
   avec credentials de lecture/SAS r, ou SYNC avec le consentement de visibilité,
   puis ARGOS_GITLAB_PUBLISH=true. Le mode DISABLED ne contacte aucun fournisseur.
   L’accès serveur Argos reste fermé indépendamment de ces réglages avant #467.

Le modèle refuse MR, pipeline de fork/MR consommée comme preuve, branches non
protégées, autres origines et changement de destination. Ne pas accorder les
variables protégées aux MR/forks. Ne pas activer CI_DEBUG_TRACE, de dump env,
de tracing shell ou de journalisation HTTP brute. Le runner télécharge uniquement
la distribution à commit complet et SHA-256 indépendant vérifié.

## Preuve, confidentialité et décisions humaines

Le contrôle exécute audit ou resume, puis publication-stage en processus sans
clé Argos. Il lit la clé AES du registre privé via SAS r et chiffre la preuve
avec AES-256-GCM, contexte authentifié de provenance/digest/politique. **Le seul
fichier déclaré en artifacts.paths est evidence.enc.json**, y compris après
échec ou annulation forcée. Ni preuve brute, ni clé, ni rapport détaillé n’est
téléversé. Accès maintainer, expire_in sept jours, keep_latest_artifact=false.
Le registre conserve les associations/budgets et la clé AES, jamais les preuves.

Le publisher isolé récupère l’artefact du job argos_control via les dépendances
du runner GitLab. Le token read_api relit toutes les pages des jobs de la pipeline
courante, hors jobs remplacés ; il vérifie producteur unique, ID numérique,
projet, SHA, ref, fin effective et absence d’effacement. Le GET du job précis est
revérifié, puis les digests original/chiffré sont lus dans les deux lignes JSON
contrôlées audit/resume et publication-stage de sa trace, **hors artefact**.
Trace absente, ambiguë ou effacée = refus ; le hash du fichier ne remplace pas
la preuve fournisseur. Une relance du publisher avec un nouvel ID de job reste
liée au producteur original de cette pipeline. Un contrôle remplacé change
l’identité/digest attendus et invalide l’ancien fichier.

Après déchiffrement, schéma v2, client, politique, contexte, digests, verdict et
expiration sont vérifiés. La preuve a au plus quinze minutes depuis la relecture,
sans dépasser l’expiration des deux sources. Cette fenêtre ne révoque pas
instantanément une copie après suppression serveur ; elle doit être acceptée
dans #467. La copie déchiffrée du publisher est supprimée après usage.

Le registre utilise lease Azure renouvelable et PUT conditionné au lease complet
et à l’ETag. Le resource_group commun au projet réduit les collisions ; le
registre reste l’exclusion partagée faisant autorité. Préparation et budget
persistent avant POST. Une réponse perdue se réconcilie par nonce, auteur et
destination ; si l’issue reste invisible, aucun autre POST n’est tenté. Blob
absent, public, corrompu, saturé ou ancien lease = arrêt, jamais réinitialisation.

Dans un projet privé, seuls les champs de catalogue prévus par #738 sont publiés,
avec confidential=true. Un constat enregistré devenu non confidentiel bloque
l’automatisation. Dans un projet public, un seul ticket non confidentiel porte
le texte strictement générique, sans détail de constat ou identifiant privé.
Une ambiguïté publique peut être liée par publicIssueId explicitement configuré,
après vérification du propriétaire bot, du projet et du corps exact.

Aucun texte, titre, commentaire, label ou assignation existant n’est modifié.
Tout état fermé, label argos:ignore/false-positive/accepted-risk ou marqueur
modifié suspend l’automatisation. reopenResolved=true est refusé : aucun GET/PUT
n’est présenté comme une condition atomique sur la décision humaine. Aucun
ticket n’est fermé automatiquement. Les notifications de nouvelle création sont
limitées par les budgets du moteur commun ; aucun commentaire répétitif.

## Reprises et erreurs

- Désactiver : ARGOS_GITLAB_PUBLISH=false, mode DISABLED. Les audits continuent ;
  aucun nouveau fichier de publication n’est produit. Conserver le registre.
- Dans la fenêtre de fraîcheur, relancer **argos_publish uniquement**. Zéro
  admission/audit supplémentaire ; le budget reste lié à la pipeline originale.
- Après expiration/effacement de trace, lancer une nouvelle pipeline manuelle
  avec ARGOS_CI_OPERATION=resume et ARGOS_ORIGINAL_INTENT égal à l’UUID initial.
  Le contrôle relit l’admission et les deux rapports sous sa clé, sans POST
  d’admission ni crédit ; ses dates d’observation ne sont pas réécrites.
- Une erreur de publication donne 3, distinct du verdict 0/1 du contrôle.
  CONTROL_FAILED reste 2 sans preuve publiable ni issue. Un défaut confirmé
  SITE_NO_GO peut publier même si le job de contrôle est rouge.

| Code | Action autonome |
| --- | --- |
| PUBLICATION_AUTH_FAILED | Vérifier présence locale, portée d’environnement, scope exact, rôle, ID de bot, expiration/révocation ; jamais afficher la variable ni exposer aux MR |
| DESTINATION_UNAVAILABLE | Vérifier projet courant, visibilité, issues activées, archivage, rétention et accès au projet ; absent/inaccessible restent indiscernables |
| PUBLICATION_RATE_LIMITED | Attendre Retry-After puis reprendre le publisher ; aucun nouveau contrôle |
| ARTIFACT_INVALID | Vérifier producteur, digests, pipeline/SHA/ref, trace, configuration et fraîcheur ; refresh par resume |
| CONFIG_INVALID | Vérifier origine GitLab.com, IDs, mode/consentements, réouverture off et SAS blob-scoped r/rw |
| PUBLICATION_STATE_UNKNOWN | Garder le registre/préparation, attendre la fin du lease et réconcilier ; ne pas créer un nouveau journal ou POST |

Les messages sont reconstruits depuis le catalogue #741 : aucun corps HTTP,
exception, texte de ticket, credential, URL SAS, ANSI ou commande workflow
repris dans les logs/outputs. L’aperçu reste sans mutation Git ni registre.

## Preuves avant ouverture

Les tests exercent GitLab.com v4 simulé et un client autonome sur TLS vérifié :
scellement en lecture, provenance API/trace paginée, transfert chiffré, scopes,
identités, rôles, expirations, public/privé/confidentiel, reprises et erreurs.
Le stockage partagé est aussi éprouvé avec Azurite dans la CI. Ces preuves ne
sont **pas** une recette sur offre GitLab réelle ou un abonnement client Azure.
#467 doit valider le rôle minimal effectivement suffisant, les deux types de
credential retenus, la création réelle sur projets de test autorisés,
concurrence/annulation tardive, permissions de traces, sauvegarde et rétention.
Aucun projet GitLab réel, ticket hébergé ou credential client n’est utilisé par
ces fixtures. Aucun paiement ni activation commerciale n’est effectué.

Sources primaires : [tokens de projet et offres](https://docs.gitlab.com/user/project/settings/project_access_tokens/),
[rôles](https://docs.gitlab.com/user/permissions/), [issues](https://docs.gitlab.com/api/issues/),
[introspection](https://docs.gitlab.com/api/personal_access_tokens/), [jobs](https://docs.gitlab.com/api/jobs/),
[accès et rétention des artefacts](https://docs.gitlab.com/ci/yaml/#artifactsaccess).
