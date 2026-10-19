# Synchronisation optionnelle des issues — politique v1, #738

**Préversion, premium-ci.enabled=false jusqu’à #467.** Ce lot fournit le moteur
commun `clients/ci/src/publication-sync.mjs` et ses fixtures GitHub/GitLab. Les
contrat et les fixtures seuls ne créent aucun ticket client réel. Le
[connecteur GitHub #739](github-publication.md) fournit désormais les requêtes
GitHub et le registre privé Azure ; GitLab reste #740. Le contrôle interne #94 garde sa
politique propre ; sa réouverture systématique n’est pas utilisée ici.

## Activation et sélection

`publicationConfiguration()` renvoie DISABLED par défaut. Désactivé signifie
zéro lecture d’artefact, acquisition de verrou, appel fournisseur ou mutation.
PREVIEW calcule un plan après lectures seulement ; il ne réserve pas de budget
et n’écrit ni ticket ni journal. SYNC exige l’activation explicite, une destination
vérifiée et un connecteur satisfaisant toutes les garanties ci-dessous.

Les exemples [GitHub](../../clients/ci/examples/publication.github.json) et
[GitLab](../../clients/ci/examples/publication.gitlab.json) sont désactivés,
avec consentements à false et identifiants fictifs. Les valeurs de destination
viennent de la configuration de confiance du client, jamais d’un rapport ou
d’un marqueur copié dans une issue. L’API doit confirmer origine SaaS fixée,
ID immuable du dépôt/projet, chemin canonique, visibilité, identité numérique
du bot authentique et disponibilité des issues. L’état est relu avant chaque
mutation Git. Une destination modifiée ou inconnue ne déclenche aucun repli public.

| Paramètre | Défaut / règle |
| --- | --- |
| version | 1 ; champ, version ou valeur inconnus refusés |
| mode | DISABLED, puis PREVIEW ou SYNC explicitement |
| destination | provider/origin/id/repository/visibility/botId, vérifiés par le connecteur |
| environments | production ; staging et preview sélectionnables |
| categories | performance, security, seo, a11y |
| severities | critical, important ; jamais info, panne ou agrégat seul |
| labels | argos-ci ; au plus dix labels contrôlés, uniquement à la création privée |
| maxNewIssues | 5, configurable de 0 à 10 |
| maxNotifications | 5, configurable de 0 à 20 ; création et réouverture |
| allowPrivateDetails | false ; consentement obligatoire pour les constats privés |
| allowPublicNotice | false ; consentement distinct pour le texte public générique |
| publicIssueId | null ; liaison humaine explicite à une notice publique existante |
| reopenResolved | false ; activation distincte, condition atomique obligatoire |
| groups | vide ; regroupement de causes explicitement déclaré par le client |

Seuls GO/SITE_NO_GO et confirmedFindings avec ticketEligible=true de la politique
serveur reconnue sont utilisables. La sélection applique environnement, catégorie
et sévérité. Le moteur ne lit ni preuve brute, top six, score, titre de cible ou
texte reçu pour fabriquer un ticket. Un contrôle impossible n’autorise aucun
constat. Une publication ne crée jamais de nouvelle admission ou analyse.

La commande CLI `publication-preview` reste une prévisualisation des constats
éligibles, sans connecteur de synchronisation réel. Elle applique les filtres
ARGOS_PUBLICATION_ENVIRONMENTS, ARGOS_PUBLICATION_CATEGORIES et
ARGOS_PUBLICATION_SEVERITIES (CSV de valeurs connues), les labels contrôlés et
ARGOS_PUBLICATION_MAX_NEW. Elle n’affirme pas avoir réconcilié l’état Git distant.
Les futurs connecteurs invoqueront le moteur commun avec leur inventaire réel.

## Identité stable et regroupement

Une issue privée est identifiée par le SHA-256 canonique de la version de
politique d’identité, du fournisseur/origine/ID immuable de destination,
de l’environnement, du périmètre cible et de la clé canonique du constat.
SHA déployé, date, run, tentative, score et sévérité ne font pas partie de
l’identité. Un renommage du dépôt conserve son ID et ne crée pas une autre cause.

Par défaut le périmètre est fingerprints.scope du verdict : URL demandée/finale
et périmètre d’exécution, sans les révéler. Une autre page n’est pas présumée
partager les mêmes en-têtes ou la même cause. Pour les causes réellement communes,
le client peut déclarer un groupe avec ID stable et liste explicite d’empreintes
de périmètre. Même groupe/environnement/clé → même issue. Un périmètre ne peut
appartenir à deux groupes. Le moteur ne déduit pas une cause commune d’une
simple ressemblance de domaine ou de score.

Changer le regroupement d’une cause déjà enregistrée exige une migration explicite
du registre. Un chevauchement avec une ancienne identité provoque CONFIG_INVALID,
sans nouveau ticket : un changement de configuration ne contourne pas une
décision humaine. Le connecteur doit proposer la migration contrôlée plutôt
que supprimer un registre ou remplacer une empreinte au hasard.

## Journal durable, verrou et réponse ambiguë

Le registre est **privé et durable**, distinct des artefacts de rapport à sept
jours. Il garde uniquement identités techniques, nonce, ID d’issue, phases et
budgets nécessaires à la déduplication ; ni credential, URL, preuve ou diagnostic
brut. Il ne disparaît pas à la fin d’un job ni après suppression d’un rapport.
Le client contrôle sa rétention et sa sauvegarde ; effacer une association peut
perdre la déduplication. Un cache CI ou artefact fourni par un job non fiable
ne peut pas remplacer ce registre. Un dépôt public ne doit jamais l’héberger.

Le connecteur fournit une exclusion par destination, partagée par tous les
workflows/runners concernés, et des écritures atomiques du journal par révision
attendue et jeton de génération de verrou (fence). Une simple Map en mémoire,
un fichier local par runner ou un booléen de configuration ne suffit pas.
La possession et l’échéance sont recontrôlées avant toute écriture. Une perte
de verrou interrompt l’opération ; aucune remise à zéro automatique.

L’inventaire couvre tous les états, sans recherche éventuellement incohérente :
au plus 20 pages de 100 issues, 1 Mio cumulé et 64 Kio par corps. Une page
tronquée, répétée, inconnue, d’un autre dépôt ou un inventaire trop grand arrête
la publication avant création. Les connecteurs ne doivent jamais déclarer
complete=true faute de savoir poursuivre une pagination.

Avant une création, le moteur persiste CREATE_PENDING et son budget, avec un
nonce aléatoire de 256 bits. Puis il crée une seule fois. La réponse authentifiée
enregistre l’ID immuable sous ACTIVE. Après une réponse perdue, le moteur relit
l’inventaire et vérifie destination, auteur bot, empreinte/nonce préparés, bloc
exact et fenêtre de création. Un marqueur copié sans registre, un autre bot ou
plusieurs candidats ne constituent pas une preuve de propriété.

Si l’issue reste invisible, CREATE_PENDING reste durable et le résultat est
UNKNOWN. Une reprise ne refait pas de POST : elle cherche de nouveau la même
issue. Seul un refus définitif authentifié du connecteur (`PublicationRejected`)
peut libérer une préparation dont l’écriture a été refusée. Une préparation
interrompue avant tout appel Git est retirée seulement si le même verrou est
encore valide et le CAS du journal confirme l’opération. Si cet état ne peut
être démontré, conserver UNKNOWN.

Le plafond est partagé par destination/dépôt source/run, sans inclure la tentative.
Un retry ou nouveau processus ne le remet pas à zéro. Il compte les tentatives
préparées de création/réouverture, de façon conservatrice, y compris un refus
qui n’a finalement envoyé aucune notification. Une nouvelle invocation de
publication peut réutiliser la même analyse, sans la refacturer. Le connecteur
ne purge jamais un budget ou une opération encore ambiguë pour contourner un plafond.

## Notes et décisions humaines

Le bloc privé initial est stable : clé contrôlée, environnement déclaré, empreintes
de périmètre configurées, instruction fixe et marqueur
de gestion. Il ne contient ni date, score, sévérité changeante, SHA ou compteur.
**Le MVP ne réécrit aucun corps, titre, commentaire, label ou assignation d’issue
existante.** Il ne génère pas un commentaire à chaque audit. Des notes avant/après
le bloc restent intactes ; si le texte géré lui-même a été modifié, l’automatisation
est suspendue pour cette issue. Aucun contrôle ne la ferme automatiquement.

Les connecteurs normalisent les décisions depuis des événements et acteurs
authentifiés, avec preuve de droit de triage/maintenance, version et date :
NONE, RESOLVED, IGNORED, FALSE_POSITIVE, ACCEPTED_RISK ou UNKNOWN. Une prose
dans le corps, un marqueur de résolution copié ou un commentaire non autorisé
ne suffit pas. Une décision inconnue/non vérifiable suspend l’automatisation.
Ignorer/faux positif/risque accepté bloque jusqu’à l’échéance explicitement
choisie, ou indéfiniment si elle est absente. L’absence de motif de fermeture
n’est pas interprétée comme une résolution.

Une réouverture exige reopenResolved=true, une résolution autorisée (ou une
ignorance expirée), et une **nouvelle observation commencée après la décision**.
Relire le même ancien verdict après la fermeture n’est pas une récidive. Le
connecteur doit pouvoir conditionner atomiquement la seule transition d’état
à la révision et à la version de décision relues. Si son API ne permet pas de
garantir cette condition, il refuse l’option au lieu de promettre une protection
non disponible. Le défaut reste la fermeture respectée. Un timeout de réouverture
devient REOPEN_PENDING ; pas de second appel aveugle.

## Public et privé

Pour un dépôt privé vérifié et un consentement aux détails, la clé provient du
catalogue ; aucun HTML, recommandation de cible, mention, URL ou lien à token
n’est ajouté. Les labels sont configurés, pas repris d’un texte audité.
La confidentialité est vérifiée de nouveau immédiatement avant chaque écriture.

Pour une destination publique explicitement choisie, il existe **une seule notice
générique par destination**, tous environnements et cibles confondus. Titre et
corps correspondent exactement au modèle publicIssue de #736 : ni identifiant
de corrélation, empreinte, cible, catégorie, sévérité, constat, score, label ou
lien privé. Une notice publique ne contient donc aucun nonce de reprise.

Après une création publique ambiguë, le moteur refuse de l’adopter sur la seule
ressemblance du texte. Le client peut renseigner publicIssueId dans sa configuration
de confiance après avoir identifié l’issue existante. Le moteur vérifie l’ID,
la destination, l’auteur bot et le modèle fixe avant de lier le registre, sans
nouvelle création ni intervention de l’opérateur Argos. Une liaison existante
ne peut être changée silencieusement. Les connecteurs #739/#740 doivent exposer
cette reprise guidée et les procédures de réparation vérifiée du journal ; ne
jamais recommander de supprimer une préparation ou de relancer l’audit.

## Fraîcheur et suppression

`ci-evidence-v2` ajoute issuedAt, observationStartedAt et sourceExpiresAt. Après
le verdict, le client relit l’admission terminée, les deux synthèses authentifiées
et le verdict ; la date d’observation vient des débuts de runs conservés par le
serveur. L’expiration de la copie est le minimum entre sept jours et les deux
expirations serveur. Un résultat supprimé/expiré ou changé ne produit pas cette
preuve. Une ancienne preuve v1 est refusée par cette version du client.

Une publication exige une preuve **relue depuis quinze minutes maximum**, encore
valide à chaque mutation. Après une attente/reprise plus longue, exécuter `resume`
dans un job sans droits d’écriture Git avec la clé Argos, l’UUID d’intention
initiale et un dossier neuf. Cela relit les résultats, sans POST, nouvelle mesure
ou crédit ; les dates d’observation d’origine ne changent pas. Transmettre le
nouveau digest et le producteur hors artefact au job Git séparé, sans sa clé Argos.

Cette preuve est un instantané borné, pas une garantie de révocation instantanée :
une suppression intervenant après sa lecture ne révoque pas rétroactivement
la copie externe. La fenêtre maximale est quinze minutes, bornée aussi par
l’expiration serveur, et doit être acceptée dans #467. Pour une révocation
immédiate, arrêter aussi le publisher et supprimer les copies côté fournisseur.
Ne jamais prolonger une expiration ni présenter un SHA déclaré comme observé.

Supprimer les artefacts privés **avant** tout passage prévu du dépôt source à
public ; nettoyer immédiatement en cas de dérive. Les artefacts restent au plus
sept jours, les diagnostics/traces au plus 24 heures ; les associations techniques
du journal ont leur propre finalité de déduplication. Une suppression serveur
ne supprime ni tickets, notes humaines, journal client ou copies déjà exportées.

## Contrat des connecteurs et résultats

`synchronizeIssues({evidencePath, expected, auditVerdict, config, adapter, signal})`
ne reçoit aucun secret Argos. expected vient du producteur authentique de la
même exécution (dépôt, SHA, run/tentative, producteur, environnement, digest).
Le fichier est vérifié par readTrusted avant parsing ou appel fournisseur.

L’adaptateur expose readDestination, listIssues(cursor), loadJournal et, en
SYNC, withDestinationLease(key, callback). La session clôturée par ce verrou
expose aussi assertHeld, saveJournal(CAS + fence), createIssue, readIssue et
reopenIssue conditionnelle. Ses capacités v1 doivent garantir durableJournal,
privateJournal et fencedLease. Ces drapeaux décrivent des garanties réellement
implémentées et testées ; ils ne permettent pas de les désactiver. Un connecteur
sans stockage privé durable ou verrou partagé refuse SYNC avant toute écriture.

Les pages normalisées `{items,nextCursor,complete}` et les issues normalisées
`{id,destinationId,authorId,isBot,kind,state,body,revision,createdAt,decision}`
sont strictes. Jamais de PR/MR, de corps provider brut retourné comme diagnostic
ou de URL de pagination choisissant une autre origine. Les écritures ne
transportent que le payload contrôlé de création, ou ID/révision/version de
décision pour une réouverture ; aucune liste humaine n’est renvoyée.

Le moteur borne chaque appel à quinze secondes et l’ensemble à 120 secondes
par défaut (maximum 600). Les lectures transitoires ont trois tentatives au
plus, backoff/jitter/Retry-After dans le budget global ; les mutations ambiguës
sont réconciliées, jamais rejouées. Le connecteur doit aussi borner TLS,
redirections, MIME/UTF-8 et corps HTTP comme #737, et respecter AbortSignal.

| Publication | Effet sur le résultat |
| --- | --- |
| DISABLED | Aucun effet Git, code d’audit conservé |
| PREVIEW | Lectures seulement, plan indicatif non atomique |
| NO_FINDINGS | Aucun constat retenu, aucune mutation |
| LIMIT_REACHED | Plafond visible, pas de dépassement implicite |
| SUCCEEDED | Créations/transitions connues ou état inchangé |
| FAILED | Refus connu, diagnostic contrôlé et reprise documentée |
| UNKNOWN | Écriture/état ambigu, réconciliation seule |

Audit GO=0, SITE_NO_GO=1, CONTROL_FAILED=2 restent séparés. Une publication
activée échouée/indéterminée donne 3 en conservant le verdict connu. Aucun DTO,
nonce, empreinte privée ou corps de ticket ne sort dans le résultat : seulement
compteurs bornés, statut et diagnostic FR/EN issu du catalogue. Un contrôle
impossible garde 2 ; aucune tâche de défaut n’en est tirée.

Validation : `node --test scripts/ci/publication-sync.test.mjs` exerce les deux
adaptateurs de fixture avec stockage sur disque, concurrence et redémarrage,
réponse perdue/issue invisible, faux bot/marqueur, pagination, budget, décisions,
notes, visibilité, délai, cas public et erreur hostile. Ce n’est ni un test de
mutation des APIs hébergées ni une preuve de CAS GitHub/GitLab. Le lot #739
ajoute les tests de requêtes GitHub et une vérification réelle de lease/ETag
sur l’émulateur Azure ; la recette hébergée reste obligatoire dans #467 et
le connecteur GitLab dans #740.
Sources des mécanismes provider à vérifier lors de leur implémentation :
[GitHub issues](https://docs.github.com/en/rest/issues/issues),
[GitHub concurrence](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency),
[GitLab événements d’état](https://docs.gitlab.com/api/resource_state_events/),
[GitLab resource groups](https://docs.gitlab.com/ci/resource_groups/).
