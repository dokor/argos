# Préparer les environnements et secrets de recette Premium CI

Ce guide prépare la recette #467 avec Stripe sandbox, un domaine contrôlé, GitHub.com,
GitLab.com et un journal Azure privé. Il indique quoi créer, où ranger les secrets et
quels droits accorder. **La préparation ne lance ni paiement, ni audit, ni publisher.**
La [recette complète](acceptance.md) reste NO_GO tant que les essais réels ne sont pas validés.

## 1 Conserver les verrous et choisir le futur environnement Argos

Dans la configuration effective, conserver ces valeurs, y compris dans les fichiers
montés et surcharges de l'hébergement :

```hocon
premium-ci.enabled = false
billing.enabled = false
audit.queue.premium-priority-enabled = false
billing.payments-enabled = false
billing.prices-approved = false
billing.launch-approved = false
billing.tax-ready = false
billing.live-mode = false
```

Ne pas recopier le fichier de production pour remplir une préproduction. Prévoir une
instance Argos isolée : origine HTTPS, base et sauvegardes distinctes, secrets propres,
compte système et réseaux de collecteurs isolés. Aucune connexion à la base, SMTP,
stockage ou session de production. Faire revoir sa topologie avant son déploiement.

**Point bloquant du client actuel :** l'origine API est fixée à
`https://argos.lelouet.fr` dans [transport.mjs](../../clients/ci/src/transport.mjs).
`ARGOS_ENVIRONMENT=staging` est seulement une étiquette de preuve ; cela ne change
pas le serveur. Il n'existe pas de variable `ARGOS_API_BASE` de remplacement.
Ne pas contourner ce verrou par DNS local, proxy détourné, loader, `NODE_OPTIONS`
ou TLS désactivé. Avant les essais hébergés, faire valider dans une PR une distribution
de recette à origine HTTPS fixe autorisée, avec ses pins et tests, et une stratégie
d'activation limitée à cette instance. Cette préparation n'autorise aucune activation,
y compris en sandbox ; les six verrous ci-dessus restent faux.

Les clés Argos et la vérification du domaine nécessitent actuellement le droit CI
et le flag ouvert. Le Checkout exige aussi les validations prix/lancement/fiscalité.
**Réserver leurs emplacements maintenant ; ne pas fabriquer de clé ou de droits par SQL.**
Sans décision séparée pour l'environnement de recette, ces étapes restent en attente.

## 2 Créer un inventaire sans secrets et deux comptes de test

Dans le dossier de recette privé, noter les références suivantes, jamais leurs valeurs
secrètes. Nommer un responsable de préparation et un responsable de validation.

| Ressource | Référence à conserver |
| --- | --- |
| Argos isolé | Origine prévue, SHA, référence de configuration et base séparée |
| Comptes A et B | Identifiants de recette et boîtes mail contrôlées, sans mot de passe |
| Stripe | Sandbox, compte marchand, produit, prix et portail lorsqu'ils seront prêts |
| Domaine | Origine HTTPS exacte, hébergeur et opérateur habilité à publier un fichier |
| GitHub | URL et ID numérique du dépôt, branche par défaut, environnements |
| GitLab | URL, ID numérique et chemin exact du projet, ID du bot de publication |
| Azure | Compte, conteneur, chemins des deux blobs ; aucune URL contenant un SAS |
| Chaque secret | Nom dans le coffre/CI, propriétaire, date d'expiration et rotation prévue |

Prévoir deux comptes Argos ordinaires, avec adresses contrôlées et distinctes, pour
les essais intercomptes. A doit devenir Premium par le parcours sandbox réel lors
de l'exécution autorisée ; B reste FREE pour les premiers refus, puis suit le même
parcours sandbox pour tester un autre propriétaire Premium. Pas de compte administrateur
dans les jobs. Pour les inscriptions/réauthentifications, prévoir le SMTP de test
et les secrets de [configuration comptes](../accounts/application.example.conf) :
`ACCOUNT_JWT_SECRET` aléatoire et distinct, au moins 64 octets, et identifiants SMTP limités à
l'envoi depuis l'identité de test. Les OAuth Google/GitHub/LinkedIn ne sont pas
nécessaires au parcours email de cette recette. La base et ses credentials restent
sur le serveur, jamais dans les variables des dépôts clients.

## 3 Préparer Stripe sandbox et la clé serveur restreinte

1. Dans le sélecteur de compte Stripe, créer une **sandbox dédiée à la recette**.
   Vérifier son nom avant chaque création ; ne pas copier une clé live. Inviter les
   opérateurs seulement à cette sandbox. Ses opérations de paiement simulées ne
   passent pas par les réseaux de paiement réels. [Sandboxes Stripe](https://docs.stripe.com/sandboxes).
2. Dans la sandbox, ouvrir **API keys**, puis **Create restricted key**. Nommer la
   clé `argos-recette-backend`, partir de toutes les permissions à **None** et
   appliquer la matrice suivante. Utiliser une clé `rk_test_`, jamais une clé
   générale comme solution automatique à un refus. La clé reste exclusivement
   côté backend ; Checkout hébergé ne nécessite pas de clé publiable dans Next.

| Ressource utilisée par le code | Permission de la clé backend |
| --- | --- |
| Compte marchand (`GET /v1/account`) | Lecture |
| Clients, dont recherche et création | Écriture, qui inclut la lecture |
| Prix | Lecture |
| Abonnements | Lecture |
| Factures et paiements de facture (`invoice_payments`) | Lecture |
| PaymentIntents et charges | Lecture |
| Sessions Checkout | Écriture, qui inclut la lecture |
| Configurations du portail Billing | Lecture |
| Sessions du portail Billing | Écriture |
| Autres ressources, remboursements, modification des abonnements, payouts, webhooks | Aucune permission d'écriture pour le backend |

Cette matrice provient des appels de `BillingService` et `StripeBillingReader`.
Les libellés/regroupements du Dashboard peuvent différer : vérifier chaque opération
avec la clé restreinte lors de la recette autorisée ; un manque de permission est un
blocage à documenter, jamais un motif pour donner tous les droits. Création des prix,
paramétrage Tax et simulation de remboursement/litige relèvent de l'opérateur sandbox.
Les permissions Write impliquent Read. [Clés restreintes Stripe](https://docs.stripe.com/keys/restricted-api-keys).

3. Ranger la clé dans le coffre serveur sous la référence destinée à `billing.api-key`.
   N'injecter aucun secret dans `NEXT_PUBLIC_*`, les workflows clients ou le navigateur.
4. Préparer un produit de test et une configuration du portail : consultation des
   factures, moyen de paiement et annulation en fin de période ; changement de prix,
   quantité ou offre désactivé. Les montants approuvés à reproduire dans la sandbox
   sont 19 EUR HT/mois et 199 EUR HT/an (1900 et 19900 centimes). EUR, taxe exclusive,
   quantité 1, mois/an, deux IDs distincts ; annuel inférieur à douze mensualités.
5. Après choix de l'origine isolée, préparer la destination webhook à
   `<origine-Argos-isolée>/api/billing/stripe/webhook`, événements snapshot v1,
   version **2026-09-30.endive**, même sandbox. Garder la destination désactivée
   pendant la préparation ; ne pas envoyer de tests à la production. Reprendre la
   [liste exacte d'événements](billing.md#webhook-et-réconciliation). Conserver le
   secret de signature propre à cette destination dans `billing.webhook-secret`.
   Un secret de listener CLI n'est pas celui du webhook hébergé. Le proxy devra
   préserver corps brut et `Stripe-Signature`. [Versions Stripe](https://docs.stripe.com/upgrades).

| Configuration backend à réserver | Nature et rangement |
| --- | --- |
| `billing.account-id`, `product-id` | IDs non secrets de cette sandbox |
| `billing.monthly-price-id`, `annual-price-id` | IDs des prix de test lorsqu'ils seront arrêtés |
| `billing.monthly-amount-ht-cents`, `annual-amount-ht-cents` | 1900 et 19900, concordant avec les deux prix EUR HT créés dans la sandbox Stripe |
| `billing.portal-config-id` | Configuration portail de la sandbox |
| `billing.api-key` | Secret serveur dans le coffre, clé restreinte test |
| `billing.webhook-secret` | Autre secret serveur, lié au webhook exact |

Ne pas injecter de valeurs provisoires dans la configuration de production.
Avec Billing fermé, ni réception réussie du webhook ni ouverture Checkout ne sont
attendues. La validation des factures HT/TTC, de Tax et du cycle de vie attend l'exécution
sandbox autorisée ; aucun taux de TVA ou choix commercial n'est supposé ici.

## 4 Réserver un domaine HTTPS public contrôlé

1. Préparer une origine dédiée, par exemple `https://audit-recette.example.com`
   (nom fictif à remplacer), sur un hébergement sans données ni credentials de production.
2. Vérifier certificat public valide, DNS exclusivement public, HTTPS port 443 et absence
   d'authentification HTTP, de redirection de l'origine ou de challenge anti-bot. Conserver
   une page stable pour les comparaisons ; prévoir une variante avec défaut connu.
3. Réserver la possibilité de servir `/.well-known/argos-ci/<id-cible>.txt` sans
   redirection. Après autorisation d'exécution seulement, le compte A créera sa cible,
   publiera le challenge exact et lancera la vérification dans Argos. Le MVP utilise
   un **fichier HTTPS**, pas une preuve DNS TXT. Chaque origine/sous-domaine est distinct.
4. Garder le fichier pour les revérifications ; aucune clé API, aucun token de rapport
   ne doit y figurer. L'opérateur de l'hébergement n'a besoin que de publier ce fichier
   et la page de test, pas d'une clé Argos ou de droits sur les dépôts CI.

Voir [preuve et durée d'autorisation](targets.md). Le fichier de challenge est public
par conception ; le secret machine Argos ne l'est jamais.

## 5 Préparer GitHub avec les permissions de chaque job

1. Créer un dépôt **privé dédié et vide de données client** sur GitHub.com, activer
   Issues et Actions, noter ID numérique et branche par défaut. Pour la matrice publique,
   prévoir ensuite un second dépôt dédié ; ne pas rendre public le dépôt déjà utilisé
   pour des constats détaillés.
2. Protéger explicitement la branche par défaut et faire revoir les modifications de
   workflows. Dans **Settings → Environments**, créer `argos-ci` et `argos-publisher`,
   autorisés uniquement depuis cette branche exacte. Éviter « Protected branches only »
   sans vérifier qu'une protection existe réellement. Ajouter une approbation humaine
   si l'offre la permet ; sinon ne pas fournir de secrets tant que la protection de
   remplacement n'est pas revue. Les secrets d'environnement privé demandent une offre
   compatible ; les required reviewers privés ne sont pas inclus dans toutes les offres.
   [Protections GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).
3. Préparer une copie revue de [github-actions.yml](../../clients/ci/templates/github-actions.yml),
   **hors `.github/workflows` pour l'instant**, ou laisser le workflow désactivé. Il se
   déclenche aussi sur push : ne pas l'installer actif pendant cette préparation.
   Garder les pins complets et checksums ; aucun checkout ni script du dépôt audité
   dans les jobs porteurs de secrets. La future distribution de recette doit avoir
   sa propre origine fixe revue comme indiqué à l'étape 1.
4. Préparer les variables de dépôt : `ARGOS_TARGET_URL` avec la cible, puis
   `ARGOS_GITHUB_PUBLISH=false`, `ARGOS_PUBLICATION_PREVIEW=false`,
   `ARGOS_PRIVATE_ARTIFACTS=false`. Adapter `ARGOS_PUBLICATION_CONFIG` depuis
   [l'exemple](../../clients/ci/examples/publication.github.json) : vrai ID/nom/visibilité,
   bot `github-actions[bot]`, **ID `41898282`** (remplacer le `101` fictif de l'exemple).
   Garder `mode=DISABLED`, les deux consentements false et `reopenResolved=false`.
   La configuration est commune aux jobs ; aucun secret dans ce JSON.

| Job GitHub livré | Permissions minimales du `GITHUB_TOKEN` |
| --- | --- |
| `argos_control` et scellement | `contents: read` |
| `argos_preview`, facultatif et en lecture | `contents: read`, `actions: read` |
| `argos_publish`, facultatif et isolé | `actions: read`, `issues: write` ; les permissions non déclarées sont à none |

Ces permissions s'appliquent aux jobs respectifs ; ne pas donner `issues: write`
au niveau global. Le `GITHUB_TOKEN` est fourni par GitHub pendant le job : **aucun PAT
GitHub à créer ou stocker**, ni `contents: write`, `id-token: write` ou droit administrateur.
La portée reste le dépôt courant. [Permissions des workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions).
L'opérateur qui configure le dépôt utilise ses droits d'administration seulement pour
les réglages ; ces droits ne sont pas transférés aux jobs.

## 6 Préparer GitLab.com et séparer lecture et publication

1. Créer un projet privé de recette GitLab.com, avec issues et CI, sans fork ; noter
   ID numérique, chemin et branche par défaut. Protéger cette branche. Restreindre
   la visibilité CI aux membres, désactiver **Keep artifacts from most recent successful jobs**
   (`keep_latest_artifact=false`), prévoir l'effacement des traces sous 24 h.
2. Préparer un runner **shell Linux dédié et protégé**, tag `argos-ci`, Node **24.21.0**,
   curl et espace de travail neuf. Aucun accès à la production, groupe Docker, sudo,
   cache, hooks ou scripts ajoutés du projet ; préférer une machine jetable. Le shell
   runner n'est pas une frontière d'isolation à lui seul.
3. Préparer les environnements exacts `argos-ci` et `argos-publisher`. Utiliser les
   protections disponibles dans l'offre du projet. Dans **Settings → CI/CD → Variables**,
   créer les secrets comme variables de type **Variable**, protégées, **Masked and hidden**,
   expansion désactivée, avec la portée d'environnement exacte ci-dessous, jamais `*`.
   Les variables cachées se créent avec ce statut dès l'origine.
   [Variables GitLab](https://docs.gitlab.com/ci/variables/).
4. Choisir **un** modèle : [gitlab-publication.yml](../../clients/ci/templates/gitlab-publication.yml)
   pour préparer la publication, **à la place de** `gitlab-ci.yml`. Garder sa copie hors
   `.gitlab-ci.yml`, ou le CI/CD désactivé, jusqu'à l'exécution autorisée. Ne pas inclure
   les deux : cela créerait deux contrôles. `ARGOS_GITLAB_PUBLISH=false` ne désactive
   pas le job d'audit ; il ne suffit donc pas à rendre une pipeline inerte.
5. Créer deux credentials expirants et séparés :

| Credential GitLab | Scope exact | Rôle et usage |
| --- | --- | --- |
| `ARGOS_GITLAB_READ_TOKEN` | `read_api` seul | Lecture de provenance, jobs, traces et issues ; commencer par Planner 15, retenir Reporter 20 seulement si l'accès aux traces l'exige et le documenter |
| `ARGOS_GITLAB_PUBLISH_TOKEN` | `api` seul | Bot du projet, Planner 15 ; Reporter 20 est aussi accepté, Guest ne couvre pas les issues confidentielles |

Préférer deux **project access tokens** et `ARGOS_GITLAB_CREDENTIAL_KIND=project-token`.
Leurs bots peuvent avoir des IDs différents : `destination.botId` désigne celui du
token de **publication**. La création des tokens demande à l'opérateur un rôle
Maintainer/Owner ; cela ne justifie pas ce rôle sur les tokens eux-mêmes. Sur GitLab.com,
ces tokens demandent GitLab Premium/Ultimate, distinct de Premium Argos ; vérifier
la disponibilité de deux tokens, notamment en période d'essai.
[Project access tokens](https://docs.gitlab.com/user/project/settings/project_access_tokens/).

Si indisponibles, le choix explicite `dedicated-user` utilise un compte non administrateur
réservé à ce **seul** projet, avec deux PAT de scopes séparés. Pas de compte personnel,
de token de groupe, de `CI_JOB_TOKEN` pour créer les issues, ni de repli automatique.
`api` autorise les opérations API du rôle, **pas seulement les issues**. Aucun scope
supplémentaire, rôle Developer/Maintainer/Owner ou droit d'effacement des traces n'est
ajouté au publisher. [Permissions GitLab](https://docs.gitlab.com/user/permissions/).

6. Préparer `ARGOS_TARGET_URL`, `ARGOS_PUBLICATION_CONFIG` identique dans les deux
   environnements à partir de [l'exemple GitLab](../../clients/ci/examples/publication.gitlab.json),
   avec le vrai projet et bot. Garder `mode=DISABLED`, consentements false,
   `reopenResolved=false`, `ARGOS_GITLAB_PUBLISH=false`. Garder `ARGOS_ENVIRONMENT`
   cohérent avec la liste `environments` du JSON ; il ne choisit pas un serveur.

Les modèles refusent MR, forks et branches non protégées. Ne pas autoriser l'accès
aux variables protégées depuis les MR. Ne pas activer `CI_DEBUG_TRACE`, `set -x`,
dump d'environnement ou logs HTTP ; le masquage seul ne protège pas d'un job malveillant.

## 7 Créer les deux journaux Azure privés

Le stockage n'est requis que pour les essais de publication. Préparer **un blob GitHub
et un blob GitLab**, distincts, chacun partagé par tous les runners/workflows de sa
destination. Aucun blob supplémentaire par clé, run ou environnement.

1. Créer un compte de stockage de recette et un conteneur privé dédiés. Désactiver
   l'accès anonyme, exiger HTTPS/TLS, permettre aux runners d'atteindre l'endpoint
   officiel `<compte>.blob.core.windows.net`. Accès réseau public et accès anonyme sont
   deux réglages différents : aucune lecture anonyme du blob ne doit réussir.
2. Activer versioning, soft delete du blob/conteneur et sauvegarde privée avec
   rétention du registre définie par l'opérateur. Choisir un compte compatible avec
   le versioning, sans espace de noms hiérarchique. Le registre contient une clé AES :
   versions et sauvegardes sont aussi secrètes que le blob courant. Le délai de
   sept jours des artefacts CI ne s'applique pas au registre de déduplication.
   [Versioning Azure](https://learn.microsoft.com/en-us/azure/storage/blobs/versioning-overview).
3. Précréer chaque **block blob**, par exemple `github/<id-depot>.json` et
   `gitlab/<id-projet>.json`. Dans un répertoire local privé hors dépôt/cloud-sync,
   préparer `destination.json` avec la configuration revue, puis suivre la commande
   d'[initialisation unique du journal](github-publication.md#pourquoi-un-registre-privé-supplémentaire)
   pour produire `journal.json` avec 32 octets AES aléatoires. ACL privée sous Windows,
   mode 0600 sous Unix. Charger sans écraser un blob existant ; ne jamais réinitialiser
   le journal pour débloquer une publication.
4. Pour l'opérateur de préparation, utiliser temporairement les rôles intégrés
   `Storage Blob Data Contributor` au **conteneur de recette**, et `Storage Blob Delegator`
   au **compte de stockage de recette** pour signer la délégation. Le premier permet
   aussi la suppression : ce sont des droits de bootstrap humain, plus larges que
   les SAS des jobs ; ne pas les donner au runner. Une politique exigeant moins
   encore peut employer un rôle personnalisé examiné par l'administrateur Azure.
   **Aucun rôle Azure, login Entra,
   clé de compte de stockage ou credential administrateur n'entre dans la CI.**
   [Rôles Azure Storage](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/storage#storage-blob-delegator).
5. Générer deux SAS de délégation utilisateur **pour chaque blob** : lecture `sp=r`
   et lecture/écriture `sp=rw`, ressource `sr=b`, transport `spr=https`. Pas de création
   explicite `c`, liste `l`, suppression `d`, SAS de compte ou de conteneur. `w` permet
   déjà l'écriture et le lease ; il ne peut pas être restreint au seul CAS par le SAS.
   [Permissions SAS Blob](https://learn.microsoft.com/en-us/rest/api/storageservices/create-user-delegation-sas).

Pour une session de recette, choisir par exemple une échéance de **24 h**, renouvelable
sur le même blob. La délégation utilisateur est limitée à sept jours ; l'adaptateur
Argos exige encore plus de deux minutes de validité et refuse les paramètres ajoutés
non prévus. Ne pas copier une SAS longue par défaut ou une URL avec overrides HTTP.
[Création SAS de délégation](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-user-delegation-sas-create-cli).

Exemple **à exécuter par l'opérateur après création des ressources**, dans un terminal
Bash privé avec Azure CLI connecté par Entra. Remplacer les variables non secrètes,
répéter pour le blob GitHub puis GitLab. Ne pas exécuter dans un job CI ou en mode debug :

```sh
umask 077
# SECRET_DIR : répertoire privé existant ; EXPIRY_UTC : échéance ISO UTC à moins de 7 jours.
# STORAGE, CONTAINER et BLOB : noms exacts déjà créés, aucun SAS dans ces variables.
az storage blob generate-sas --account-name "$STORAGE" \
  --container-name "$CONTAINER" --name "$BLOB" --permissions r \
  --expiry "$EXPIRY_UTC" --https-only --auth-mode login --as-user \
  --full-uri --output tsv > "$SECRET_DIR/journal-read.url"
az storage blob generate-sas --account-name "$STORAGE" \
  --container-name "$CONTAINER" --name "$BLOB" --permissions rw \
  --expiry "$EXPIRY_UTC" --https-only --auth-mode login --as-user \
  --full-uri --output tsv > "$SECRET_DIR/journal-write.url"
```

Importer le contenu de ces fichiers directement dans les secrets d'environnement
ci-dessous, sans l'afficher ni le coller dans une issue. Les deux URL visent exactement
le même blob, sans paramètre `comp`, `si` ou override de réponse. Ne pas ajouter d'endpoint
Azurite/custom au client livré. Conserver un accès opérateur contrôlé pour la rotation,
la sauvegarde et la restauration ; aucune suppression du registre avant réconciliation.

## 8 Ranger les secrets dans leur portée exacte

Créer les **emplacements** dès maintenant. Si une valeur n'existe pas encore, la laisser
absente et noter « en attente » dans l'inventaire ; pas de faux secret qui ressemble à
une clé opérationnelle. Remplir seulement après revue des ressources et protections.

| Plateforme et emplacement | Secret | Présence nécessaire |
| --- | --- | --- |
| Coffre backend Argos isolé | `billing.api-key`, `billing.webhook-secret` | Serveur uniquement, aucune copie dans GitHub/GitLab |
| Coffre backend isolé | JWT comptes, SMTP, credentials base | Valeurs distinctes de production, selon la configuration serveur |
| GitHub environnement `argos-ci` | `ARGOS_API_KEY` | Future clé du compte A, 3 scopes `audits:write`, `results:read`, `usage:read`, cible exacte |
| GitHub environnement `argos-ci` | `ARGOS_GITHUB_JOURNAL_READ_SAS_URL` | URL complète du SAS `r` du blob GitHub |
| GitHub environnement `argos-publisher` | `ARGOS_GITHUB_JOURNAL_SAS_URL` | URL complète du SAS `rw` du même blob GitHub |
| GitLab environnement `argos-ci` | `ARGOS_API_KEY` | Une autre intégration Argos dédiée à GitLab, mêmes 3 scopes et cible |
| GitLab environnement `argos-ci` | `ARGOS_GITLAB_READ_TOKEN`, `ARGOS_GITLAB_JOURNAL_READ_SAS_URL` | Lecture API et SAS `r` du blob GitLab |
| GitLab environnement `argos-publisher` | `ARGOS_GITLAB_READ_TOKEN` | Lecture API pour provenance/trace, même token de lecture ou copie de sa référence |
| GitLab environnement `argos-publisher` | `ARGOS_GITLAB_PUBLISH_TOKEN`, `ARGOS_GITLAB_JOURNAL_SAS_URL` | API du bot de publication et SAS `rw` du même blob GitLab |

Le publisher ne reçoit jamais `ARGOS_API_KEY`. Le contrôle ne reçoit jamais le token
GitLab de publication ni le SAS `rw`. Les clés Argos sont affichées une seule fois ;
pendant l'exécution autorisée, préférer une durée courte de recette et une clé par
fournisseur, dans les trois clés incluses, sans étendre l'expiration maximale d'un an.
Le modèle limite leur injection à la commande de contrôle ; les credentials Git ne
sont jamais transmis au backend Argos ou au site audité.

## 9 Vérifier la préparation puis s'arrêter

À la fin de cette préparation, vérifier et consigner :

- Les six flags sont toujours faux ; aucun prix live, paiement, audit ou issue n'a été créé.
- Les workflows/pipelines sont désactivés ou leurs copies restent hors chemins actifs.
- `mode=DISABLED`, les opt-ins de publication/aperçu/artefact sont faux ; aucun secret à portée globale.
- Les identifiants, rôles, scopes, environnements et expirations sont inventoriés sans valeur secrète.
- Les secrets de production sont absents ; aucun SAS, credential, clé AES ou `journal.json` dans Git/logs/artefacts.
- L'origine de recette fixe, les montants de sandbox, Tax et le futur protocole d'activation isolée
  restent explicitement à valider. La clé Argos et le webhook hébergé peuvent rester en attente.
- Les responsables ont prévu la purge des diagnostics sous 24 h, les artefacts privés sous
  7 jours, les rapports serveur sous 30 jours et la conservation séparée du journal.

`node argos-ci.mjs --help` et `--version` sont hors ligne et ne nécessitent aucun secret.
**Ne pas lancer `doctor` pendant cette préparation** : il appelle bien l'API Argos,
même s'il ne contacte pas la cible et ne réserve aucune analyse. Audit, resume,
scellement, aperçu connecté et SYNC attendent aussi l'exécution autorisée.

Ensuite seulement, suivre la [recette #467](acceptance.md), en commençant par le
précontrôle, opt-out et PREVIEW, puis les publications explicitement autorisées sur
les destinations de test. Une publication ou un Checkout de sandbox ne vaut pas GO
commercial. Ne pas lever les flags de production pour tester.

## 10 Prévoir rotation et réponse à une fuite

Renouveler les SAS avant expiration, toujours sur le même blob et sans changer la
clé AES du journal. Faire tourner séparément clé Stripe test, secret webhook, clés
Argos et tokens GitLab. Préserver l'identité du bot et le registre ; un nouveau bot
nécessite une migration examinée. Pour les reprises, conserver la même intention
et suivre les runbooks [GitHub](github-publication.md) / [GitLab](gitlab-publication.md).

Si une valeur a fui : désactiver immédiatement le workflow/pipeline et la publication,
révoquer le credential concerné chez son fournisseur, examiner les accès, retirer les
copies et renouveler le secret. Ne pas effacer le registre de déduplication. La
révocation des clés de délégation Azure invalide les SAS associés au compte et peut
avoir un délai : coordonner les deux destinations. Conserver dans le dossier seulement
code, requestId, SHA et référence de run expurgée, jamais un dump d'environnement.
