# Validation de la chaîne d’audit sur Raspberry — #488

Cette procédure complète la [revue de sécurité](audit-chain-488.md) et les tests
de la [PR #505](https://github.com/dokor/argos/pull/505). Elle prépare la recette ;
elle ne constitue pas une preuve d’exécution. #488 reste ouverte tant que le
compte rendu en fin de document n’est pas rempli et revu.

Exécuter dans Bash sur le Raspberry Linux ARM64, avec accès Docker autorisé.
La première partie crée uniquement des conteneurs de fixture sans ports publiés.
La seconde observe le déploiement existant et lance un audit d’une page appartenant
à l’exploitant. Aucun déploiement, migration, modification du pare-feu hôte ou test
de saturation de production n’est requis par ces commandes. Si une correction est
nécessaire, arrêter la recette et passer par une PR et un déploiement autorisé.

## 1. Figer la révision et le dossier de preuves

Préparer un checkout dédié, propre, contenant #505 et cette procédure. Choisir un
SHA complet effectivement testé en CI ; ne pas utiliser un `main` mouvant. Les
images déployées peuvent avoir des SHA différents parce que les workflows sont
déclenchés par chemins : consigner chaque SHA et vérifier que chacun contient le
correctif #505. Une CI du 12 octobre ne valide pas automatiquement une révision
ultérieure. Les checks filtrés par chemins doivent avoir une preuve applicable
aux sources retenues ; un check ignoré ne prouve pas que son test a été exécuté.

```bash
set -euo pipefail
umask 077
export CANDIDATE_SHA="$(git rev-parse HEAD)"
test -z "$(git status --porcelain)"
git merge-base --is-ancestor 071212c4fb5da24ed3d4059080dc9435230f91d7 "$CANDIDATE_SHA"
export EVIDENCE="$(mktemp -d /var/tmp/argos-488.XXXXXXXX)"
printf '%s\n' "$CANDIDATE_SHA" > "$EVIDENCE/candidate-sha.txt"
date -u +%FT%TZ > "$EVIDENCE/started-at.txt"
uname -srmo > "$EVIDENCE/kernel.txt"
test "$(uname -m)" = aarch64
test "$(docker info --format '{{.Architecture}}')" = aarch64
test -z "${DOCKER_DEFAULT_PLATFORM:-}"
docker version --format '{{.Server.Version}}' > "$EVIDENCE/docker-version.txt"
docker compose version --short > "$EVIDENCE/compose-version.txt"
docker info --format '{{json .SecurityOptions}}' > "$EVIDENCE/docker-security.txt"
free -m > "$EVIDENCE/memory-before.txt"
df -h /var/lib/docker /var/tmp > "$EVIDENCE/disk-before.txt"
```

Node doit être disponible pour les commandes d’observation ; utiliser la version
du workflow CI sélectionné. Docker doit disposer de seccomp, des user namespaces
nécessaires à Chromium et d’iptables/ip6tables dans les images passerelles. Un
échec du sandbox ou du pare-feu est un **NO-GO** ; ne pas contourner par
`--no-sandbox`, `seccomp=unconfined`, `privileged` ou `SYS_ADMIN`.

Prévoir une fenêtre calme : la fixture lance deux navigateurs avec jusqu’à 1 GiB
chacun, en plus des services existants, et les builds consomment RAM/disque. Garder
une marge mesurée ; différer si l’hôte est déjà sous pression. Ne pas arrêter les
services réels pour faire passer un test. Ne pas utiliser `set -x`, exporter les
environnements complets ni publier `docker inspect` brut ou la configuration montée.

## 2. Vérifier l’isolation ARM64 sur les fixtures existantes

Le script utilise des noms fixes et les supprime en sortie. Refuser les collisions
avant de l’appeler, y compris une exécution simultanée du workflow sécurité sur un
runner installé sur ce Raspberry. Le bridge `8.8.8.0/24` doit être libre. Dans ce
test, `8.8.8.8` est exclusivement une fixture sur un réseau Docker `--internal` ;
ne jamais envoyer ces requêtes depuis le navigateur hôte ou les services de prod.

```bash
for name in argos-security-runtime argos-security-lighthouse argos-security-gateway \
            argos-security-public argos-security-private; do
  if docker container inspect "$name" >/dev/null 2>&1; then
    printf 'Collision conteneur : %s\n' "$name" >&2; exit 1
  fi
done
for name in argos-security-public argos-security-private; do
  if docker network inspect "$name" >/dev/null 2>&1; then
    printf 'Collision réseau : %s\n' "$name" >&2; exit 1
  fi
done
docker network ls --format '{{.Name}}' | while read -r name; do
  docker network inspect "$name" --format '{{range .IPAM.Config}}{{.Subnet}} {{end}}'
done > "$EVIDENCE/network-subnets.txt"
# Examiner network-subnets.txt et `ip route` : aucun chevauchement avec 8.8.8.0/24.
ip route > "$EVIDENCE/routes.txt"
node --test apps/audit-egress/proxy.test.mjs > "$EVIDENCE/proxy-tests.log" 2>&1
bash scripts/security/docker-smoke.sh > "$EVIDENCE/docker-smoke.log" 2>&1
printf 'PASS\n' > "$EVIDENCE/docker-smoke.status"
for image in argos-security-egress argos-security-runtime argos-security-lighthouse; do
  docker image inspect "$image" \
    --format '{{.Id}} {{.Architecture}} {{.Os}}' >> "$EVIDENCE/fixture-images.txt"
  test "$(docker image inspect "$image" --format '{{.Architecture}}')" = arm64
done
```

Attendus : code de sortie 0, lancement de Chromium avec sandbox, sortie directe
refusée, analyse de la page autorisée, redirection privée refusée, compteur de la
fixture privée égal à zéro après frames/fetch/worker/WebSocket, marqueur
`synthetic-secret` absent des résultats runtime/Lighthouse et des logs runtime.
Le script ne valide pas à lui seul les logs Lighthouse, le nettoyage après
déconnexion, les conteneurs déployés ni le BFF : poursuivre les étapes suivantes.
Le test proxy couvre aussi les réponses DNS mixtes/changeantes et l’adresse IP
réellement passée au transport. Conserver la sortie, pas seulement « tests verts ».

## 3. Timeouts, déconnexion et reprise sur conteneurs isolés

Faire cette étape après le smoke réussi, dans le **même Bash**, depuis la racine
du checkout. Elle réutilise ses images ARM64, monte une fixture lente et n’altère
aucun service déployé. Les noms/réseaux de l’étape 2 doivent être absents.
La fonction de nettoyage ne vise que les noms réservés à cette recette. Le timeout
global arrête la commande de test ; le trap supprime les fixtures même en échec.

```bash
(
  set -euo pipefail
  root="$PWD"
  cleanup() {
    docker rm -f argos-security-runtime argos-security-lighthouse \
      argos-security-gateway argos-security-public >/dev/null 2>&1 || true
    docker network rm argos-security-public >/dev/null 2>&1 || true
  }
  for name in argos-security-runtime argos-security-lighthouse \
              argos-security-gateway argos-security-public; do
    if docker container inspect "$name" >/dev/null 2>&1; then exit 1; fi
  done
  if docker network inspect argos-security-public >/dev/null 2>&1; then exit 1; fi
  trap cleanup EXIT
  cat > "$EVIDENCE/slow-fixture.mjs" <<'JS'
import http from 'node:http';
let slowHits = 0;
http.createServer((req, res) => {
  if (req.url === '/stats') return res.end(JSON.stringify({ slowHits }));
  if (req.url === '/slow') {
    slowHits++;
    const timer = setTimeout(() => res.end('<h1>Late fixture</h1>'), 30000);
    res.on('close', () => clearTimeout(timer));
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><html lang="en"><title>Fixture</title><h1>Recovery</h1></html>');
}).listen(80, '0.0.0.0');
JS
  docker network create --internal --subnet 8.8.8.0/24 argos-security-public >/dev/null
  docker run -d --name argos-security-public --network argos-security-public --ip 8.8.8.8 \
    -v "$EVIDENCE/slow-fixture.mjs:/fixture.mjs:ro" --entrypoint node \
    argos-security-egress /fixture.mjs >/dev/null
  docker run -d --name argos-security-gateway --network argos-security-public \
    --cap-drop ALL --cap-add NET_ADMIN --cap-add SETUID --cap-add SETGID --cap-add SETPCAP \
    --read-only --security-opt no-new-privileges argos-security-egress >/dev/null
  ready() {
    for attempt in $(seq 1 60); do
      if docker exec "$1" node -e "$2" >/dev/null 2>&1; then return 0; fi
      sleep 1
    done
    return 1
  }
  ready argos-security-gateway \
    "const s=require('net').connect(3128,'127.0.0.1',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))"
  for service in runtime lighthouse; do
    port=3016; profile=playwright-service
    if [ "$service" = lighthouse ]; then port=3017; profile=lighthouse-service; fi
    docker run -d --name "argos-security-$service" --network container:argos-security-gateway \
      --user 1001:1001 --cap-drop ALL --read-only --init --security-opt no-new-privileges \
      --security-opt "seccomp=$root/infra/compose/$profile/chromium-seccomp.json" \
      --tmpfs /tmp:size=256m --tmpfs /home/auditor:uid=1001,gid=1001,size=16m \
      --shm-size 128m --memory 1g --cpus 2 --pids-limit 256 \
      -e AUDIT_EGRESS_PROXY=http://127.0.0.1:3128 "argos-security-$service" >/dev/null
    ready "argos-security-$service" \
      "fetch('http://127.0.0.1:$port/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
    timeout 180s docker exec -i -e TEST_SERVICE="$service" "argos-security-$service" \
      node --input-type=module > "$EVIDENCE/lifecycle-$service.log" 2>&1 <<'JS'
import assert from 'node:assert/strict';
import http from 'node:http';
import { readdirSync, readFileSync } from 'node:fs';
const runtime = process.env.TEST_SERVICE === 'runtime';
const base = `http://127.0.0.1:${runtime ? 3016 : 3017}`;
const endpoint = `${base}${runtime ? '/analyze/runtime' : '/analyze'}`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const chromiumCount = () => readdirSync('/proc').filter(id => /^\d+$/.test(id)).filter(id => {
  try {
    const comm = readFileSync(`/proc/${id}/comm`, 'utf8');
    const stat = readFileSync(`/proc/${id}/stat`, 'utf8');
    return /chrome|chromium/i.test(comm) && !stat.slice(stat.lastIndexOf(')') + 2).startsWith('Z');
  } catch { return false; }
}).length;
const idle = async () => {
  for (let i = 0; i < 100; i++) { if (chromiumCount() === 0) return; await pause(100); }
  assert.equal(chromiumCount(), 0, 'Chrome processes remain after cleanup');
};
const post = (path, timeoutMs) => fetch(endpoint, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: `http://8.8.8.8${path}`, timeoutMs }),
  signal: AbortSignal.timeout(70000),
});
// Read fixture counters using an HTTP absolute-form request to the local proxy.
const proxyHits = () => new Promise((resolve, reject) => {
  const req = http.get({ hostname: '127.0.0.1', port: 3128,
    path: 'http://8.8.8.8/stats', headers: { host: '8.8.8.8' }, timeout: 2000 }, res => {
    let body = ''; res.on('data', chunk => body += chunk);
    res.on('end', () => { try { assert.equal(res.statusCode, 200); resolve(JSON.parse(body).slowHits); } catch (e) { reject(e); } });
  });
  req.on('timeout', () => req.destroy(new Error('Fixture stats timeout')));
  req.on('error', reject);
});
await idle();
const beforeTimeout = await proxyHits();
const started = performance.now();
const expired = await post('/slow', 8000);
assert.equal(expired.status, 504);
await expired.text();
assert.ok(performance.now() - started < 18000, 'Deadline exceeded with cleanup margin');
assert.ok(await proxyHits() > beforeTimeout, 'Timeout must reach slow fixture');
await idle();
console.log('PASS timeout, slow fixture reached, no live Chrome');
const beforeDisconnect = await proxyHits();
const abort = new AbortController();
const pending = fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'http://8.8.8.8/slow', timeoutMs: 45000 }), signal: abort.signal })
  .then(r => ({ response: r.status }), () => ({ disconnected: true }));
let reached = false;
try {
  for (let i = 0; i < 100; i++) { if (await proxyHits() > beforeDisconnect) { reached = true; break; } await pause(100); }
} finally { abort.abort(); }
assert.ok(reached, 'Disconnect test must reach slow fixture');
assert.equal((await pending).disconnected, true);
await idle();
console.log('PASS disconnect, no live Chrome within 10 seconds');
const recovered = await post('/', runtime ? 10000 : 40000);
assert.equal(recovered.status, 200);
const data = await recovered.json();
if (runtime) assert.equal(data.navigation.status, 'COMPLETED');
else assert.ok(data.categories?.accessibility);
await idle();
console.log('PASS new analysis after cleanup');
JS
    docker logs "argos-security-$service" > "$EVIDENCE/collector-$service.log" 2>&1
    docker inspect "argos-security-$service" \
      --format '{{.State.OOMKilled}} {{.RestartCount}}' >> "$EVIDENCE/lifecycle-resources.txt"
    test "$(docker inspect "argos-security-$service" --format '{{.State.OOMKilled}}')" = false
    test "$(docker inspect "argos-security-$service" --format '{{.RestartCount}}')" = 0
  done
  printf 'PASS\n' > "$EVIDENCE/lifecycle.status"
) > "$EVIDENCE/lifecycle-setup.log" 2>&1
```

Attendus pour les deux collecteurs : trois lignes `PASS`, timeout 504 borné, vraie
requête lente arrivée avant la déconnexion, aucun processus Chrome vivant après
nettoyage, nouvelle analyse 200 sans redémarrage ni OOM. Un lancement trop lent
pour atteindre la fixture n’est pas une preuve de timeout de navigation : mesurer
et diagnostiquer, puis ajuster explicitement le budget de recette sans dépasser les
plafonds applicatifs ni considérer le test initial comme réussi. Après chaque bloc,
vérifier que les conteneurs/réseaux `argos-security-*` ont disparu ; ne pas lancer
un `docker system prune` ou supprimer des volumes pour nettoyer cette recette.

## 4. Observer les services réellement déployés

Conserver une table `service / SHA de build / image ID / architecture / workflow de
déploiement / SHA du gateway et profil seccomp`. Relever les labels à partir de
l’ID d’image attaché au conteneur, jamais d’un tag mutable. Si tous les services
portent le même SHA, réutiliser le [collecteur de provenance](../release/runtime-provenance.md) :

```bash
node scripts/release/inspect-runtime.mjs --expected-sha "$CANDIDATE_SHA" \
  --output "$EVIDENCE/runtime-before.json"
```

En cas de SHA distincts, consigner les quatre révisions et leurs preuves CI,
vérifier leur filiation à #505 dans le checkout et conserver les écarts ; ne pas
rebaptiser artificiellement les images. Les gateways n’ont pas de label de
révision : comparer leurs fichiers aux sources du SHA de leur déploiement. Le
collecteur `inspect-runtime` ne prouve ni ce contenu ni le sandbox, et une santé
Docker absente pour Java/Next reste à vérifier au niveau applicatif.

```bash
for service in playwright-service lighthouse-service; do
  image_id="$(docker inspect "$service" --format '{{.Image}}')"
  docker image inspect "$image_id" --format '{{.Id}} {{.Architecture}} {{index .Config.Labels "org.opencontainers.image.revision"}}'
  docker inspect "$service" --format \
    'user={{.Config.User}} readonly={{.HostConfig.ReadonlyRootfs}} capsDrop={{json .HostConfig.CapDrop}} capsAdd={{json .HostConfig.CapAdd}} privileged={{.HostConfig.Privileged}} security={{json .HostConfig.SecurityOpt}} network={{.HostConfig.NetworkMode}} memory={{.HostConfig.Memory}} cpus={{.HostConfig.NanoCpus}} pids={{.HostConfig.PidsLimit}} mounts={{range .Mounts}}{{.Destination}}:{{.RW}} {{end}}'
  docker exec "$service" node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3016)+'/health').then(r=>{if(!r.ok)process.exit(1);return r.json()}).then(d=>console.log(d.status)).catch(()=>process.exit(1))"
  gateway_id="$(docker inspect "$service" --format '{{.HostConfig.NetworkMode}}')"
  test "${gateway_id#container:}" != "$gateway_id"
  gateway_id="${gateway_id#container:}"
  docker exec "$gateway_id" iptables -S OUTPUT
  docker exec "$gateway_id" ip6tables -S OUTPUT
  docker exec "$gateway_id" sha256sum /app/policy.mjs /app/proxy.mjs /app/server.mjs /app/firewall.sh
  docker exec "$gateway_id" sh -c 'grep -E "^(Uid|Gid|CapEff|CapBnd|NoNewPrivs):" /proc/1/status'
done > "$EVIDENCE/deployed-isolation.txt"
```

Attendus : images ARM64, UID `1001:1001`, rootfs read-only, `CapDrop=ALL`, aucune
capacité ajoutée aux workers, non privilégiés, `no-new-privileges`, profil seccomp
revu, 1 GiB / 2 CPU / 256 PIDs, uniquement tmpfs attendus, aucun secret/volume hôte
dans les workers. Vérifier aussi `docker inspect --format '{{json .HostConfig.Tmpfs}} {{.HostConfig.ShmSize}}'`
pour les deux workers (256 MiB `/tmp`, 16 MiB home, 128 MiB shm).
Les passerelles partagent effectivement leurs namespaces avec les workers :
OUTPUT DROP IPv4/IPv6, règles par UID conformes à `apps/audit-egress/firewall.sh`,
proxy PID 1 UID/GID 1000, CapEff/CapBnd nuls et NoNewPrivs=1. Examiner chaque
passerelle séparément ; un `/health` 200 seul ne prouve pas ces contrôles.

Comparer les profils `/srv/apps/{playwright-service,lighthouse-service}/chromium-seccomp.json`
et les fichiers passerelle avec `sha256sum` des fichiers correspondants du checkout
du SHA déployé. Vérifier que le chemin déclaré dans SecurityOpt correspond au
profil comparé et que le profil était installé avant le démarrage du worker ; une
modification du fichier après démarrage ne prouve pas le profil chargé. Vérifier
les gateways de l’API avec le compose installé, sans afficher sa configuration :

```bash
api_gateway="$(docker compose -f /srv/apps/api-backend/docker-compose.prod.yml ps -q audit-egress)"
test -n "$api_gateway"
docker exec "$api_gateway" iptables -S OUTPUT > "$EVIDENCE/api-gateway-ipv4.txt"
docker exec "$api_gateway" ip6tables -S OUTPUT > "$EVIDENCE/api-gateway-ipv6.txt"
docker exec "$api_gateway" sha256sum /app/policy.mjs /app/proxy.mjs /app/server.mjs /app/firewall.sh \
  > "$EVIDENCE/api-gateway-files.txt"
docker exec api-backend sh -c 'test "$ARGOS_EXTERNAL_SCANS_ENABLED" = false && test "$CODEX_SUMMARY_ENABLED" = false && test "$AUDIT_EGRESS_PROXY" = http://audit-egress:3128'
```

Vérifier ZAP sur son réseau interne sans sortie cible et `sendRequests=false`
(code + configuration réellement utilisée). Ne pas activer Observatory, SSL Labs
ou la synthèse IA pour la recette : leur réactivation demande la revue séparée
décrite dans la note de sécurité. Vérifier la santé Java/DB par le monitoring
authentifié existant, sans conserver le credential dans les commandes ou preuves.

## 5. Entrées réelles, parcours sans compte et confidentialité

En fenêtre calme, depuis un navigateur sans cookies, soumettre **une page HTTPS
de fixture contrôlée par l’exploitant**, publiquement résoluble sur le port 443.
Ne pas utiliser la pseudo-IP Docker de l’étape 2 depuis la production. La page
doit être inoffensive et ne contenir que des données synthétiques. Noter en privé
les heures, run et durée ; conserver le lien de rapport et les preuves de run
uniquement dans le dossier privé. Les captures partagées masquent URL/token/cookies.

Vérifier : BFF same-origin, admission, progression, fin du run, publication,
rapport lisible par son bearer link, modules désactivés explicitement indisponibles
et aucun score mesuré inventé. Vérifier via les interfaces existantes que l’absence
de preuve de run empêche sa lecture privée et que liste/admin/historique ne sont
pas lisibles sans leurs credentials. Ne pas confondre le lien de rapport partageable
avec une session de compte. Contrôler les headers no-store de l’API et l’expiration
avec les tests CI ; ne pas modifier un rapport réel pour simuler son expiration.

Pendant l’audit, relever les processus des deux workers. Cette commande ne publie
pas les lignes de commande (elles peuvent contenir l’URL auditée) :

```bash
for service in playwright-service lighthouse-service; do
  docker exec -i "$service" node --input-type=module >> "$EVIDENCE/deployed-browser-processes.jsonl" <<'JS'
import { readdirSync, readFileSync } from 'node:fs';
let renderers = 0;
for (const id of readdirSync('/proc').filter(id => /^\d+$/.test(id))) {
  try {
    const args = readFileSync(`/proc/${id}/cmdline`, 'utf8').split('\0');
    if (!args[0]?.includes('chrome')) continue;
    const status = readFileSync(`/proc/${id}/status`, 'utf8');
    const renderer = args.includes('--type=renderer');
    if (renderer) renderers++;
    console.log(JSON.stringify({ service: process.env.PORT, pid: Number(id), renderer,
      unsafeSandboxFlags: args.some(arg => ['--no-sandbox', '--disable-setuid-sandbox', '--disable-seccomp-filter-sandbox'].includes(arg)),
      uid: status.match(/^Uid:\s+(.+)$/m)?.[1],
      seccomp: status.match(/^Seccomp:\s+(\d+)$/m)?.[1],
      noNewPrivs: status.match(/^NoNewPrivs:\s+(\d+)$/m)?.[1] }));
  } catch { /* A process may disappear during collection. */ }
}
console.log(JSON.stringify({ service: process.env.PORT, renderers }));
JS
done
```

Attendus : au moins un renderer observé pour chacun des deux services durant sa
phase d’analyse, aucune désactivation de sandbox, UID 1001, Seccomp 2 et
NoNewPrivs 1. Le filtre seccomp Docker seul ne prouve pas tout le sandbox Chromium :
rapprocher ce relevé du lancement avec sandbox des sources déployées et du smoke
ARM64. Si le navigateur a déjà fini, refaire le relevé à temps ; zéro renderer ne
constitue pas une preuve. Après la fin du run, vérifier leur disparition (hors
autres audits simultanés), puis reprendre les relevés OOM/restarts et santé.

Les refus de syntaxe suivants ne doivent créer aucun run. Tester les deux chemins :
le BFF public et Java depuis le conteneur Next sur son réseau interne, sans ouvrir un port direct
ni modifier Traefik. Conserver uniquement les codes HTTP et labels de cas.
Le budget Traefik est de 5 requêtes / 15 minutes avec burst 2, y compris les refus.
Après l’audit nominal, laisser recharger le budget ; espacer les requêtes publiques
de 190 secondes. Réserver environ 16 minutes pour ce bloc. Ne pas augmenter les
quotas pour accélérer la recette. La boucle s’arrête au premier statut inattendu.

```bash
export ARGOS_BASE='https://argos.lelouet.fr'
for body in '{"url":"file:///etc/passwd"}' '{"url":"http://127.0.0.1/"}' \
            '{"url":"http://[::1]/"}' '{"url":"https://user:synthetic-secret@example.com/"}' \
            '{"url":"http://example.com:8080/"}'; do
  sleep 190
  code="$(curl --silent --show-error --max-time 20 --output /dev/null --write-out '%{http_code}' \
    -H 'Content-Type: application/json' --data "$body" "$ARGOS_BASE/api/audits")"
  printf '%s\n' "$code" >> "$EVIDENCE/bff-refusals.txt"
  test "$code" = 400
done
docker exec -i console-web node --input-type=module <<'JS' > "$EVIDENCE/java-refusals.txt" 2>&1
import assert from 'node:assert/strict';
const endpoint = new URL('/api/audits', process.env.API_BASE ?? 'http://api-backend:8081');
for (const [label, url] of [
  ['scheme', 'file:///etc/passwd'], ['ipv4', 'http://127.0.0.1/'],
  ['ipv6', 'http://[::1]/'], ['port', 'http://example.com:8080/'],
]) {
  const response = await fetch(endpoint, { method: 'POST', redirect: 'error',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(20000) });
  await response.arrayBuffer();
  console.log(`${label}=${response.status}`);
  assert.equal(response.status, 400);
  await new Promise(resolve => setTimeout(resolve, 11000));
}
JS
test "$(grep -c '=400$' "$EVIDENCE/java-refusals.txt")" = 4
```

Le client interne utilise seulement Node déjà présent dans Next, sans credentials,
cookies ni passage par la route BFF. Vérifier en privé que `API_BASE` désigne bien
Java, sinon adapter l’endpoint interne et consigner ce choix sans afficher les
variables d’environnement. Un 429/503 ne prouve pas un refus de validation : attendre la fin
du budget anti-abus ou diagnostiquer l’indisponibilité, puis refaire le cas.
Entrées ambiguës, corps >8 KiB, injections, limites de concurrence/volume,
DNS changeant et redirections sont couverts par la CI ; ne pas pointer la production vers des services internes pour
chercher une fuite. Relier chaque cas à ses résultats CI sur la révision retenue.

Rechercher le marqueur synthétique dans les sorties de fixture et, en privé, dans
les logs ciblés de la fenêtre du test réel. Ne pas exporter tout l’historique.
Un résultat sans marqueur ne garantit pas la détection de tout secret arbitraire.
Confirmer les limites sur les anciennes données/logs et l’accès DB/backups dans
la revue des risques résiduels.

## 6. V17 et cohérence de la file

Utiliser une session MariaDB existante avec compte de lecture, sans mot de passe
en argument shell. Exécuter les requêtes suivantes sur la base Argos et enregistrer
seulement les résultats agrégés. **Aucun UPDATE/DELETE ni lancement de 112 audits
sur la production** : `AuditAdmissionIT` fait la saturation sur une base de fixture.

```sql
SELECT version, success FROM flyway_schema_history WHERE version = '17';
SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
  AND TRIGGER_NAME IN ('ARG_AUDIT_ADMISSION_UPDATE', 'ARG_AUDIT_ADMISSION_DELETE');
START TRANSACTION WITH CONSISTENT SNAPSHOT;
SELECT a.pending,
       (SELECT COUNT(*) FROM ARG_AUDIT_RUN WHERE status IN ('QUEUED','RUNNING')) AS unfinished
FROM ARG_AUDIT_ADMISSION a WHERE a.id = 1;
COMMIT;
```

Attendus : migration 17 réussie, deux triggers présents et une ligne de sémaphore,
`pending = unfinished`, valeur entre 0 et 100. Faire le relevé avant, pendant et
après l’audit contrôlé ; la capacité doit être libérée lors du passage terminal.
Les autres audits peuvent modifier les totaux : le snapshot rend chaque comparaison
cohérente. Joindre la preuve CI MariaDB `AuditAdmissionIT` (100 admissions sur
112 tentatives concurrentes, refus 429, libération après transition/suppression,
rollback d’insertion). Si V17 est absente, si des anciens workers tournent ou si
le compteur diverge, **NO-GO** : suivre la procédure de migration/sauvegarde du
[runbook](../../infra/RUNBOOK.md) dans une intervention autorisée. Ne pas réparer
le compteur à la main pendant cette validation.

## 7. Dossier de clôture et décision

Après la recette, refaire l’observation runtime et comparer OOM/restarts, état,
CPU/mémoire et identités d’images avec le début. Une observation ponctuelle ne
mesure pas le pic : garder aussi les relevés `docker stats --no-stream` pendant
l’audit. Si une image change durant la recette, recommencer les contrôles affectés
sur une révision figée. Relire et expurger les preuves avant partage ; leur dossier
reste hors Git. Hacher les fichiers expurgés pour identifier les pièces revues.

Remplir ce tableau dans un compte rendu privé. Toute ligne non exécutée ou sans
preuve reste `À vérifier`, jamais `PASS` par déduction d’une fusion.

| Contrôle | Preuve à joindre | Résultat / date UTC / opérateur |
| --- | --- | --- |
| Révisions, filiation #505, architecture native, profils | SHA, image IDs, hashes, versions hôte | À vérifier |
| CI applicable aux sources exécutées | Liens CI, sécurité Docker, MariaDB, E2E, secrets, dépendances production | À vérifier |
| Sandbox ARM64, réseau, destinations secondaires et redirection | docker-smoke, proxy-tests, compteur privé zéro | À vérifier |
| Timeouts, déconnexion et reprise des deux navigateurs | lifecycle-runtime/lighthouse, absence Chrome vivant, OOM/restarts | À vérifier |
| Isolation effective des workers et trois gateways déployés | règles IPv4/IPv6, UID/caps, profils/hashes, limites, santé | À vérifier |
| BFF et API directe, refus sans création de run | codes par cas et totaux DB avant/après en fenêtre contrôlée | À vérifier |
| Audit sans compte, publication et droits | résultats expurgés du parcours et tests d’accès | À vérifier |
| V17, triggers, compteur et admission concurrente | snapshots SQL + AuditAdmissionIT | À vérifier |
| Nettoyage et ressources de l’hôte après recette | aucune fixture restante, stats, images inchangées, OOM/restarts | À vérifier |
| Confidentialité et périmètre passif | sorties/logs expurgés, modules indisponibles, ZAP passif | À vérifier |
| Risques résiduels et configuration de release | revue nominative, check sécurité requis, décision propriétaire | À vérifier |

La revue doit accepter explicitement les limites de
[audit-chain-488.md](audit-chain-488.md) : lien bearer, secrets inconnus et données
historiques, tunnel CONNECT/méthodes HTTP, effets possibles d’un GET public,
frontière conteneur/kernel, tiers et IA désactivés. Vérifier que
`Audit egress and browser isolation` est exigé dans les règles de branche et dans
les preuves de release. Ne pas présenter un ancien fichier de preuves V1 ou un
check structurel comme une nouvelle certification de #488.

Modèle de bilan à publier dans #488 après revue (sans pièces sensibles) :

> Révision(s) et images : … ; Raspberry/OS/kernel/Docker : … ; recette UTC : … ;
> opérateur : … ; relecteur : … . CI applicable : [liens]. Isolation ARM64,
> timeouts/déconnexion/reprise, V17/file, audit sans compte et confidentialité :
> [résultats et liens vers preuves expurgées accessibles aux relecteurs].
> Risques résiduels : [décision]. Écarts restants : [aucun ou liste].
> Décision : CLÔTURABLE / NO-GO, avec justification.

Clôturer uniquement si toutes les preuves sont disponibles, les écarts corrigés
et les risques résiduels acceptés par le propriétaire. Cette procédure ne clôture
pas l’issue automatiquement et n’autorise ni fusion ni déploiement.
