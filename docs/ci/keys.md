# Clés API CI Premium — #462

Ce lot suit #734 et les socles #732/#741. Il livre la gestion des credentials,
l'authentification machine et une lecture d'identité minimale. L'admission
d'audit, ses quotas CI et ses résultats privés restent dans #463/#735/#736.
**`premium-ci.enabled=false` est conservé jusqu'à la recette complète #467.**
Il n'y a ni fusion ni déploiement dans ce lot.

## Format, stockage et périmètre

La clé est `argos_ci_<identifiant public de 32 caractères hexadécimaux>.<secret>`.
Le secret contient 256 bits CSPRNG, base64url sans padding. L'identifiant public
est indépendant du secret. Seule l'empreinte SHA-256 du credential entier est
persistée, avec comparaison en temps constant ; aucun credential en clair
n'entre dans une table, requête SQL de recherche, événement ou log. La valeur
complète est montrée une seule fois après création/rotation, via une réponse
privée no-store. Les objets de remise du secret ont un toString expurgé.

Les seules permissions sont `audits:write`, `results:read`, `usage:read`.
Ni administration, facturation, gestion de clés, changement d'offre ni nouvelle
preuve de domaine ne sont accessibles avec une clé machine. Le propriétaire
vient de la session/du credential côté Java, jamais d'un corps de requête.

Chaque credential copie ses cibles exactes vérifiées et leurs époques
d'autorisation ; il ne suit pas les ajouts futurs au compte. Une preuve
révoquée puis recréée ne réautorise pas l'ancienne portée. Une rotation recopie
la même portée, après contrôle des preuves courantes, sans élargissement.

## Trois emplacements stables, rotation et expiration

Le compte Premium dispose de trois emplacements d'intégration. Leur identité
publique/slot est conservée en base, y compris après expiration ou révocation.
Créer de nouveaux secrets ne crée donc pas de nouveaux budgets mensuels.
Le lot #735 utilisera cette identité avec le registre existant pour appliquer
les **30 analyses/mois par emplacement** ; ce plafond n'est pas encore ouvert
ou appliqué par un endpoint d'audit client dans ce lot.

La première création sans integrationId occupe un emplacement libre. Si les
trois sont déjà attribués, réutiliser explicitement l'identité d'un emplacement
dont tous les credentials sont inactifs. Il conserve ses débits/réservations
futurs. Aucun ancien credential n'est réactivé ; un nouveau secret aléatoire
et une portée explicitement choisie sont créés.

L'expiration est obligatoire, au plus un an calendaire UTC après création.
Une échéance plus courte peut être fournie. L'échéance est exclusive. Une
rotation crée un nouveau credential pour la même intégration et autorise
l'ancien pendant au plus **15 minutes**, sans dépasser son expiration initiale.
Il ne peut exister qu'un secret principal et un secret de transition actifs
par emplacement. Une nouvelle rotation du principal révoque la transition
précédente ; une rotation concurrente de l'ancien principal est refusée.

La révocation porte sur le credential désigné et est idempotente. Pour arrêter
toute une intégration pendant un chevauchement, révoquer ses deux credentials
actifs ; le statut de chacun est disponible dans la liste privée. Aucun cache
d'authentification n'est utilisé : chaque requête relit la base et les limites
de temps courantes sur toutes les instances. Un réabonnement ne modifie ni
revoked_at ni expires_at. Un compte PENDING/SUSPENDED/ARCHIVED ne peut pas
utiliser de credential.

## Gestion depuis le compte

Les chemins sont préfixés par `/api/account/ci`. Le navigateur utilise son
cookie de session via le BFF same-origin ; Java exige la session vérifiée.
Chaque mutation exige CSRF et authentification récente. Création et rotation
exigent en plus le droit Premium/ci_access courant et le flag CI ouvert.
Révocation et lecture restent disponibles après downgrade/fermeture.

| Méthode / chemin | Comportement |
| --- | --- |
| GET `/keys?after=<curseur>` | Cinq credentials par page, métadonnées des intégrations et nextCursor ; aucun secret/hash |
| POST `/keys` | Créer avec name, scopes, targetIds ; integrationId et expiresAt optionnels ; réponse key + credential unique |
| POST `/keys/{identifiant public}/rotate` avec `{}` | Rotation atomique à portée et intégration conservées |
| DELETE `/keys/{identifiant public}` | Révoquer le credential, y compris pendant une transition |

Les noms sont bornés à 80 caractères sans caractères de contrôle ; trois
scopes connus au plus et cent cibles explicites au plus. Les tableaux, états,
dates et réponses sont validés par le BFF, dont les lectures sont bornées.
Le secret ne peut apparaître que dans une réponse de création/rotation
cohérente avec son identifiant public, jamais dans une liste. Les headers de
mesure produit/captcha sont retirés de ce proxy de gestion ; aucun événement
d'analytics ne reçoit une clé. Le journal de sécurité réutilise les événements
compte privés, actions fixes CI_KEY_CREATED/ROTATED/REVOKED sans secret ni nom.

Une réponse perdue ne permet pas de relire un secret. Consulter la liste avec
sa session ; révoquer le credential nouvellement créé dont le secret est perdu.
Pour une rotation ambiguë, révoquer les deux credentials encore actifs, puis
réémettre sur la même integrationId. Ne pas répéter aveuglément une création
ou recréer une intégration pour obtenir un nouveau quota. Cette reprise ne
réalise aucun audit et ne débite aucune analyse.

## Authentification machine obligatoire

Toutes les routes sous `/api/ci/`, connues ou inconnues, sont protégées avant
le matching Jersey par `CiKeyFilter`. Seul
`Authorization: Bearer argos_ci_<id>.<secret>` est accepté. Ni session web,
cookie, token de rapport, secret administrateur, query ni credential Git ne
le remplace. Un refus ne se replie jamais sur l'audit public.

`GET /api/ci/v1/identity` donne la version, l'identité stable de l'intégration,
l'identifiant public du credential, ses scopes et origines déclarées. Il ne
réserve aucune analyse. Il ne prouve ni le droit de nouvelle admission, ni la
validité actuelle d'une preuve, ni la capacité disponible. Le doctor #465
devra utiliser les lectures autorisées de #463, sans inférer ces états.

Clé absente/inconnue/malformée/expirée/révoquée ou compte inaccessible : même
401 AUTHENTICATION_FAILED, message/action uniformes, requestId opaque neuf et
no-store. Les essais invalides ont un compteur persistant par pair réseau
natif, 60 par fenêtre de 15 minutes, partagé entre instances. Les en-têtes
Forwarded/X-Forwarded-For/X-Real-IP ne changent pas ce pair. Les valeurs brutes
de pair et les credentials ne sont pas stockés dans ce compteur. Les échecs
sont engagés après la transaction rejetée ; un rollback ne les efface pas.
Depuis #735, ce compteur d’erreurs ne bloque pas une clé valide d’un pair
partagé : des budgets d’entrée et de trafic authentifié bornent séparément
les requêtes. Voir [quotas et anti-abus](quotas.md).

Un proxy qui agrège les connexions agrège aussi ce budget : la recette de
routage/capacité #735/#737 doit vérifier cet effet et les protections d'entrée
avant ouverture, sans faire confiance à un header client arbitraire. Ce
limiteur d'essais ne remplace pas les budgets de trafic/admission du lot #735.

Les handlers mutateurs #463 doivent rappeler `withCredential` avec le scope
requis puis relire droit et preuves sur la **même connexion d'admission**.
Le contexte issu du filtre seul n'autorise pas une mutation différée : une
révocation peut survenir après ce filtre. Une lecture de résultats existants
reste possible après downgrade avec une clé valide et le scope/propriétaire
appropriés ; un nouveau lancement reste refusé. Une déconnexion navigateur
n'est pas une révocation de clé machine.

## Vérification et protections de livraison

V42 ajoute les intégrations/credentials et leurs mappings QueryDSL, sans
attribuer de clé ou de droit à un compte existant. Les secrets ne sont jamais
récupérables en clair depuis la base. Le scanner Gitleaks détecte le format
Argos CI, avec une sonde synthétique négative séparée dans le workflow Secrets.

Tests unitaires du format, de l'entropie et de la séparation des credentials ;
tests BFF de la remise unique du credential, des listes privées, des permissions et
réponse de rotation incohérente ; fixtures MariaDB/HTTP de trois créations
concurrentes, remplacement stable, rotations concurrentes, expiration,
révocation multi-instance, compte inactif, portée étrangère, downgrade,
budget invalid-auth et flag fermé. Les erreurs internes ne journalisent qu'un
événement contrôlé et le requestId, sans corps/clé/exception brute.

Les interfaces validées restent dans #464, le client dans #465 et la recette
intercomptes/réseau/publisher complète dans #737/#467. Aucun abonnement réel,
test de charge ou appel d'audit CI client en production n'est revendiqué.
