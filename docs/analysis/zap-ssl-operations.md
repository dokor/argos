# Exploiter ZAP et SSL Labs

## Prérequis

Fournir le secret interne via la configuration montée ou INTERNAL_API_PASSWORD,
selon [la gestion des secrets](../security/secret-remediation.md). Vérifier la
santé Java avant d'interpréter un module absent comme une panne du collecteur.

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

Les scans SSL Labs et Observatory sont désactivés par la politique du Compose actuel.
Avant de diagnostiquer une panne fournisseur ou de modifier un délai, consulter
[les codes de diagnostic et la supervision](security-collector-diagnostics.md).


Le client demande une analyse fraîche avec `startNew=on` sur le premier appel
uniquement. Les sondages suivants omettent ce paramètre pour ne pas relancer
l'analyse en boucle ; aucun appel n'utilise `fromCache`. SSL Labs indique que les
analyses prennent généralement au moins
60s. Les valeurs historiques hors Compose restent `ssl-labs.timeout=90s` et
`audit.timeout=120s`. Le Compose de production fixe désormais 180s pour SSL Labs
et chaque appel distant, dans un budget global de 360s, afin de laisser du temps
aux autres modules séquentiels après une analyse fraîche. Les propriétés JVM
priment sur le `prod.conf` monté ; les variables opérateur et les limites du
contrôle sont décrites dans le [contrat de deadline](deadline.md).
Les sondages sont espacés de 5s en DNS et de 10s
en IN_PROGRESS. Cela peut allonger un audit sans cache ; aucune durée de 20–30s n'est
garantie dans ce cas. Une analyse encore en cours produit un module indisponible,
non scoré, sans pénaliser le site. Les logs indiquent le statut, le nombre de sondages
et le budget restant, et distinguent une analyse en cours d'un HTTP 429, d'une erreur
de transport ou d'un ERROR amont. Les budgets et les protections SSRF restent actifs.

Un résultat SSL Labs READY ultérieur ne modifie pas rétroactivement un rapport déjà
publié ; un nouvel audit demande une nouvelle mesure. SSL Labs peut toutefois
retourner une analyse déjà en cours pour le même hôte, selon son contrat API.
Voir la [politique de fraîcheur](fresh-results.md). Le dossier V1/rollback V7 reste
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
