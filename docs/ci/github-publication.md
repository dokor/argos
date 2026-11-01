# Publication GitHub optionnelle avec GITHUB_TOKEN

Contrat #739, après le [moteur commun](issue-synchronization.md). Distribution
`0.3.0-preview.1`. **L’accès CI Argos reste fermé jusqu’à la recette #467.**
Ce lot ne change ni les quotas ni l’obligation de clé API pour les analyses.

## Configuration en autonomie

Copier le [modèle Actions](../../clients/ci/templates/github-actions.yml). Il
utilise uniquement le dépôt GitHub.com courant, sa branche par défaut, `push`
ou un déclenchement manuel. Aucun checkout ni code du projet audité ne tourne
dans ces jobs. Les forks, PR, dépôts archivés et issues désactivées sont refusés.
Une destination tierce et GitHub Enterprise ne sont pas pris en charge ; aucun
PAT administrateur ne sert de repli.

1. Configurer la clé machine `ARGOS_API_KEY` dans l’environnement protégé
   `argos-ci`, avec les cibles vérifiées et les droits décrits dans [keys.md](keys.md).
2. Adapter [publication.github.json](../../clients/ci/examples/publication.github.json)
   avec l’ID numérique et le nom exact du dépôt. Conserver le bot officiel
   `github-actions[bot]`, ID `41898282`. Mettre cette configuration JSON dans la
   **variable de dépôt** `ARGOS_PUBLICATION_CONFIG`, commune aux deux jobs.
3. Préparer le registre privé décrit ci-dessous. Mettre son SAS **lecture seule**
   dans `ARGOS_GITHUB_JOURNAL_READ_SAS_URL` de l’environnement `argos-ci`, et son
   SAS **lecture/écriture** dans `ARGOS_GITHUB_JOURNAL_SAS_URL` de l’environnement
   protégé `argos-publisher`. Aucun de ces secrets ne va dans Argos, une variable
   publique, un argument de commande, un artefact ou une sortie de job.
4. Autoriser les environnements uniquement depuis la branche par défaut et des
   acteurs de confiance. Définir `ARGOS_GITHUB_PUBLISH=true` uniquement après
   avoir revu la configuration. Le mode JSON reste `DISABLED` par défaut ;
   `SYNC` et le consentement adapté à la visibilité sont nécessaires pour créer.
   L’activation commerciale Argos reste indépendante et fermée avant #467.

Pour un dépôt privé : `allowPrivateDetails=true` autorise seulement la clé de
catalogue, l’environnement déclaré et les empreintes de périmètre prévues par
#738. Pour un dépôt public : `allowPublicNotice=true` permet **une seule notice
générique par destination**, sans constat, URL, empreinte, identifiant de rapport,
score ou secret dans l’issue. Aucun label n’est ajouté à cette notice publique.

## Pourquoi un registre privé supplémentaire

`GITHUB_TOKEN` seul ne fournit pas un registre privé et un compare-and-swap
documenté pour les issues. Une issue de suivi publique, un cache Actions ou un
fichier d’artefact n’apportent pas les garanties de #738. Cette première
implémentation utilise donc **un block blob Azure privé appartenant au client**.
Cela exige un compte de stockage client ; aucun compte Azure Argos ni accès
administrateur GitHub supplémentaire n’est nécessaire. Sans ce stockage, `SYNC`
est refusé explicitement avant toute création. Le choix est une contrainte de
cette version, à évaluer lors de #467, pas une propriété de GITHUB_TOKEN.

Créer un conteneur privé, désactiver l’accès anonyme du compte et précréer un blob
JSON unique pour l’ID du dépôt. Il doit être partagé par **tous** ses workflows,
environnements, clés et runners. Ne jamais en créer une copie pour contourner un
verrou ou une erreur. Pour le premier raccordement seulement, préparer hors logs
un fichier privé avec le format suivant et une clé AES aléatoire de 32 octets :

```js
// Dans un répertoire privé local ; destination.json est la configuration revue.
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
const { destination } = JSON.parse(fs.readFileSync('destination.json', 'utf8'));
fs.writeFileSync('journal.json', JSON.stringify({
  version: 1, destinationId: destination.id, repository: destination.repository,
  evidenceKey: randomBytes(32).toString('base64'),
  journal: { version: 1, revision: 'initial', destinationId: destination.id,
    records: [], budgets: [] }
}), { mode: 0o600, flag: 'wx' });
```

Envoyer ce fichier en block blob, `Content-Type: application/json`, via l’outil
Azure de confiance du client, **sans écraser un registre existant**. Le fichier
contient une clé de chiffrement : le supprimer de la machine de préparation
après vérification du stockage et de sa sauvegarde. Sous Windows, utiliser un
répertoire avec ACL privé. Ne jamais le committer.

Créer deux SAS limités **au même blob**, `sr=b`, `spr=https`, l’un `sp=r`, l’autre
`sp=rw`, sans permission de liste ou suppression. Préférer une SAS de délégation
utilisateur quand possible. L’expiration doit laisser plus de deux minutes et
rester inférieure à un an ; renouveler les SAS avant cette date, sur le même
blob. L’adaptateur accepte uniquement les hôtes publics Azure
`<compte>.blob.core.windows.net`. Aucun endpoint personnalisé ni émulateur n’est
accepté par le client livré.

Protéger le blob contre les effacements et changements d’accès : versioning,
soft delete et sauvegarde privée, avec une rétention adaptée au registre.
Les versions contiennent aussi sa clé AES. La perte du registre empêche la
reprise sûre ; sa suppression n’est **jamais** interprétée comme un registre vide.
Une restauration ancienne peut omettre une préparation ambiguë : arrêter les
publishers et réconcilier tous les événements postérieurs avant de reprendre.
Ne jamais réinitialiser le registre, même si aucune issue n’est encore visible.

## Permissions, preuve et écritures

| Job | Permissions GitHub | Secrets visibles au processus concerné |
| --- | --- | --- |
| `argos_control`, analyse ou `resume` | `contents: read` | Clé API Argos uniquement pendant la commande de contrôle |
| Scellement dans ce même job | mêmes permissions de lecture | GITHUB_TOKEN et SAS `r`, sans clé API Argos |
| `argos_preview` existant | `contents: read`, `actions: read` | Preuve privée volontaire, aucun droit d’écriture |
| `argos_publish` isolé | `issues: write`, `actions: read` | GITHUB_TOKEN du job et SAS `rw`, aucune clé API Argos |

`actions: read` permet le téléchargement par l’ID d’artefact exact produit par le
contrôle de cette exécution. Les métadonnées du dépôt sont accessibles au token
d’installation ; `contents: write`, `id-token: write` et PAT ne sont pas requis.
La lecture du dépôt et du viewer GraphQL vérifie l’ID, la visibilité, la branche,
le bot et l’accès en lecture. **Elle ne prouve pas le droit de créer** : un refus
du POST devient un diagnostic explicite sans élargir les permissions.

`publication-stage` lit la preuve v2 et le registre, puis chiffre la preuve avec
AES-256-GCM, IV aléatoire et contexte authentifié : dépôt, SHA, run/tentative,
producteur, environnement, digest et politique exacte. Seul `evidence.enc.json`
est transféré, même dans un dépôt public. Il ne contient ni clé de déchiffrement
ni métadonnées de constat en clair. La rétention Actions est de sept jours ; la
preuve déchiffrée expire néanmoins au bout de quinze minutes au maximum, et
avant l’expiration de ses deux sources. Les preuves ne sont pas stockées dans
le registre. Le publisher enlève sa copie déchiffrée après utilisation.

Le publisher vérifie le digest chiffré, le digest original et la provenance
transmis **hors artefact** par `needs.argos_control.outputs`, puis le schéma, la
fraîcheur, les consentements et la politique de #738. Chaque appel reste sur son
origine autorisée, en TLS vérifié, sans redirection, avec taille et délai bornés.
Les credentials GitHub et SAS ne traversent jamais l’autre origine ou Argos.

Le verrou Actions commun au dépôt réduit les collisions. Le vrai verrou partagé
est le **lease Azure de 60 secondes**, renouvelé et vérifié avant les écritures.
Chaque PUT du registre fournit l’ID de lease aléatoire complet **et** l’ETag
précédent. Azure rejette une révision ou un ancien lease ; le nombre `fence` du
moteur est seulement un identifiant opaque, pas le mécanisme de verrouillage.
Le registre est limité à 1 Mio, 2 000 identités et 1 000 budgets d’exécution ;
à saturation, la publication s’arrête avec `PUBLICATION_STATE_UNKNOWN`, sans
purge implicite d’historique ni nouvelle issue. La version actuelle n’automatise
pas la migration du registre : désactiver la publication pour préparer une
migration conservant identités, préparations et budgets.

Avant le POST, une préparation durable réserve l’identité et le budget. Une
réponse perdue impose une lecture paginée complète et une réconciliation par
nonce, destination et bot. Si l’issue reste invisible, la préparation subsiste
et aucun deuxième POST n’est envoyé. Une requête GitHub déjà partie peut finir
après une annulation : son identité préparée reste réservée même si le lease
expire. On ne prétend pas annuler atomiquement un POST distant.

Les issues existantes ne reçoivent aucun PATCH, commentaire ou modification de
texte, titre, labels ou assignations. Toute clôture, label `argos:ignore`,
`argos:false-positive`, `argos:accepted-risk`, marqueur modifié ou identité
incertaine suspend l’automatisation. `reopenResolved=true` est refusé : le
connecteur ne dispose pas d’une condition atomique documentée sur la décision
humaine. Aucun ticket n’est fermé automatiquement.

Le dépôt et le stockage sont revérifiés avant écriture. Un changement de
visibilité détecté bloque ; GitHub ne fournit pas une transaction associant
visibilité et création. Le client doit arrêter les publishers et traiter les
issues/artefacts privés **avant** de rendre un dépôt public. Une copie déjà
exportée et un POST déjà parti ne sont pas révocables par Argos.

## Erreurs, aperçu et reprise sans nouvelle analyse

`DISABLED` n’ouvre aucun fichier et ne contacte aucun fournisseur. Le modèle
`ARGOS_PUBLICATION_PREVIEW=true` conserve son aperçu filtré sans droit Git
d’écriture. Pour un aperçu intégral de la destination via `publish-github`,
utiliser le mode `PREVIEW`, un token en lecture et le SAS `r` : aucune acquisition
de lease, écriture de registre ou issue n’a lieu. La configuration du scellement
et celle de la consommation doivent être identiques.

| Diagnostic | Action du développeur |
| --- | --- |
| `CONFIG_INVALID` | Vérifier JSON, origine/ID courant, consentements, `reopenResolved=false`, SAS de portée blob et permissions exactes `r`/`rw` |
| `PUBLICATION_AUTH_FAILED` | Vérifier le GITHUB_TOKEN du job ou renouveler le SAS expiré ; ne pas ajouter de PAT |
| `DESTINATION_UNAVAILABLE` | Vérifier dépôt courant, issues activées, archivage, visibilité, bot et stockage privé ; absent et inaccessible restent indistinguables |
| `PUBLICATION_RATE_LIMITED` | Attendre Retry-After ou le rétablissement du quota ; reprendre le publisher avec le même registre |
| `ARTIFACT_INVALID` | Vérifier ID d’artefact, digests, configuration, producteur et fraîcheur ; renouveler par `resume` si expiré |
| `PUBLICATION_STATE_UNKNOWN` | Garder le registre et les préparations ; attendre la fin du verrou, réconcilier, restaurer avec prudence si nécessaire ; aucun nouvel audit |

Le résultat JSON reconstruit conserve `auditOutcome`/`auditExitCode` séparément
de `publication` et des compteurs. Une erreur de publication donne le code 3 ;
GO/SITE_NO_GO gardent leurs verdicts 0/1. CONTROL_FAILED reste 2 et n’envoie
aucune preuve publiable. Ni corps HTTP, exception, URL SAS, secret, marqueur de
constat ni texte utilisateur ne sont repris dans les logs/outputs/annotations.
Une preuve invalide produit UNKNOWN, jamais un GO inventé.

Dans les quinze minutes, relancer **uniquement `argos_publish`** : son contexte
consomme la tentative originale transmise par le contrôle, dans le même run et
au même SHA. Le budget ignore la tentative. Au-delà, lancer manuellement le
modèle avec `operation=resume` et l’UUID `original_intent` de l’analyse initiale.
Cette commande retrouve l’admission originale, relit les deux sources et produit
un nouveau digest sans POST d’admission, réservation ou facturation. L’UUID peut
être retrouvé avec la commande hors ligne `intent` dans le contexte original.
`audit` ne remplace jamais une reprise de publication demandée.

Une notice publique après réponse ambiguë n’est jamais adoptée par ressemblance.
Ajouter son numéro `publicIssueId` dans la configuration de confiance, puis
resceller une preuve par `resume`. Le moteur vérifie destination, auteur bot et
corps strictement générique avant de lier le registre, sans créer un doublon.

Pour désactiver : `ARGOS_GITHUB_PUBLISH=false` et `mode=DISABLED`. Conserver le
registre pour une future reprise ; retirer les SAS/permissions si l’arrêt est
définitif. Ne pas copier les journaux bruts pour obtenir de l’aide.

## Vérification et limites avant activation

Les tests de contrat exercent les vraies requêtes normalisées GitHub/Azure avec
une API contrôlée : erreurs, pagination, PR exclues, usurpation, interruption,
public/privé, décisions humaines, chiffrement et relecture de l’ancien run.
`node scripts/ci/azure-journal-integration.mjs` lance Azurite 3.37.0 épinglé par
digest, vérifie TLS, SAS `r`, lease exclusif, ETag, ancien lease rejeté, redémarrage
gracieux avec persistance, changement d’accès et blob absent. Le client livré
n’a aucun mode permettant de rediriger ses requêtes vers cet émulateur.
Avec `ARGOS_AZURITE_ENTRY`, ce harnais peut utiliser une installation locale
Azurite à la place du conteneur. La CI vérifie aussi l’identité GraphQL réelle
du GITHUB_TOKEN **en lecture seule**, sans issue créée ni clé Argos.

Ces tests ne remplacent pas la recette #467 sur un dépôt public/privé de test
explicitement autorisé et sur un véritable compte Azure client : politique
d’organisation GitHub, permissions effectives de création, sauvegarde,
expiration, interruption et suppression des artefacts restent à y prouver.
Aucune issue de test n’est créée dans un dépôt tiers ou dans Argos par ce harnais.

Références primaires : [GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token),
[identité d’une installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation),
[API issues](https://docs.github.com/en/rest/issues/issues),
[lease Blob](https://learn.microsoft.com/en-us/rest/api/storageservices/lease-blob),
[écritures conditionnelles](https://learn.microsoft.com/en-us/rest/api/storageservices/specifying-conditional-headers-for-blob-service-operations).
