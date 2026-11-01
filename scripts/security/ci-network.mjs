import assert from 'node:assert/strict';
const runtime=process.env.TEST_SERVICE==='runtime';
const endpoint='http://127.0.0.1:'+(runtime?'3016/analyze/runtime':'3017/analyze');
const origin='https://ci.fixture.net';
async function run(url,origins=[origin]) {
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic-ci-credential',Cookie:'session=synthetic-ci-credential'},
    body:JSON.stringify({url,navigationOrigins:origins,timeoutMs:runtime?10000:40000}),signal:AbortSignal.timeout(60000)});
  const raw=await response.text();assert.ok(!raw.includes('synthetic-ci-credential'));
  if(response.status!==200)return false;
  const body=JSON.parse(raw);
  const measured=response.status===200 && (runtime?body.navigation?.status==='COMPLETED':!body.runtimeError && typeof body.categories?.accessibility?.score==='number');
  return measured;
}
assert.equal(await run(origin+'/'),true,'Verified HTTPS origin must remain measurable');
assert.equal(await run(origin+'/cross-origin'),false,'Unverified public main-frame redirect must fail');
assert.equal(await run(origin+'/redirect'),false,'Private/downgraded redirect must fail');
assert.equal(await run(origin+'/second-origin',[origin,'https://second.fixture.net']),true,'Explicit second verified origin must work');
assert.equal(await run(origin+'/chain',[origin,'https://second.fixture.net']),false,'Every hop of a redirect chain must stay verified');
assert.equal(await run('https://badcert.fixture.net/',['https://badcert.fixture.net']),false,'Certificate validation must remain active');
assert.equal(await run(origin+'/store-state'),true);
assert.equal(await run(origin+'/probe-state'),true,'A later run must start with a clean context');
assert.equal(await run(origin+'/'),true,'A blocked navigation must not poison later runs');
console.log('PASS CI HTTPS, declared redirects, rejected public/private redirects, TLS, cookie isolation and credential boundary');
