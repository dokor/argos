# Vérification des cibles CI — #734

Le lot #734 ajoute les preuves, les primitives de portée et leur application
dans les collecteurs. Il dépend des PR #743/#744. L'API d'admission CI #463
reste à livrer : aucun audit CI client n'est ouvert et `premium-ci.enabled`
reste **false**. Les pages de gestion reprendront la maquette dans #464.

## Une origine exacte, une preuve liée au compte

Le MVP propose le fichier HTTPS, sans credential de cible. L'origine est
`https://hostname` au port standard ; ni chemin, query, fragment, identifiants,
IP, wildcard, suffixe public ni suffixe d'hébergement partagé connu par la
Public Suffix List de Guava. `www`, le domaine parent et chaque sous-domaine
sont distincts. Aucune preuve n'autorise implicitement un enfant ou un autre
tenant. Une preview publique peut vérifier son hostname propre en servant le
fichier ; une URL sous un chemin partagé ne donne aucun droit sur l'hébergeur.
DNS TXT et HTTP sans HTTPS ne sont pas proposés par ce MVP.

Le compte vérifié Premium crée une cible. La réponse privée donne une seule
fois le contenu `argos-ci-v1=<256 bits aléatoires>` à publier à
`/.well-known/argos-ci/<identifiant public de cible>.txt`. Une seule fin de ligne
LF/CRLF est acceptée. Seule l'empreinte SHA-256 est persistée. La preuve est
liée par la ligne au compte et à l'origine ; une autre cible a un autre
challenge. Aucune preuve ne rattache ou transfère les audits d'un tiers.

Le contenu de preuve est destiné à être public sur le site cible ; ce n'est
jamais une clé API Argos. Il ne faut y mettre ni clé, cookie ni token de rapport.
Le hostname de la cible est immuable. Un changement crée une nouvelle cible,
avec une nouvelle preuve ; les anciennes clés ne s'élargissent pas.

## Vérification et renouvellement

La preuve initiale expire après 24 heures. Le GET de gestion expose uniquement
origine/méthode/état/dates : ni hash ni contenu. Si la réponse de création est
perdue, retrouver la cible dans la liste et renouveler explicitement le
challenge. Une création répétée de la même origine n'invalide pas sa preuve.

Une preuve réussie autorise au plus 7 jours sans nouvelle confirmation. Le
fichier doit rester disponible : le scheduler revérifie après 24 heures, deux
cibles par tick au maximum. Il ne travaille pas lorsque le flag CI est fermé
ni pour un compte sans droit courant. Une perte de contrôle, une réponse
invalide ou une panne ferme immédiatement la preuve : son état lu est EXPIRED
et aucune nouvelle admission n'est autorisée. Pour les cibles déjà vérifiées,
une nouvelle tentative après 5 minutes permet la reprise autonome quand le
fichier redevient valide. Les cibles jamais vérifiées ne sont pas explorées
automatiquement.

Le scheduler peut être arrêté : l'échéance de 7 jours reste bloquante côté
serveur. Une preuve de fichier ne peut détecter un transfert de domaine dont
le nouveau propriétaire continue volontairement à servir le même contenu ;
elle prouve le contrôle observable du fichier, pas une identité de registre.

Renouveler le challenge remet la cible PENDING et invalide toute réponse réseau
antérieure. Révoquer retire le hash, ferme la cible et incrémente son époque
d'autorisation. Les clés liées à l'ancienne époque restent invalides pour
cette cible même après une nouvelle preuve. Ni un réabonnement ni une cible
ajoutée ultérieurement ne réactive ou n'élargit une ancienne autorisation.

## Réseau et transactions

`HttpsTargetProofClient` utilise obligatoirement `AuditEgress`, qui résout et
épingle les connexions selon la politique réseau existante. Aucun repli direct.
GET fixe, TLS normal, zéro cookie/Authorization, zéro redirection suivie,
connexion 3 secondes, délai global 8 secondes incluant le corps, 1 Kio de
réponse maximum et deux vérifications simultanées par processus. Le corps est
borné pendant sa réception ; une réponse lente est annulée. DNS privé,
redirection, contenu HTML, mauvais challenge, taille excessive et panne ne
produisent jamais une preuve réussie. Aucun détail DNS/IP/corps/exception ne
sort dans les réponses ou les logs de cette vérification.

Le compte est verrouillé avant la cible. Un bail persistant de 60 secondes
évite les vérifications concurrentes d'une même preuve. Aucun verrou ou
connexion de compte n'est gardé pendant le réseau. Au retour, le compte,
ses droits et la génération de preuve sont relus avant l'écriture : une
révocation/rotation/downgrade concurrent ne peut être annulé par une réponse
obsolète. La limitation anti-abus est engagée dans une transaction séparée.
Les domaines illimités n'exemptent pas de ces budgets techniques.

## Routes de gestion et intégration aux clés

Ces routes passent par le BFF same-origin et Java. Elles exigent une session
vérifiée ; toute mutation exige CSRF et authentification récente. Création,
renouvellement et vérification exigent également le droit CI courant et le
flag ouvert. La révocation reste disponible après downgrade/fermeture.

| Méthode / chemin après `/api/account/ci` | Résultat |
| --- | --- |
| GET `/targets?after=<curseur>` | Page privée de 100 cibles au plus et nextCursor ; aucune vérification réseau |
| POST `/targets` avec `{ "origin": "https://example.com" }` | Cible et challenge affiché une seule fois |
| POST `/targets/{id}/renew` avec `{}` | Nouveau challenge ; ancien résultat réseau inutilisable |
| POST `/targets/{id}/verify` avec `{}` | Vérification explicite et état observé ; un état PENDING/EXPIRED n'est pas une réussite |
| DELETE `/targets/{id}` | Révocation idempotente |

`CiTargetsService.grants` copie des identifiants/époques d'autorisation précis
à la création des clés #462. `requireGrants` relit ces preuves dans la
transaction d'admission et vérifie l'origine demandée. Les lectures sont
limitées au propriétaire ; absence et hors portée donnent le même 404.

L'admission #463 doit persister dans `ARG_AUDIT_RUN.ci_navigation_origins` la
liste non vide dérivée des autorisations de la clé, jamais une liste fournie
par le client. Le processeur refuse une liste vide/invalide ou une URL initiale
hors portée avant tout module. Le contexte conserve cette portée après HTTP.
Le module HTTP vérifie chaque saut avant contact ; runtime et Lighthouse la
transmettent jusqu'au contexte navigateur. Chaque navigation de frame principale,
y compris les popups, hors origine autorisée est bloquée avant continuation
et annule la collecte. Les ressources publiques tierces et frames enfants
restent soumises aux limites HTTP/egress/SSRF existantes, sans credential Argos.
Au plus 100 origines explicites sont transportées par run, avec enveloppe
headless bornée à 32 Kio ; ce plafond de message ne limite pas les domaines
vérifiables dans le compte.

## Erreurs et validation

Le contrat #741 couvre Java et le BFF, y compris les refus avant entrée dans
la ressource : erreurs de session, CSRF, parsing et permission sont reconstruites
sans corps brut, avec requestId opaque/no-store. REQUEST_REJECTED demande de
recharger le compte ; REAUTHENTICATION_REQUIRED demande une confirmation
d'identité. Le BFF valide les réponses et borne leur lecture. Son catalogue
autonome est copié depuis la source Java par `node scripts/contracts/sync-ci-errors.mjs`
et vérifié par test, pour rester inclus dans le contexte Docker frontend.

Les tests couvrent : suffixes/www/tenants et origines invalides, preuve exacte,
absence de redirect/credentials/repli direct, taille/deadline, redirections
principales bloquées et ressources tierces conservées, erreurs BFF filtrées,
mappings V41, preuve étrangère, expiration, perte/reprise du contrôle et
renouvellement pendant le réseau. Les fixtures MariaDB sont dans le job CI.
La recette complète avec admission/key/client et les scénarios de menace
restent dans #463/#737/#467 avant ouverture ; aucun résultat de production ou
test de charge n'est revendiqué ici.
