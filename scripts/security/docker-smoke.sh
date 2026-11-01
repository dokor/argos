#!/bin/bash
set -euo pipefail
# Only synthetic sites on isolated Docker bridges. 8.8.8.8 is routed to the fixture,
# never to a third party. It exercises the real public-IP policy without a production bypass.
root=$(pwd)
# A previous run owns existing names: never remove its fixtures.
for name in argos-security-runtime argos-security-lighthouse argos-security-gateway argos-security-public argos-security-private; do
  if docker container inspect "$name" >/dev/null 2>&1; then
    echo "Fixture container already exists: $name" >&2; exit 1
  fi
done
for name in argos-security-public argos-security-private; do
  if docker network inspect "$name" >/dev/null 2>&1; then
    echo "Fixture network already exists: $name" >&2; exit 1
  fi
done
ready() {
  for attempt in $(seq 1 30); do
    if docker exec "$1" node -e "$2" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "Fixture did not become ready: $1" >&2; return 1
}
cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then
    docker exec argos-security-gateway iptables -nvL OUTPUT 2>&1 || true
    docker logs --tail 80 argos-security-gateway 2>&1 || true
    docker logs --tail 80 argos-security-runtime 2>&1 || true
    docker logs --tail 80 argos-security-lighthouse 2>&1 || true
    docker exec argos-security-public node -e "fetch('http://127.0.0.1/stats').then(r=>r.text()).then(console.log)" 2>&1 || true
  fi
  docker rm -f argos-security-runtime argos-security-lighthouse argos-security-gateway argos-security-public argos-security-private >/dev/null 2>&1 || true
  docker network rm argos-security-public argos-security-private >/dev/null 2>&1 || true
  if [[ "${fixture_tls:-}" == /tmp/tmp.* ]]; then rm -rf -- "$fixture_tls"; fi
}
trap cleanup EXIT
fixture_tls=$(mktemp -d)
# A new, fixture-only CA. Browser certificate checks remain enabled.
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$fixture_tls/root.key" -out "$fixture_tls/root.pem" -days 1 -subj '/CN=Argos CI fixture CA' -addext 'basicConstraints=critical,CA:TRUE' >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -keyout "$fixture_tls/server.key" -out "$fixture_tls/server.csr" -subj '/CN=ci.fixture.net' >/dev/null 2>&1
printf '%s\n' 'subjectAltName=DNS:ci.fixture.net,DNS:second.fixture.net,DNS:outside.fixture.net' 'extendedKeyUsage=serverAuth' > "$fixture_tls/extensions"
openssl x509 -req -in "$fixture_tls/server.csr" -CA "$fixture_tls/root.pem" -CAkey "$fixture_tls/root.key" -CAcreateserial -out "$fixture_tls/server.pem" -days 1 -extfile "$fixture_tls/extensions" >/dev/null 2>&1
mkdir "$fixture_tls/nssdb"
certutil -N -d "sql:$fixture_tls/nssdb" --empty-password
certutil -A -d "sql:$fixture_tls/nssdb" -n argos-ci-fixture -t 'C,,' -i "$fixture_tls/root.pem"
chmod -R a+rX "$fixture_tls/nssdb"
docker build -t argos-security-egress apps/audit-egress
docker build -t argos-security-runtime apps/playwright-service
docker build -t argos-security-lighthouse apps/lighthouse-service
for image in argos-security-egress argos-security-runtime argos-security-lighthouse; do
  arch=$(docker image inspect "$image" --format '{{.Architecture}}')
  test -z "${EXPECTED_DOCKER_ARCH:-}" || test "$arch" = "$EXPECTED_DOCKER_ARCH"
  echo "Fixture image architecture: $image $arch"
done
docker network create --internal --subnet 8.8.8.0/24 argos-security-public
docker network create --internal argos-security-private
docker run -d --name argos-security-public --network argos-security-public --ip 8.8.8.8 \
  --network-alias ci.fixture.net --network-alias second.fixture.net --network-alias outside.fixture.net --network-alias badcert.fixture.net \
  -e CI_TLS_FIXTURE=true -v "$fixture_tls:/fixture-tls:ro" \
  -v "$root/scripts/security/fixture.mjs:/fixture.mjs:ro" --entrypoint node argos-security-egress /fixture.mjs
docker run -d --name argos-security-private --network argos-security-private --network-alias private.fixture.net \
  -e PRIVATE_FIXTURE=true -v "$root/scripts/security/fixture.mjs:/fixture.mjs:ro" --entrypoint node argos-security-egress /fixture.mjs
docker run -d --name argos-security-gateway --network argos-security-private \
  --cap-drop ALL --cap-add NET_ADMIN --cap-add SETUID --cap-add SETGID --cap-add SETPCAP \
  --read-only --security-opt no-new-privileges argos-security-egress
docker network connect argos-security-public argos-security-gateway
ready argos-security-gateway "const s=require('net').connect(3128,'127.0.0.1',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))"
docker run -d --name argos-security-runtime --network container:argos-security-gateway \
  --user 1001:1001 --cap-drop ALL --read-only --init --security-opt no-new-privileges \
  --security-opt "seccomp=$root/infra/compose/playwright-service/chromium-seccomp.json" \
  --tmpfs /tmp:size=256m --tmpfs /home/auditor:uid=1001,gid=1001,size=16m --shm-size 128m \
  --memory 1g --cpus 2 --pids-limit 256 -e AUDIT_EGRESS_PROXY=http://127.0.0.1:3128 \
  -v "$fixture_tls/nssdb:/fixture-nssdb:ro" \
  -v "$root/scripts/security/ci-runtime-fixture.mjs:/security-ci-runtime.mjs:ro" \
  -v "$root/scripts/security/ci-network.mjs:/security-ci-network.mjs:ro" \
  -v "$root/scripts/security/lifecycle.mjs:/security-lifecycle.mjs:ro" --entrypoint node argos-security-runtime /security-ci-runtime.mjs
ready argos-security-runtime "fetch('http://127.0.0.1:3016/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
docker exec argos-security-runtime node --input-type=module -e "
  import {chromium} from 'playwright';import {browserFlags,protectContext} from './browser-policy.mjs';
  const browser=await chromium.launch({chromiumSandbox:true,args:browserFlags('http://127.0.0.1:3128')});
  const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
  await protectContext(context,error=>{if(error)console.error('fixture_setup',error);});
  const page=await context.newPage();await page.goto('http://8.8.8.8/',{timeout:10000});
  await browser.close();
"
docker exec argos-security-runtime node --input-type=module -e "
  import assert from 'node:assert/strict';
  await assert.rejects(fetch('http://8.8.8.8',{signal:AbortSignal.timeout(2000)}));
  for(const url of ['http://8.8.8.8/','http://8.8.8.8/redirect','http://8.8.8.8/chunked','http://8.8.8.8/gzip']) {
    const response=await fetch('http://127.0.0.1:3016/analyze/runtime',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url,timeoutMs:10000})});
    assert.equal(response.status,200);const data=await response.json();
    assert.ok(!JSON.stringify(data).includes('synthetic-secret'));
    if(url.endsWith('/redirect'))assert.equal(data.navigation.status,'FAILED');
    else assert.equal(data.navigation.status,'COMPLETED');
    if(url.endsWith('/chunked') || url.endsWith('/gzip')) {
      assert.ok(Number.isSafeInteger(data.network.totalBytesEstimated) && data.network.totalBytesEstimated>0);
      assert.ok(data.network.topLargest.length>0);
      assert.ok(data.timings.loadMs!==null && data.timings.domContentLoadedMs!==null);
    }
  }
"
docker run -d --name argos-security-lighthouse --network container:argos-security-gateway \
  --user 1001:1001 --cap-drop ALL --read-only --init --security-opt no-new-privileges \
  --security-opt "seccomp=$root/infra/compose/lighthouse-service/chromium-seccomp.json" \
  --tmpfs /tmp:size=256m --tmpfs /home/auditor:uid=1001,gid=1001,size=16m --shm-size 128m \
  --memory 1g --cpus 2 --pids-limit 256 -e AUDIT_EGRESS_PROXY=http://127.0.0.1:3128 \
  -v "$fixture_tls/nssdb:/fixture-nssdb:ro" \
  -v "$root/scripts/security/ci-network.mjs:/security-ci-network.mjs:ro" \
  -v "$root/scripts/security/ci-lighthouse-fixture.mjs:/security-ci-lighthouse.mjs:ro" \
  -v "$root/scripts/security/lifecycle.mjs:/security-lifecycle.mjs:ro" --entrypoint node argos-security-lighthouse /security-ci-lighthouse.mjs
ready argos-security-lighthouse "fetch('http://127.0.0.1:3017/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
docker exec argos-security-lighthouse node --input-type=module -e "
  import assert from 'node:assert/strict';
  const response=await fetch('http://127.0.0.1:3017/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'http://8.8.8.8/',timeoutMs:40000})});
  assert.equal(response.status,200);const lhr=await response.json();
  console.log(JSON.stringify({runtimeError:lhr.runtimeError?.code,finalUrl:lhr.finalDisplayedUrl,accessibility:lhr.categories?.accessibility?.score}));
  assert.equal(lhr.runtimeError,undefined);
  assert.equal(typeof lhr.categories?.accessibility?.score,'number');
  assert.ok(lhr.categories.accessibility.score>=0 && lhr.categories.accessibility.score<=1);
  assert.ok(!JSON.stringify(lhr).includes('synthetic-secret'));
"
docker exec argos-security-private node --input-type=module -e "import assert from 'node:assert/strict';const r=await fetch('http://127.0.0.1/stats');assert.equal((await r.json()).hits,0)"
for service in runtime lighthouse; do
  timeout 300s docker exec -e TEST_SERVICE="$service" "argos-security-$service" node /security-ci-network.mjs
  timeout 180s docker exec -e TEST_SERVICE="$service" "argos-security-$service" node /security-lifecycle.mjs
  timeout 180s docker exec -e TEST_SERVICE="$service" -e CI_FIXTURE_ORIGIN=https://ci.fixture.net "argos-security-$service" node /security-lifecycle.mjs
  test "$(docker inspect "argos-security-$service" --format '{{.State.OOMKilled}} {{.RestartCount}}')" = 'false 0'
  log_file=$(mktemp)
  docker logs "argos-security-$service" > "$log_file" 2>&1
  cat "$log_file"
  if grep -q 'synthetic-secret' "$log_file"; then rm "$log_file"; exit 1; fi
  rm "$log_file"
done

# Check counters after the lifecycle recovery audits as well.
docker exec argos-security-private node --input-type=module -e "import assert from 'node:assert/strict';const r=await fetch('http://127.0.0.1/stats');assert.equal((await r.json()).hits,0)"
docker exec argos-security-public node --input-type=module -e "import assert from 'node:assert/strict';const r=await fetch('http://127.0.0.1/stats');assert.equal((await r.json()).mutations,0)"
docker exec argos-security-public node --input-type=module -e "import assert from 'node:assert/strict';const data=await(await fetch('http://127.0.0.1/stats')).json();for(const key of ['outsideHits','badCertificateHits','stateLeaks','credentialHits'])assert.equal(data[key],0,key)"
