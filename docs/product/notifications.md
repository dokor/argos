# Notifications privées — #662

Source durable : `ARG_ACCOUNT_NOTIFICATION`, créée par V31. Les triggers de
publication/terminaison insèrent l'événement dans la même transaction que le
résultat métier. Aucun rattrapage historique à la migration. Une clé unique
`run:<id>`, `discovery:<id>` ou `batch:<id>` déduplique les retries ; une relance
volontaire possède un nouvel ID. Le succès d'une URL exige un rapport publié et
un run terminé ; FULL seul reçoit le libellé complet, toute autre couverture
reste partielle. Une découverte tronquée est signalée comme partielle. Les
annulations ne produisent pas de notification dans cette première version.

Les runs d'un lot n'émettent pas de notification individuelle. La transition
terminale du lot, calculée par le reconciler existant, émet son récapitulatif.
Les transitions sont également durables en cas de navigateur fermé ou d'erreur
réseau ; un rollback métier annule son événement.

Le header connecté possède un seul centre et un poll toutes les 15 secondes,
suspendu pour les documents masqués, sans mise à jour de l'activité de session.
Les 30 derniers événements et le compteur total non lu sont lus côté serveur.
Le premier chargement, le retour d'un onglet masqué, les reconnexions et les
rafales restent silencieux. Un événement unique nouveau apparaît en toast ;
une rafale est représentée par le badge. Les lectures sont diffusées entre
onglets par BroadcastChannel et relues au prochain poll sur les autres appareils.
Pas de localStorage. Ouvrir le centre ne modifie jamais l'état de lecture.
« Tout marquer » s'arrête au dernier ID affiché, pour préserver les événements
concurrents. Une lecture répétée est idempotente et les écritures exigent le CSRF.

Les APIs relisent la session et bornent toute opération à son propriétaire.
Les liens locaux vers run, découverte ou lot repassent par les autorisations
habituelles ; aucun token de rapport n'est enregistré dans la notification.
Charge utile limitée au domaine (sans chemin/paramètres), type, compte d'URL,
références et dates. Messages d'échec fixes et traduits, sans erreur technique.
Conservation 90 jours puis purge horaire, indépendante des rapports et de leurs
propres durées. Les sauvegardes restent soumises à la politique de l'opérateur.
