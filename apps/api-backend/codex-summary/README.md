# Argos Codex summary service

Service interne utilisé uniquement pour générer la synthèse exécutive des rapports Argos.

Il hérite du runtime Codex commun :

```text
ghcr.io/dokor/codex-runtime:0.156.1-r1
```

Le service n'expose aucun port hôte. Il est joignable uniquement par `api-backend` sur le réseau Docker privé `argos_ai`.

## Authentification

Le compte Codex est stocké dans le volume `argos_codex_home`.

Après le premier déploiement :

```bash
cd /srv/apps/api-backend
docker compose -f docker-compose.prod.yml run --rm --entrypoint codex codex-summary login
docker compose -f docker-compose.prod.yml run --rm --entrypoint codex codex-summary login status
docker compose -f docker-compose.prod.yml up -d
```

## Sécurité

- workspace vide ;
- sandbox Codex en lecture seule ;
- exécutions éphémères ;
- concurrence limitée à 1 ;
- aucun accès aux sources Argos ni au Docker socket ;
- aucun port publié.
