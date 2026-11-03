# Erreurs CI v1 — contrat en aperçu

Lot transversal [#741](https://github.com/dokor/argos/issues/741), dépendant
du [socle des droits](entitlements.md). Les routes/client/dashboard/publishers
seront branchés dans leurs lots ; ce contrat n'ouvre aucune API.

## Sources communes

- Schéma : `apps/api-backend/src/main/resources/ci/error-response-v1.schema.json`.
- Catalogue contrôlé FR/EN : `ci/error-catalog-v1.json` dans les mêmes ressources.
- Java : `CiErrorCode` et `CiErrors` ; aucune exception brute n'est sérialisée.
- Client : `scripts/ci/ci-errors.mjs`, décodeur et décision de reprise sans effet
  de bord, utilisés par le futur client #465 et ses publishers.

Le catalogue donne pour chaque code HTTP, étape, catégorie, messageKey, action,
règle de reprise et textes locaux. Les tests comparent les trois sources pour
empêcher une dérive. Une réponse ne contient que :

```json
{
  "schemaVersion": 1,
  "requestId": "69b1ce84-2761-4973-84f3-21e272583d81",
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "stage": "AUTHENTICATION",
    "category": "AUTHENTICATION",
    "messageKey": "ci.errors.AUTHENTICATION_FAILED",
    "actionCode": "CHECK_ARGOS_SECRET",
    "retryable": false,
    "recovery": "NONE",
    "retryAfterSeconds": null
  }
}
```

La fabrique génère un UUID v4 par réponse, sans reprendre un requestId fourni
par le client. Les logs privés peuvent corréler cet identifiant depuis
l'enveloppe ; il n'autorise aucune consultation. Les réponses sont JSON,
`private, no-store`, `nosniff`. Aucune URL, donnée de cible, identifiant de
compte, credential, corps fournisseur, stacktrace ou raison interne n'est un
champ libre du protocole. Un proxy/BFF doit conserver l'enveloppe et le statut
sans y ajouter ses détails internes (#463).

`ACCOUNT_INACCESSIBLE` de la barrière Java se traduit par le même
`AUTHENTICATION_FAILED` que toute clé absente/inconnue/expirée/révoquée.
`FEATURE_NOT_AVAILABLE` n'est retourné qu'après authentification valide. Un
404 ne distingue jamais absence et hors portée. La consultation du cycle de
vie d'une clé requiert la session de son propriétaire (#462).

## Compatibilité et rendu

Le décodeur accepte au plus **4 Kio**, JSON UTF-8, version 1, propriétés exactes,
codes/actions/étapes connus et métadonnées cohérentes avec le catalogue local.
Le transport #465 doit également borner le flux pendant sa lecture, avant
de l'allouer entièrement. HTML, UTF-8/JSON invalide, nouvelle version, champ
inconnu, code incohérent ou statut HTTP discordant donnent un diagnostic local
`TRANSPORT_FAILED`, `CONTROL_FAILED`, sans retry automatique ni requestId reçu.
Il ne reproduit aucun contenu refusé, même en verbose.

Le diagnostic est reconstruit avec les textes et chemins locaux, uniquement
FR ou EN. Les liens réservés sont `/docs/errors#code` et `/en/docs/errors#code`,
sans query ni valeur reçue. Ils seront publiés par #742 ; ils ne sont pas
annoncés comme disponibles aujourd'hui. Le renderer #464/#465 échappe toujours
le texte selon son contexte (HTML, Markdown, terminal, annotations CI) et
n'interprète jamais une chaîne comme commande, template ou script.

## Reprises et sorties

`retryable=true` signifie qu'une récupération contrôlée est possible, pas que
le POST peut être rejoué. Les modes sont :

| Mode | Action autorisée |
| --- | --- |
| NONE | Arrêter, afficher l'action ; pas de boucle automatique |
| RETRY_READ | Réessayer une lecture uniquement dans le budget |
| RECOVER_ADMISSION | Rechercher l'intention initiale avec la même clé d'idempotence ; ne pas créer de nouvelle intention |
| RESUME_POLLING | Retrouver le run admis et reprendre uniquement sa lecture |
| RETRY_PUBLICATION | Reprendre le publisher seul avec déduplication ; jamais l'audit |
| RECONCILE_PUBLICATION | Relire les tickets et réconcilier la création ambiguë ; conserver « indéterminé » si impossible |

La fonction pure `recoveryDecision` impose budget et nombre de tentatives,
backoff exponentiel avec jitter et attente au moins égale à `Retry-After`.
Si le délai atteint le budget restant, elle arrête. Elle ne fait aucun appel
réseau ni écriture. Pour une admission elle autorise seulement la récupération
idempotente ; pour toute publication elle impose d'abord la réconciliation.
Le transport #465 utilisera un budget global incluant requêtes, attente et
reprises, avec deadline par requête inférieure au budget restant. Il conservera
l'intention sur interruption et ne reprendra jamais une écriture à l'aveugle.

Un délai est un entier de 1 à 32 jours maximum, seulement pour les codes de
quota/débit/capacité/fournisseur prévus. Cette borne de protocole couvre une
échéance mensuelle ; elle n'est pas une durée de retry recommandée. Le quota
reste non retryable, même avec une échéance connue. Une date ou un coût non
connu n'est pas inventé ; aucun remboursement n'est promis.

Le futur client conserve les sorties de verdict 0 = GO, 1 = SITE_NO_GO,
2 = CONTROL_FAILED (#466). Un diagnostic de ce protocole est un échec technique,
jamais la preuve que le site est sain. Le verdict et le statut du publisher
sont indépendants : DISABLED, SKIPPED, SUCCEEDED, FAILED, UNKNOWN. Une publication
activée échouée/indéterminée rend le job non réussi (sortie 2), en conservant
le verdict d'audit dans le résultat machine ; un SITE_NO_GO demeure visible.
La politique de verdict complète et les sorties exécutables restent à livrer.

## Précontrôle doctor à brancher dans #464/#465

Le précontrôle vérifie uniquement présence des variables (jamais leur valeur),
configuration non sensible, compatibilité, connexion à l'origine Argos autorisée,
identité/scopes/droit courants, cible et capacité observables. Chaque lecture
utilise la clé API et les mêmes contrôles TLS/scopes/anti-abus et budgets.
Un état non observable est « non vérifié ». Une lecture Git ne prouve pas le
droit de future écriture.

Il ne crée ni audit, réservation, débit, session de contournement, preuve de
domaine ni ticket de test et ne change aucun droit. Aucun scan de dépôts,
origines ou réseau arbitraire. Aucune recommandation de token administrateur,
`--insecure`, repli anonyme, désactivation TLS/SSRF/sandbox/provenance ou
protection des forks/PR/MR. L'export volontaire garde seulement le diagnostic
contrôlé ; il n'est jamais envoyé automatiquement au support.

## Validation et périmètre restant

Tests Java de cohérence catalogue/schéma, bornes, champs autorisés, identifiants
opaques et mapping des droits ; tests Node de toutes les familles FR/EN,
injection/secret synthétique, HTML/JSON/UTF-8 invalides, taille, version,
délais excessifs et décisions sans rejeu de mutation. Les tests HTTP 401/404
intercomptes, lecture réseau bornée, interruption/récupération réelle,
doctor sans effet de bord et publisher créé puis réponse perdue seront livrés
avec #462/#463/#464/#465/#738–#740 et validés ensemble dans #467. Ce lot ne
prétend pas les avoir exécutés.
