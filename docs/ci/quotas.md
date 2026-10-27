# Quotas et protections CI — #735

Le lot prolonge #747 sans ouvrir l’accès : **premium-ci.enabled=false** reste
la valeur livrée jusqu’à #467. Les primitives sont appelées par l’admission
#463 ; ce lot n’ajoute pas d’endpoint d’audit. Pas de fusion ou déploiement.

## Consommation unique et identité stable

V43 ajoute l’intégration, l’empreinte d’origine et l’intention/échantillon à
ARG_USAGE_RUN. Aucun second registre ni compteur mensuel. Sous le verrou du
compte/registre existant, CiQuotaService vérifie 30 analyses publiées du mois
plus toutes les réservations en cours de l’intégration. Une rotation ou un
remplacement garde ce même emplacement. Les crédits ne passent pas d’un
emplacement à l’autre. Le plafond de compte existant, s’il est configuré,
s’applique aussi sans changer les offres des audits navigateur.

Le calendrier est celui de usage.timezone (UTC par défaut). Les réservations
survivent au changement de mois ; publication, même partielle, débite le mois
de publication une seule fois. Échec définitif/annulation sans rapport libère
la réservation. Réponse perdue, reprise worker, lecture ou tickets ne débitent
pas un rapport supplémentaire. La double mesure précontrôle et réserve deux
analyses sur une connexion : avec un crédit restant, aucun enfant n’est créé.

Ordre des verrous : compte, clé/intégration/cibles, sémaphore global, registre.
Les runs nouvellement insérés et leurs réservations partagent cette transaction.
Publication/échec conservent run → sémaphore → registre et n’acquièrent jamais
une clé, intégration ou compte après un run. L’attribution n’ajoute donc pas de
FK qui inverserait cet ordre. Toute panne de stockage refuse l’opération.

## Capacité, coût et équité

La file commune ARG_AUDIT_ADMISSION reste l’autorité des 100 runs non terminés,
qu’ils viennent de la CI, du navigateur ou du parcours anonyme. La CI conserve
des garde-fous techniques supplémentaires : une intention en cours par compte
(un ou deux échantillons), 25 réservations CI globales et quatre par origine,
tous comptes confondus. Une paire doit entrer entièrement dans ces budgets.

Le claim d’un run CI prend run → sémaphore → registre puis pose ci_started_at
sur sa réservation. Un seul run CI du compte peut être RUNNING entre instances.
L’échantillon deux attend que le premier quitte RESERVED. Le reaper retire
uniquement cette occupation à la remise en file, conserve la réservation et
reste protégé par le claim. Le tri équitable existant reste appliqué ; un compte
occupé n’est pas choisi en tête de file au détriment des autres comptes.

Chaque nouvelle admission engage un budget horaire de coût, pondéré par le
nombre d’échantillons : six/intégration, douze/compte, douze/origine et
soixante/global. Une analyse échouée ou annulée ne rembourse pas ce budget.
Les retries worker restent bornés par la politique existante et ne créent pas
de nouvelle admission. Durée, requêtes, octets, sorties et capacité des
collecteurs restent soumis aux protections existantes ; aucun paramètre CI ne
peut les désactiver. Les appels fournisseurs restent ceux de ces collecteurs.

Ces plafonds techniques conservateurs ne sont pas des mesures de capacité de
production. La recette #737/#467 doit mesurer charge, équité, attentes, fournisseurs
et reprise sur l’infrastructure visée avant ouverture. Ne pas présenter un
benchmark ou une capacité commerciale comme déjà validés.

## Trafic, proxys et réponses explicites

Le filtre machine utilise des compteurs persistants ARG_ACCOUNT_RATE partagés
entre instances, distincts des quotas d’analyses. Avant parsing, les appels
authentifiés consomment un budget par minute :

| Trafic | Intégration stable | Compte, toutes clés | Global CI |
| --- | --- | --- | --- |
| Lectures/polling | 90 | 120 | 1 200 |
| Mutations/reprises POST | 6 | 10 | 120 |

Les corps invalides, refus métier et reprises de transport dépensent ce trafic :
son commit précède la transaction métier. Les clés tournantes partagent le même
budget d’intégration. Une admission idempotente retrouvée ne dépense pas à
nouveau le quota mensuel ou horaire d’exécution, mais reste une requête.

L’entrée Java borne aussi le trafic avant auth (6 000/min global, 1 200/min par
pair natif). Le compteur d’authentifications invalides conserve 60 essais/15 min,
mais un caller invalide derrière un proxy partagé ne bloque plus une clé valide
de ce pair. La comparaison et la lecture courante de cette clé restent obligatoires.
Ces limites ne remplacent pas la protection de l’entrée réseau contre une
saturation du stockage lui-même.

Traefik reçoit un routeur CI dédié avant le proxy générique, limité à 120/min
avec burst 20 par pair TCP et un corps de 8 Kio. Le filtre Java impose aussi
8 Kio, y compris sans Content-Length. Aucun header Forwarded/X-Forwarded-For
ou identité forgée ne détermine un propriétaire ou un budget de compte. Derrière
un proxy amont, les pairs sont agrégés : vérifier la topologie et mesurer cette
agrégation avant ouverture ; ne jamais faire confiance à un header arbitraire.
Les plafonds edge sont locaux au proxy ; les plafonds applicatifs restent partagés.

QUOTA_EXCEEDED donne l’échéance mensuelle connue ; RATE_LIMITED donne la fin
de fenêtre ; CAPACITY_UNAVAILABLE propose une attente bornée sans révéler les
chiffres des autres clients. Tous suivent #741 avec no-store/requestId opaque.
Le client ne recommence pas une admission ambiguë avec une nouvelle intention
et ne boucle pas au-delà de son budget de temps. Les erreurs ou logs ne contiennent
ni clé, origine brute, pair brut, corps upstream ou données des autres clients.

## Vérifications

CiQuotaIT sur MariaDB exerce la paire avec un crédit restant, le même registre
après remplacement, la frontière mensuelle/publication unique, les admissions
concurrentes, la cible et la file partagées, le claim séquentiel/requeue, les
rollbacks et budgets horaires/polling. Les tests du filtre vérifient le corps
chunked et le passage du trafic avant parsing. La recette réseau de production
et la matrice API/exports complète restent bloquantes dans #463/#736/#737/#467.
