# Runbook — modules d'analyse locaux (Playwright & Lighthouse)

Procédures de diagnostic, de vérification et de redémarrage des services locaux
d'analyse d'Argos (issue #138). Ces services tournent sur le Raspberry, chacun
dans son propre `docker compose` (cf. `infra/compose/<service>/`).

## Services

| Service | Port | Rôle | Image / version critique |
|---|---|---|---|
| `playwright-service` | 3016 | Métriques runtime (console, réseau, timings) via Chromium headless | `mcr.microsoft.com/playwright:v1.58.2-jammy` · `playwright ^1.49` · Node 20 |
| `lighthouse-service` | 3017 | Scores Lighthouse (perf, a11y, best-practices, SEO) via Chrome headless | `node:20-slim` · `lighthouse ^13.0.3` · `chrome-launcher ^1.2.1` |

Réseau interne partagé : `argos_internal` (externe). `api-backend` les joint via
`PLAYWRIGHT_SERVICE_URL` / `LIGHTHOUSE_SERVICE_URL`.

## Disponibilité & healthchecks

Chaque service expose `GET /health` (léger, ne lance pas de navigateur) :

```bash
docker exec playwright-service node -e "fetch('http://127.0.0.1:3016/health').then(r=>r.json()).then(console.log)"
# → { status: 'ok', service: 'playwright-service' }
```

Un `healthcheck` Docker interroge `/health` toutes les 30 s (`start_period` 40 s
pour laisser le temps au navigateur de s'initialiser). État visible via :

```bash
docker ps                       # colonne STATUS : healthy / unhealthy
docker inspect --format '{{.State.Health.Status}}' playwright-service
```

`restart: unless-stopped` relance le conteneur s'il **sort** (crash). Docker ne
redémarre pas automatiquement un conteneur seulement *unhealthy* (pas d'orchestrateur) :
le healthcheck sert au diagnostic et à la vérification amont.

## Mode dégradé (côté api-backend)

Les clients Java (`PlaywrightRuntimeClient`, `LighthouseClient`) sont résilients
par conception :
- `connectTimeout` 5 s + `requestTimeout` configurable (`*_TIMEOUT_SECONDS`).
- Si le service est indisponible ou dépasse le timeout, le module correspondant
  **échoue en douceur** (`*.collect` en WARN, non scoré) sans casser l'audit :
  le rapport est produit avec les autres modules. Voir la stabilisation du score
  en mode dégradé (issue #101).

Un service down ne bloque donc pas la plateforme, mais dégrade la complétude du
rapport → à surveiller via les logs.

## Diagnostic d'un échec

```bash
# 1. État & santé
docker ps --filter name=playwright-service --filter name=lighthouse-service

# 2. Logs récents (erreurs, timeouts, OOM)
docker logs --tail=200 -f playwright-service
docker logs --tail=200 -f lighthouse-service

# 3. Ressources (le Raspberry est contraint : surveiller RAM / OOM-kill)
docker stats --no-stream
dmesg | grep -i "killed process"   # traces d'OOM-killer

# 4. Test de bout en bout du service
docker exec api-backend sh -c 'wget -qO- --post-data="{\"url\":\"https://example.com\"}" \
  --header="Content-Type: application/json" http://lighthouse-service:3017/analyze | head -c 200'
```

Signaux d'alerte côté `api-backend` : événements `runtime.collect` / `lighthouse.collect`
en WARN répétés = service injoignable ou trop lent.

## Redémarrage

```bash
cd /srv/... (dossier compose du service)
docker compose -f docker-compose.prod.yml restart          # redémarrage simple
docker compose -f docker-compose.prod.yml up -d --build     # après mise à jour du code
```

Après un **reboot du Raspberry**, `restart: unless-stopped` relance
automatiquement les conteneurs. Vérifier ensuite `docker ps` (STATUS = healthy).

## Ressources (recommandations)

Le Raspberry est contraint en RAM ; Chromium/Chrome sont gourmands. En cas
d'OOM-kill récurrents, plafonner **prudemment** (des limites trop basses tuent
les analyses en cours) dans le compose du service, par ex. :

```yaml
    mem_limit: 1500m
    cpus: 1.5
```

Ne pas imposer de limites sans les valider sur le matériel réel (risque d'OOM
pendant une analyse). À ajuster selon les specs du Pi et `docker stats`.

## Versions critiques (reproductibilité)

- Playwright : image `mcr.microsoft.com/playwright:v1.58.2-jammy` (Chromium fourni par l'image ; ne pas mélanger avec un `playwright` npm de version incompatible).
- Lighthouse : `lighthouse ^13.0.3` + `chrome-launcher ^1.2.1` sur `node:20-slim`.
- Toute montée de version navigateur/Playwright/Lighthouse doit être testée sur le Pi (compatibilité + ressources) avant déploiement.
