# ZAP / SSL Labs — correction de déploiement du 6 octobre 2026

## Incident et diagnostic

Le backend ne démarrait pas sans `internal-api.auth-password` depuis la suppression
du secret par défaut. Fournir un secret externe dans `/srv/configs/api-backend/prod.conf`
ou `INTERNAL_API_PASSWORD` dans le conteneur reste obligatoire. Ne pas remettre un
secret par défaut dans Git. Les déploiements précédents ne vérifiaient pas la santé Java.

Après correction du secret, le run fourni a terminé en 45,6s avec 75% de complétude.
SSL Labs n'avait pas de résultat après cinq sondages (15,35s), sans HTTP 429.
ZAP était absent et le client utilisait localhost dans le conteneur Java.

## ZAP

Le Compose backend crée désormais `argos-zap`, image officielle ZAP 2.17.0
(manifestes amd64 et arm64 vérifiés), et transmet `ZAP_API_URL=http://zap:8080`.
Le réseau `argos_zap` est interne et ne relie que Java et son daemon dédié : aucun
port hôte, accès Traefik ou sortie Internet. La clé API est désactivée uniquement
dans cette isolation. Si un daemon externe est choisi, configurer `ZAP_API_KEY`
et restreindre son accès. Ne pas publier le port 8080.

Chaque audit importe une unique réponse HTTP déjà collectée par Argos, au format HAR,
avec `sendRequests=false`, puis attend la fin de la file passive avant de lire les
alertes. Aucun spider/scan actif ni nouvel accès au site n'est lancé. La session est
renouvelée à chaque audit ; le daemon ne doit pas être partagé entre instances backend.
Les données restent éphémères et sont bornées à la taille de la page (5 MiB).
Il s'agit d'une analyse de cette réponse, pas d'une exploration complète du site.

Le heap ZAP est plafonné à 512 MiB ; relever RAM/OOM et latence sur le Raspberry
après déploiement. Le test CI démarre l'image réelle et vérifie une alerte sur un HAR
synthétique puis sa disparition au second audit de la même URL corrigée.

## SSL Labs

L'API `analyze?fromCache=on` rend un résultat en cache, ou peut démarrer une analyse
si le cache manque. SSL Labs indique que les analyses prennent généralement au moins
60s. Le client attend maintenant jusqu'à `ssl-labs.timeout=90s`, toujours limité par
`audit.timeout` (120s par défaut). Les sondages sont espacés de 5s en DNS et de 10s
en IN_PROGRESS. Cela peut allonger un audit sans cache ; aucune durée de 20–30s n'est
garantie dans ce cas. Une analyse encore en cours produit un module indisponible,
non scoré, sans pénaliser le site. Les logs indiquent le statut, le nombre de sondages
et le budget restant, et distinguent une analyse en cours d'un HTTP 429, d'une erreur
de transport ou d'un ERROR amont. Aucun `startNew` n'est forcé.

Un résultat SSL Labs READY ultérieur ne modifie pas rétroactivement un rapport déjà
publié ; un nouvel audit peut bénéficier du cache. Le dossier V1/rollback V7 reste
applicable : ne pas remettre un ancien binaire incompatible avec le schéma migré.

Références : [API SSL Labs v3](https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md),
[import HAR ZAP](https://www.zaproxy.org/docs/desktop/addons/import-export/),
[scanner passif ZAP](https://www.zaproxy.org/docs/api/).

## Déploiement et contrôle Raspberry

Le workflow backend synchronise ce Compose et déploie Java/ZAP ensemble. Après fusion,
aucune installation manuelle de ZAP n'est nécessaire. Pour un déploiement manuel,
utiliser le Compose mis à jour dans `/srv/apps/api-backend` :

```sh
docker compose -f /srv/apps/api-backend/docker-compose.prod.yml up -d --build
docker ps --filter name=api-backend --filter name=argos-zap
docker logs --since 5m api-backend
docker stats --no-stream api-backend argos-zap
```

Attendre `Server started` côté Java et l'état healthy côté ZAP. Vérifier sur un audit
autorisé les logs `ssl_labs_progress` et le statut final de chaque module.
Le fonctionnement ARM64 et les ressources réelles restent à mesurer sur le Pi.
