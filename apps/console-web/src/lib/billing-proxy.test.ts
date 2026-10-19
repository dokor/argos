import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import {billingProxy} from "./billing-proxy";
import {disabled} from "@/components/connected/billing/fixtures/billing.mjs";
const fetchMock=vi.fn();
beforeEach(()=>{vi.stubGlobal("fetch",fetchMock);fetchMock.mockReset();vi.stubEnv("API_BASE","http://127.0.0.1:8081");});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
const auth=()=>new Headers({Authorization:"Bearer private-browser-session","Content-Type":"application/json"});
function req(path="",body?:unknown){return new NextRequest("https://argos.lelouet.fr/api/account/billing"+path,{method:body===undefined?"GET":"POST",
  headers:{"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});}
it("requires an account session and rejects arbitrary identifiers, prices, queries and routes without a provider call",async()=>{
  expect((await billingProxy(req(),[],()=>new Headers())).status).toBe(401);
  for(const [parts,request]of [
    [["checkout"],req("/checkout",{interval:"MONTH",customer:"cus_foreign"})],
    [["checkout"],req("/checkout",{interval:"YEAR",price:"price_cheap"})],
    [["portal"],req("/portal",{return_url:"https://attacker.invalid"})],
    [[],req("?customer=cus_foreign")],[["foreign"],req("/foreign")],
  ] as [string[],NextRequest][]){expect((await billingProxy(request,parts,auth)).status).toBe(400);}
  expect(fetchMock).not.toHaveBeenCalled();
});
it("forwards only the owner session to Java and preserves the disabled price-free snapshot",async()=>{
  fetchMock.mockResolvedValue(Response.json(disabled));
  const r=await billingProxy(req(),[],auth);expect(r.status).toBe(200);expect(await r.json()).toEqual(disabled);
  expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:8081/api/account/billing");
  expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer private-browser-session");
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
});
it.each([
  {url:"https://attacker.invalid/c/pay/cs_test_fake"},
  {url:"https://checkout.stripe.com.attacker.invalid/c/pay/cs_test_fake"},
  {url:"https://billing.stripe.com@attacker.invalid/p/session"},
  {url:"https://checkout.stripe.com/c/pay/cs_test_fake",customerId:"cus_private"},
])("rejects unsafe or data-bearing provider destinations",async body=>{
  fetchMock.mockResolvedValue(Response.json(body));const r=await billingProxy(req("/checkout",{interval:"MONTH"}),["checkout"],auth);
  expect(r.status).toBe(503);expect(JSON.stringify(await r.json())).not.toContain("cus_private");
});
it("validates the provider-specific host and permits the current signed portal URL shape",async()=>{
  fetchMock.mockResolvedValue(Response.json({url:"https://billing.stripe.com/p/session?secret=fixture_only"}));
  const r=await billingProxy(req("/portal",{}),["portal"],auth);expect(r.status).toBe(200);
  expect(r.headers.get("Referrer-Policy")).toBe("no-referrer");
});
it("does not reflect provider errors, HTML, credentials or unknown response fields",async()=>{
  for(const r of [Response.json({error:"payment_failed",customer:"cus_private",secret:"private"}, {status:400}),
    new Response("<html>private payment details</html>",{status:502,headers:{"Content-Type":"text/html"}}),Response.json({...disabled,customerId:"cus_private"})]){
    fetchMock.mockResolvedValue(r);const response=await billingProxy(req(),[],auth);expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/cus_private|payment details|secret/);
  }
});
it("preserves only the controlled requestId for server-side correlation",async()=>{
  const requestId="73300000-0000-4000-8000-000000000001";
  fetchMock.mockResolvedValue(Response.json({error:"billing_sync_pending",requestId},{status:409}));
  const r=await billingProxy(req(),[],auth);expect(r.status).toBe(409);expect(await r.json()).toEqual({error:"billing_sync_pending",requestId});
});
