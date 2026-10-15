#!/bin/bash
set -euo pipefail
# Only synthetic sites on isolated Docker bridges. 8.8.8.8 is routed to the fixture,
# never to a third party. It exercises the real public-IP policy without a production bypass.
root=$(pwd)
cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then
    docker exec argos-security-gateway iptables -nvL OUTPUT 2>&1 || true
    docker logs --tail 80 argos-security-gateway 2>&1 || true
    docker logs --tail 80 argos-security-runtime 2>&1 || true
    docker logs --tail 80 argos-security-lighthouse 2>&1 || true
  fi
  docker rm -f argos-security-runtime argos-security-lighthouse argos-security-gateway argos-security-public argos-security-private >/dev/null 2>&1 || true
  docker network rm argos-security-public argos-security-private >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker build -t argos-security-egress apps/audit-egress
docker build -t argos-security-runtime apps/playwright-service
docker build -t argos-security-lighthouse apps/lighthouse-service
docker network create --internal --subnet 8.8.8.0/24 argos-security-public
docker network create --internal argos-security-private
docker run -d --name argos-security-public --network argos-security-public --ip 8.8.8.8 \
  -v "$root/scripts/security/fixture.mjs:/fixture.mjs:ro" --entrypoint node argos-security-egress /fixture.mjs
docker run -d --name argos-security-private --network argos-security-private --network-alias private.fixture.net \
  -e PRIVATE_FIXTURE=true -v "$root/scripts/security/fixture.mjs:/fixture.mjs:ro" --entrypoint node argos-security-egress /fixture.mjs
docker run -d --name argos-security-gateway --network argos-security-private \
  --cap-drop ALL --cap-add NET_ADMIN --cap-add SETUID --cap-add SETGID --cap-add SETPCAP \
  --read-only --security-opt no-new-privileges argos-security-egress
docker network connect argos-security-public argos-security-gateway
for attempt in $(seq 1 30); do
  if docker exec argos-security-gateway node -e "const s=require('net').connect(3128,'127.0.0.1',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))"; then break; fi
  sleep 1
done
docker run -d --name argos-security-runtime --network container:argos-security-gateway \
  --user 1001:1001 --cap-drop ALL --read-only --init --security-opt no-new-privileges \
  --security-opt "seccomp=$root/infra/compose/playwright-service/chromium-seccomp.json" \
  --tmpfs /tmp:size=256m --tmpfs /home/auditor:uid=1001,gid=1001,size=16m --shm-size 128m \
  --memory 1g --pids-limit 256 -e AUDIT_EGRESS_PROXY=http://127.0.0.1:3128 argos-security-runtime
for attempt in $(seq 1 30); do
  if docker exec argos-security-runtime node -e "fetch('http://127.0.0.1:3016/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then break; fi
  sleep 1
done
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
  for(const url of ['http://8.8.8.8/','http://8.8.8.8/redirect']) {
    const response=await fetch('http://127.0.0.1:3016/analyze/runtime',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url,timeoutMs:10000})});
    assert.equal(response.status,200);const data=await response.json();
    assert.ok(!JSON.stringify(data).includes('synthetic-secret'));
    if(url.endsWith('/'))assert.equal(data.navigation.status,'COMPLETED');
    else assert.equal(data.navigation.status,'FAILED');
  }
"
docker run -d --name argos-security-lighthouse --network container:argos-security-gateway \
  --user 1001:1001 --cap-drop ALL --read-only --init --security-opt no-new-privileges \
  --security-opt "seccomp=$root/infra/compose/lighthouse-service/chromium-seccomp.json" \
  --tmpfs /tmp:size=256m --tmpfs /home/auditor:uid=1001,gid=1001,size=16m --shm-size 128m \
  --memory 1g --pids-limit 256 -e AUDIT_EGRESS_PROXY=http://127.0.0.1:3128 argos-security-lighthouse
for attempt in $(seq 1 30); do
  if docker exec argos-security-lighthouse node -e "fetch('http://127.0.0.1:3017/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then break; fi
  sleep 1
done
docker exec argos-security-lighthouse node --input-type=module -e "
  import assert from 'node:assert/strict';
  const response=await fetch('http://127.0.0.1:3017/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'http://8.8.8.8/',timeoutMs:40000})});
  assert.equal(response.status,200);const lhr=await response.json();
  assert.ok(lhr.categories.accessibility);assert.ok(!JSON.stringify(lhr).includes('synthetic-secret'));
"
docker exec argos-security-private node --input-type=module -e "import assert from 'node:assert/strict';const r=await fetch('http://127.0.0.1/stats');assert.equal((await r.json()).hits,0)"
docker logs argos-security-runtime 2>&1 | tee /tmp/argos-security-runtime.log
if grep -q 'synthetic-secret' /tmp/argos-security-runtime.log; then exit 1; fi
