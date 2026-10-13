# F01 — Contrats et fondations du modèle connecté

Lot [#551](https://github.com/dokor/argos/issues/551), exigences ARC-01,
ARC-02, ARC-05, QA-03 et QA-16. Ce document distingue le socle livré des
comportements que les prochains lots doivent construire dessus.

## Source unique des contrats

[connected-space.openapi.json](../../apps/api-backend/src/main/resources/contracts/connected-space.openapi.json)
décrit 20 opérations et 51 schémas. Les records Java validés et les types
TypeScript readonly sont générés par un script Python sans dépendance externe.

Depuis la racine du dépôt :

```sh
python scripts/contracts/generate-connected.py
python scripts/contracts/generate-connected.py --check
python docs/connected-space/validate.py
```

Modifier le schéma, régénérer les deux consommateurs et ajuster les tests dans
la même PR. Ne pas modifier directement `ConnectedContracts.java` ou
`src/lib/connected/contracts.ts`. La CI vérifie leur absence de dérive ; une
modification du schéma ou du générateur déclenche les deux suites.

- Chaque champ de record est obligatoire, y compris ceux acceptant `null`.
  Jackson conserve ces nulls même avec la configuration globale NON_NULL.
- Les identifiants sont des chaînes décimales positives dans la plage Long,
  sans conversion en nombre dans le navigateur. Les compteurs sont des entiers
  positifs ou nuls, bornés à la précision entière JavaScript.
- Score : entier 0–100 ou null ; couverture : ratio 0–1 ou null, avec sa
  version. Un échec sans rapport ne devient ni un score 0 ni zéro constat.
  Dernière tentative et dernier rapport disponible sont deux projections distinctes.
- Les mutations n’acceptent ni ownerId ni propriétés inconnues. Les validations
  structurelles ne remplacent pas DNS/SSRF, permissions, transitions d’état,
  partition des compteurs ou transactions d’admission.
- Les listes portent `items,total,limit,offset,snapshotAt`. Total et tri sont
  calculés dans le scope du propriétaire avant pagination. Défaut20, maximum100.
- Usage réutilise `UsageService` : `limit:null` et `available:null` signifient
  illimité ; sinon `available=max(0,limit-used-reserved)`. Aucune autre comptabilité.
- `connectedError()` est la frontière unique d’adaptation de l’erreur compte
  historique et de la nouvelle enveloppe. Une valeur inconnue n’expose jamais
  du texte d’exception ; les codes sont traduits par les futurs écrans.

## Profil réellement disponible

GET `/api/account/analysis-profiles` est implémenté dans Java et autorisé par
le BFF same-origin. Il exige une session de compte actif/vérifié et retourne
`private, no-store`. Le BFF refuse les paramètres non prévus et ne transmet
pas les cookies directement au backend : il utilise la session Bearer serveur.

Le seul profil est `server-default-v1`, libellé traduit « configuration serveur ».
Son snapshot contient la version et l’empreinte de la `ScorePolicy` injectée
(actuellement `DefaultScorePolicy`), ainsi que `COLLECTOR_DEFAULTS`.
Il ne prétend pas connaître le navigateur ou les versions effectives des
collecteurs d’un run : F03/F07 devront les relever à l’exécution. Les profils
mobile/desktop du prototype ne sont pas proposés. Aucun lancement existant
n’est modifié par ce catalogue.

## Modèle livré par V19

Les anciennes migrations restent dans Flyway ; on ne réécrit pas leur checksum.
Une base neuve rejoue toute la chaîne puis V19. Cette PR n’exécute aucun reset,
backfill, changement d’offre utilisateur ou suppression en production.

| Table | Rôle et invariants |
|---|---|
| `ARG_DOMAIN_DISCOVERY` | Propriétaire et site privé, requête/limites JSON, état, expiration, compteurs, annulation, version, clé d’idempotence et empreinte de requête |
| `ARG_DOMAIN_DISCOVERY_PAGE` | URL normalisée complète, source/profondeur, éligibilité et motif, rattachées au même propriétaire/site/découverte |
| `ARG_DOMAIN_BATCH` | Sélection, snapshot du profil, état/version et idempotence propres au lot, liés à la découverte du même propriétaire/site |
| `ARG_DOMAIN_BATCH_PAGE` | Association immuable entre sélection découverte, URL suivie et run enfant privé ; un run ne peut appartenir à deux lots |

Les FK composites empêchent les rattachements entre comptes, sites,
découvertes ou runs anonymes. Elles ne démontrent pas qu’une URL découverte
correspond à l’URL de l’audit : F07 doit résoudre et comparer les URL normalisées
dans la transaction d’admission, avant insertion des enfants.

Les index uniques sur `active_owner_id`, calculé pour QUEUED/RUNNING,
imposent au plus une découverte et un lot actifs par propriétaire, même en
concurrence. Un état terminal libère son emplacement. Cela n’est pas un worker
ni un mécanisme de reprise : F06/F07 géreront timeout, annulation et reprise.

L’idempotence est unique par propriétaire et type d’opération. Les services
F06/F07 compareront l’empreinte normalisée et restitueront le résultat existant
ou IDEMPOTENCY_CONFLICT ; la contrainte SQL seule ne fournit pas cette réponse.

La découverte déduplique par SHA-256 de l’URL complète, sans index de préfixe.
Le modèle d’audit existant possède encore un index unique sur les 255 premiers
caractères de `ARG_AUDIT.normalized_url`. **F07 doit traiter cette limite avant
l’admission de lots de longues URL**, avec test de deux URL ayant le même
préfixe. Ne pas considérer la protection de la découverte comme un correctif
de l’identité globale des audits.

Les quatre couples entité/`Q*` décrivent toutes les colonnes. Les colonnes
générées (`active_owner_id`, `normalized_url_hash`) sont en lecture seulement :
les futurs writers doivent lister leurs colonnes insérables, pas utiliser un
`populate()` générique. Les dates sont des Instant ; les hashes des byte[].

`ConnectedDomainDao` fournit les lectures privées et la pagination de base.
Il exige `ConnectedOwner`, construit depuis le contexte issu de
`AccountSessionService.with`, jamais depuis le JSON ou un paramètre owner.
Un ID étranger et un ID absent donnent la même erreur 404. Les services futurs
doivent utiliser une même transaction/snapshot pour une réponse composite.
Les filtres métier des listes complètes restent à implémenter en F06–F10.

## Inventaire conservé / remplacé

| Famille existante | Décision F01 et suite |
|---|---|
| `ARG_ACCOUNT_USER`, credentials, identities, sessions, tokens, OAuth | Conservés ; aucun second registre d’identité. F04 construit l’UI sur leurs services |
| `ARG_ACCOUNT_SITE`, `ARG_ACCOUNT_SITE_URL` | Conservés. L’ID public privé « domaine » est le site du compte, pas le domaine partagé |
| `ARG_DOMAIN`, `ARG_DOMAIN_ANALYSIS` | Conservés comme normalisation/cache technique partagé ; aucune ownership déduite du hostname |
| `ARG_AUDIT`, `ARG_AUDIT_RUN`, `ARG_AUDIT_REPORT` | Conservés comme moteur et rapports. V19 ajoute seulement un index composite de run pour la FK privée |
| `ARG_USAGE_RUN`, registre mensuel existant | Conservés, sans double écriture. Lien au batch obtenu par `run_id` ; réservation atomique multi-runs en F05/F07 |
| Journal/entitlements admin existants | Conservés. Version optimiste, motifs et état SUSPENDED seront ajoutés avec les transitions et contrôles F11 |
| Tables public, newsletter, analytics | Conservées, hors refonte connectée |

Aucune table n’est supprimée ou remplacée physiquement dans F01. Les nouveaux
lots remplacent la navigation et les projections de l’espace connecté dans
les lots UI ; les primitives ci-dessus restent uniques.

| Routes | État après F01 |
|---|---|
| `/api/account/analysis-profiles` | Nouvelle lecture disponible, vérifiée côté Java et BFF |
| Auth/me/sessions/methods, sites/URLs/runs/rapports privés, usage actuels | Conservés sous leurs [contrats existants](../accounts/contract.md) |
| Admin users/entitlement/journal actuels | Conservés sous le [contrat actuel](../accounts/administration-contract.md). Les formes Clarté OpenAPI sont la cible F11, pas une modification silencieuse des réponses existantes |
| Overview/pages/domain-discoveries/domain-batches/domaines et usage/events | Contrats cibles ; aucune route runtime fictive, pas d’ouverture BFF anticipée |
| Suspension et entitlement-options | Cibles F11, non exposées. SUSPENDED n’est pas encore un état stockable dans la table compte |
| Routes publiques, BFF public, moteur, monitoring | Conservés ; retrait des éventuels vestiges connecté en F12 après leur inventaire |

La rétention existante supprime les rapports expirés et leurs payloads, pas les
runs : les nouvelles FK préservent donc l’historique structurel. F06/F07
définiront leur purge de découvertes/lots sans supprimer de parent référencé.

## Base vierge et contrôles

Le workflow MariaDB integration utilise une MariaDB11.4 jetable. Le fixture
refuse un schéma autre que `argos_credentials_test` sur localhost/127.0.0.1
avant `clean`. **Ne jamais définir ses variables vers une base utile.**

`ConnectedModelIT` vérifie : migrations sur vide sans faux compte, correspondance
des colonnes QueryDSL, lectures réelles et totaux privés, FK inter-comptes,
refus des runs anonymes/réutilisés, idempotence, contraintes de dates/JSON/états,
URL longues et concurrence des emplacements actifs. Le workflow vérifie aussi
le démarrage du JAR et la génération QueryDSL dans un répertoire temporaire.

Commandes depuis les dossiers respectifs :

```sh
# apps/api-backend, Java21 ; tests unitaires et packaging
mvn --batch-mode verify
# uniquement avec le fixture MariaDB jetable configuré comme dans la CI
mvn --batch-mode -P mariadb-integration -Dit.test=ConnectedModelIT verify
# apps/console-web
npm ci
npm run lint
npm test
npm run build
```

Les tests contractuels font le round-trip de chacun des 51 schémas, vérifient
null/absent, propriétés interdites, IDs longs, bornes et enums. Les tests
profil/BFF couvrent compte actif, non vérifié, archivé, sans session et les
routes planifiées interdites. Cela ne constitue pas la recette HTTP des
futures ressources domaine ; F06–F10 devront la réaliser.

Pour une future installation neuve : créer une base isolée et vide, configurer
les secrets comme dans le [runbook compte](../accounts/operations.md), laisser
le backend appliquer Flyway, vérifier monitoring puis inscrire/vérifier un
compte par les mécanismes existants. Le premier rôle ADMIN est provisionné
par l’opérateur selon ce runbook ; aucune migration ne crée de mot de passe,
session ou administrateur par défaut. L’installation et sa validation réelle
restent une opération distincte de cette PR.
