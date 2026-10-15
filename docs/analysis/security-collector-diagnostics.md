# Diagnostiquer SSL Labs et Observatory (#583)

> Évolution : voir la [réactivation encadrée](remote-collectors-reactivation.md). Les constats de désactivation ci-dessous décrivent la configuration de production observée ; la PR #640 active les collecteurs par défaut dans le Compose après acceptation explicite de la frontière fournisseur. Un override `ARGOS_EXTERNAL_SCANS_ENABLED=false` reste disponible ; aucun déploiement effectué.

## Cause établie dans la configuration livrée

Le Compose backend impose `ARGOS_EXTERNAL_SCANS_ENABLED=false`. `RemoteScanPolicy` refuse donc les deux scans avant tout appel réseau : ces services résolvent et visitent la cible depuis leur propre infrastructure, sans la garantie de connexion épinglée du proxy Argos. Une exécution avec cette configuration doit donner `POLICY_DISABLED` pour les deux modules. La correction conserve cette protection et explique désormais cette indisponibilité au lieu de réduire toutes les causes à `ModuleUnavailableException`.

Ce constat porte sur le code et le Compose versionnés. Aucun accès SSH, lecture du fichier sensible `prod.conf` ni inspection du processus de production n’a été effectué. Confirmer l’environnement réel avec l’endpoint interne authentifié après un déploiement autorisé ; aucune activation des scans n’est nécessaire pour obtenir cet état.

## Supervision et alerte

`GET /api/monitoring/collectors` exige la même authentification interne que les autres endpoints de monitoring. Il expose pour `ssl` et `observatory` : activation, endpoint configuré sans cible, état, dernier code d’échec, compteurs de succès/échecs et date de dernière observation. Avant toute analyse, un service désactivé expose déjà `DISABLED / POLICY_DISABLED`. Les compteurs sont locaux au processus et repartent à zéro au redémarrage ; ils ne constituent pas un historique de disponibilité. Ne pas publier ce résultat sur un endpoint public.

Les logs `module_failed` contiennent `module`, `status`, `failureCode`, `durationMs` et la corrélation du run. Aucun message ou corps fournisseur n’est enregistré dans ces champs. Pour chaque contrôle attendu manquant, la couverture garde `UNAVAILABLE` et expose le même `measurementReason`. Un résultat absent reste inconnu et ne devient ni réussite ni défaut de la cible.

| Code | Qualification et action |
| --- | --- |
| `POLICY_DISABLED` | Configuration/politique Argos ; les scans ne sont pas tentés. Afficher une alerte de couverture limitée, pas une panne fournisseur. Faire examiner la politique de sortie avant toute activation. |
| `PROVIDER_RATE_LIMITED` | HTTP 429 ; réduire les sollicitations et attendre le rétablissement du quota, sans forcer de nouveau scan. |
| `PROVIDER_AUTH_REQUIRED` | HTTP 401/403 ; vérifier version d’API, enregistrement et configuration fournisseur. Le 403 peut aussi provenir d’une politique fournisseur ; ne pas conclure sur la cible. |
| `INTEGRATION_ENDPOINT` | HTTP 404/410/redirection ; vérifier l’endpoint configuré, sans suivre automatiquement les redirections. |
| `PROVIDER_UNAVAILABLE` | Autre erreur HTTP fournisseur ; vérifier sa disponibilité et ses codes avant de réessayer. |
| `NETWORK_DNS`, `NETWORK_CONNECT`, `NETWORK_TLS` | Panne de résolution, connexion ou confiance TLS entre Java et le fournisseur ; vérifier depuis l’hôte backend. Ne pas désactiver la validation TLS. |
| `DEADLINE_EXCEEDED` | Budget HTTP/audit écoulé ; SSL Labs peut rester en DNS/IN_PROGRESS. Le budget SSL de 90 s est plafonné par le budget global ; ne pas augmenter sans examiner les temps. |
| `TARGET_ASSESSMENT_FAILED` | SSL Labs `ERROR` ou HTTP 422 Observatory : le fournisseur ne peut évaluer cette cible. Ce code seul ne prouve pas une faiblesse TLS. |
| `INVALID_RESPONSE` | Réponse vide/inexploitable ou JSON invalide ; vérifier contrat et disponibilité, sans exposer le corps. |
| `INCOMPLETE_MEASUREMENTS` | Collecte partielle, vérifier les contrôles/points de terminaison manquants. |
| `INTEGRATION_FAILURE` | Cause hors vocabulaire ; examiner les logs corrélés, sans publier d’exception brute. |

Une supervision peut déclencher une alerte si un service requis est désactivé, si la dernière collecte est indisponible, ou si le compteur d’échecs augmente. Le code indique l’équipe et l’action utiles. Vérifier ensuite un retour à `COMPLETED` et conserver la couverture partielle tant que les contrôles attendus restent absents.

## Endpoints et vérifications réellement effectuées

Sondes GET depuis l’environnement de développement le 15 octobre 2026, sans création de scan : SSL Labs `https://api.ssllabs.com/api/v3/info` → 200 (~1 s), racine Observatory → 200 (~0,34 s), ancien `/api/v2/tests?scan=0` → 404 (~0,23 s), page Argos `/demo/atelier/avant.html` → 200 (~0,25 s). Ces sondes ne prouvent ni la connectivité depuis le serveur de production ni la disponibilité d’une évaluation de cible ou d’un quota de scan.

Le client Observatory utilise déjà le bon `/api/v2/scan`. MDN v2 a retiré `rescan` et les requêtes annexes de l’ancienne API : la correction retire ce paramètre et l’appel réseau `/tests`, sans inventer de détails. SSL Labs conserve v3 (son `/info` répond), `fromCache=on`, les délais bornés et aucun `startNew`. Les logs de progression utilisent maintenant des valeurs de statut autorisées, au lieu de les passer dans un assainisseur d’URL.

## Rejeu et limites

Le test de pipeline `disabledSecurityCollectorsExplainEveryMissingControlAndOtherModulesContinue` rejoue un audit de démonstration contrôlé : les deux scanners refusés produisent des contrôles non scorables, chaque contrôle attendu SSL/Observatory porte `UNAVAILABLE / POLICY_DISABLED`, et les six autres collecteurs terminent. La suite Java couvre aussi cache SSL READY, sondages multiples, timeout, quota 429, erreur de cible, réponses invalides, protection d’authentification du monitoring et rétablissement de son état.

Aucune nouvelle analyse payante/consommatrice de quota ni modification de production n’a été effectuée. Pour confirmer le diagnostic réel, après déploiement autorisé, consulter `/api/monitoring/collectors`, relancer une seule page de démonstration via le parcours normal et conserver la liste de ses raisons de couverture. Le présent changement ne rend pas disponibles des mesures volontairement interdites.

Références primaires : [API MDN Observatory v2](https://github.com/mdn/mdn-http-observatory#json-api), [FAQ MDN](https://developer.mozilla.org/en-US/observatory/docs/faq), [SSL Labs v3](https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md). Exploitation SSL/ZAP : [runbook](zap-ssl-operations.md).

## Vérification de production du 15 octobre 2026 (#635)

Constats obtenus via les commandes exécutées par l'exploitant, sans accès direct de l'agent au serveur :

- Révision du conteneur backend : `4ff3660e381be01c29c8e02fba3be4552e7ba45d` (label OCI).
- Environnement effectif : `ARGOS_EXTERNAL_SCANS_ENABLED=false`, `ZAP_API_URL=http://zap:8080`.
- ZAP `2.17.0`, extension `exim 0.21.0`, conteneur healthy, zéro redémarrage et `OOMKilled=false`.
- Run `6170463576008949821` : SSL et Observatory `UNAVAILABLE / POLICY_DISABLED`. Il s'agit du refus intentionnel des scans distants, pas d'une panne TLS ou fournisseur. Ne pas activer ces scans pour faire disparaître l'état de couverture limitée.
- ZAP : `INTEGRATION_FAILURE` après 475 ms. La session conservée contient deux messages pour la cible : la réponse importée `HTTP/1.1 200` (type 15) et un message technique `HTTP/1.0 0` (type 0). La file passive est vide. Le client exigeait à tort `numberOfMessages == 1` : ce compteur porte sur l'historique, pas uniquement sur les entrées HAR.

Le correctif accepte un historique cible non vide après l'import réussi dans une session neuve. Il conserve le HAR d'une seule entrée, `sendRequests=false`, le verrou de session, l'attente bornée du scanner passif et le refus d'un import vide ou d'une réponse invalide. Les options `sendRequests` et `maxMessages` ne sont pas exposées par exim 0.21.0 ; cette version importe passivement. Les conserver rend explicite le comportement attendu avec exim 0.22.0, qui les accepte.

Les échecs de contrat ZAP produisent désormais `zap_operation_failed operation=… failureCode=…`, avec une opération constante et un code borné. Aucun corps HAR, message fournisseur, détail d'exception ou secret n'est ajouté aux logs. Un module absent ou un paramètre refusé devient `INTEGRATION_ENDPOINT`, une clé refusée `PROVIDER_AUTH_REQUIRED`, un import vide `INCOMPLETE_MEASUREMENTS`, et une réponse mal formée `INVALID_RESPONSE`.

Sources du contrat vérifié : [CoreAPI ZAP 2.17.0](https://github.com/zaproxy/zaproxy/blob/v2.17.0/zap/src/main/java/org/zaproxy/zap/extension/api/CoreAPI.java), [importeur exim 0.21.0](https://github.com/zaproxy/zap-extensions/blob/exim-v0.21.0/addOns/exim/src/main/java/org/zaproxy/addon/exim/ImportExportApi.java).

### Validation après déploiement autorisé

La correction n'a pas encore été déployée ni validée sur un nouveau run de production. Après livraison, l'exploitant relance une seule analyse de démonstration et conserve son identifiant, la révision OCI et les logs : ZAP doit terminer `COMPLETED`, SSL/Observatory restent `UNAVAILABLE / POLICY_DISABLED`, et la couverture doit toujours refléter ces mesures absentes. Si ZAP échoue encore, relever `zap_operation_failed` et `module_failed` pour le même run. Ne clôturer #635 qu'après ce rejeu.

## Restitution dans la console (recette #635)

Le détail administrateur charge le rapport disponible pour afficher les codes de cause enregistrés par module. Le dashboard traduit les mêmes codes dans « Détails de la mesure ». Les motifs sont issus du rapport historique ; ils ne décrivent pas la configuration actuelle. Un code inconnu ou absent reste indéterminé, une erreur de lecture du rapport est signalée séparément, et aucun message fournisseur brut n'est affiché.

Le Compose versionné contient `ARGOS_EXTERNAL_SCANS_ENABLED=false`. Cela explique le chemin `POLICY_DISABLED` dans le code, mais ne prouve pas la configuration du conteneur déployé ni la cause d'une ancienne analyse. Avant de clôturer #635 côté exploitation, corréler le run signalé aux diagnostics internes ci-dessus et relever la révision et la configuration effectives. Cette correction d'affichage n'active aucun scan externe et ne démontre pas leur rétablissement en production.
