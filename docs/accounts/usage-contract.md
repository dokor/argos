# Consommation mensuelle — milestone 8

L’[historique graphique](usage-timeline.md) décrit les agrégats personnels,
les dimensions et les limites de couverture du registre (#664).

Epic #14, issues #449–#452. Le lancement conserve le comptage sans plafond.
Aucun tarif, paiement ou avantage commercial premium n'est attribué par ce lot.
L'offre `ARG_ACCOUNT_USER.offer` est indépendante du rôle d'autorisation.

## Unité et calendrier

Un run produisant un rapport consomme une analyse, même si ce rapport est
partiel ou sans score global. Plusieurs analyses de la même URL sont des runs
distincts. Les modules, tentatives/reprises du worker, lectures et ajout d'une
URL à Mes sites ne consomment rien. Un échec sans rapport libère sa réservation.
L'expiration ou suppression ultérieure d'un rapport ne rembourse pas le débit.

La période est le mois calendaire de **publication**, dans `usage.timezone`
(UTC par défaut). `startsAt` et `resetsAt` sont des instants ISO-8601 ; le fuseau
de référence est aussi affiché. La remise à zéro consiste à lire la période
suivante : aucun job destructif ni compteur remis à zéro n'est nécessaire.
Les changements d'heure et d'année suivent `java.time.ZoneId`.

Une réservation d'un run non terminé reste active au changement de mois. La
capacité de lancement est `used` du mois courant + toutes les réservations
actives du compte, y compris celles de mois précédents. Un rapport publié
après la frontière débite le nouveau mois. Une réservation déjà acceptée est
honorée : publication et lecture ne sont jamais refusées si le plafond est
ensuite réduit ou si un rattachement de rapport augmente la consommation.

## Configuration des offres

```hocon
usage.timezone = "UTC"
usage.offers.FREE = {}
usage.offers.PREMIUM = {}
```

Un `monthly-limit` absent ou null signifie sans plafond. S'il est configuré,
il est un entier non négatif ; zéro interdit tout nouveau lancement connecté.
Les clés d'offre sont des codes majuscules de 16 caractères maximum, comme
ceux persistés sur les comptes. Les offres sans limite configurée sont sans
plafond. Aucun plafond chiffré n'est livré en configuration applicative.
Les nombres employés par les tests sont uniquement des fixtures.

La configuration est chargée au démarrage ; son activation ou l'affectation
d'une offre à des comptes relève d'une décision d'exploitation et produit.
L’[administration](administration-contract.md) permet de modifier l’offre et le plafond individuel ; aucune facturation n’est ajoutée.
Le quota est vérifié dans `AuditRunService.createQueuedRun`, point commun du
moteur, même lorsqu'un appelant n'a pas fourni de connexion JDBC. Les futurs
points d'entrée API/CI/programmation devront utiliser ce moteur avec le
propriétaire authentifié. Ces nouveaux points d'entrée ne sont pas livrés ici.

## Registre et transactions

`ARG_USAGE_RUN.id` est le run, unique, avec propriétaire, période, état
`RESERVED`/`COUNTED`/`RELEASED`, dates de réservation, de débit et de libération. Les listes et
compteurs ne lisent ni `result_json` ni `report_json`.

- Admission et insertion du run/réservation appartiennent à la même
  transaction. Un refus ne persiste aucun run personnel.
- Insertion du rapport, transition COMPLETED et débit appartiennent à la
  transaction de publication existante. Un rollback conserve le run RUNNING
  et sa réservation ; une nouvelle publication ne double pas le débit.
- FAILED définitif et libération sont atomiques dans `AuditRunDao`, y compris
  l'abandon par le reaper. Requeue conserve la capacité ; un worker obsolète
  ne libère ni ne débite la réservation du worker courant.
- `ARG_USAGE_ACCOUNT` est un verrou dédié par propriétaire. Les lectures de
  consommation utilisent une lecture courante sous ce verrou, pour éviter
  une photographie obsolète lors de lancements simultanés sous MariaDB.

Publication et échec verrouillent run puis registre ; les transactions de
session/rattachement verrouillent compte puis run puis registre. Le verrou
de registre n'a volontairement pas de FK vers le compte, afin que publication
ne prenne jamais un verrou de compte après un verrou de run. Les comptes sont
archivés, pas supprimés. Le registre est conservé à l'archivage et ne contient
ni email, URL brute, credential, token public ou donnée de rapport.

## API privée et interface

`GET /api/account/usage` exige une session active de compte vérifié. Le
propriétaire vient de cette session ; le BFF rejette les paramètres de query
et n'expose aucune mutation de compteur/offre/plafond. Réponse privée no-store :

```json
{
  "offer": "FREE",
  "period": "2026-10",
  "timezone": "UTC",
  "startsAt": "2026-10-01T00:00:00Z",
  "resetsAt": "2026-11-01T00:00:00Z",
  "used": 0,
  "reserved": 0,
  "limit": null,
  "available": null,
  "canLaunch": true
}
```

À capacité atteinte, création/rattachement d'un run encore actif retourne
429 `quota_exceeded`, `resetsAt` et `Retry-After` jusqu'à la frontière suivante.
Une libération de réservation peut rendre la capacité disponible avant cette
date ; il est possible d'actualiser manuellement. Le code est distinct du
refus anti-abus. Les sites, rapports et autres lectures privées restent
accessibles ; un refus de quota ne révoque pas la session.

La consommation est partagée par le layout privé, lue une fois après
authentification, à une mutation/fin de run, sur actualisation volontaire ou
à la frontière mensuelle. Il n'y a pas de polling permanent. Ce GET ne
renouvelle pas l'activité de session. La révocation/archivage retire les
données affichées. FR/EN, noms accessibles et SCSS Modules/tokens sont utilisés.
La désactivation du bouton aide l'utilisateur ; le serveur reste l'autorité.

## Audit anonyme et rattachement

Le filtre `PublicWriteFilter` et son limiteur anti-abus existants restent
appliqués à POST audits, indépendamment de la consommation des comptes.
Les validations SSRF BFF et Java et les preuves de rattachement ne changent pas.
Un run sans propriétaire n'alimente aucun compte.

- Run QUEUED/RUNNING rattaché : admission et réservation du compte, avec
  transfert de propriété/proof/sites dans une seule transaction. En cas de
  quota atteint, tout est annulé et la preuve reste utilisable ultérieurement.
- Rapport déjà produit rattaché : un seul débit, au mois de sa publication
  d'origine. Le rattachement ne relance rien et n'est pas refusé par un
  plafond ; il peut donc faire dépasser la consommation affichée. Rejouer le
  rattachement ou republier le même run ne débite pas à nouveau.
- Run échoué sans rapport rattaché : aucun débit ni réservation.

Ce choix préserve l'audit sans compte et l'accès au résultat déjà produit.
Une personne peut changer de navigateur/réseau ou créer plusieurs comptes ;
les limites réseau/proof ne constituent pas une identité globale. Le quota
des comptes n'est donc pas une prévention absolue des contournements par
audit anonyme puis rattachement. Aucun fingerprint, fusion forcée des comptes
ou promesse de protection de facturation n'est introduit.

## Migration et exploitation

V14 crée les tables et les compagnons QueryDSL. Elle reprend tous les runs
possédés, sans plafond de 20/100 : rapports encore présents, même expirés ou
partiels, comptés à leur date UTC ; runs QUEUED/RUNNING réservés ; autres runs
libérés. Les propriétaires archivés restent dans l'historique. Les anciens
rapports déjà purgés ne peuvent pas être reconstruits et ne sont pas débités.

Arrêter les écritures/worker, sauvegarder, garder JDBC et MariaDB en UTC et
appliquer Flyway avant de lancer la nouvelle application. Mesurer la reprise
sur une copie représentative : l'INSERT SELECT historique est indexé mais
n'est pas un benchmark de production. Les créations IF NOT EXISTS et inserts
IGNORE permettent une reprise après interruption sous contrôle opérateur :
inspecter les tables, corriger la cause, puis réparer la migration Flyway
échouée et la rejouer, sans supprimer le registre. Une répétition ne remplace
pas les débits déjà enregistrés.

La première reprise suppose `usage.timezone=UTC`. Modifier ensuite le fuseau
nécessite une pause des écritures et une conversion explicite des périodes
existantes depuis `counted_at` ; ne pas changer le fuseau seul en cours de mois.
Une restauration doit conserver runs, rapports, registre et historique Flyway
ensemble. Pas de déploiement de production réalisé dans ce lot.

## Extension Clarté F05

Le [guide F05](../connected-space/usage-f05.md) décrit `/account/usage`, le
journal privé paginé `GET /api/account/usage/events?period=YYYY-MM&limit=20&offset=0`
et les primitives internes d'admission multiple et d'annulation. `available`
est calculé par le serveur : null sans plafond, sinon max(0, limit-used-reserved).
L'offre et le plafond effectifs sont relus sous verrou pour chaque admission.
V21 ajoute `ARG_AUDIT_RUN.cancel_requested`, `ARG_USAGE_RUN.released_at` et
l'index propriétaire/période/date. Les dates historiques de libération ne
sont reprises que depuis un `finished_at` connu ; null reste explicite.
Aucun endpoint de lot ou d'annulation utilisateur n'est activé par F05.
