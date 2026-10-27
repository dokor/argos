// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {billingRead,billingDestination,BillingClientError} from "./billing-client";
import {accountAuditHeaders,resetAccountCsrf} from "./account-client";
vi.mock("./account-client",async importOriginal=>({...await importOriginal<typeof import("./account-client")>(),accountAuditHeaders:vi.fn().mockResolvedValue({"X-Argos-CSRF":"c".repeat(43)}),resetAccountCsrf:vi.fn()}));
import {disabled} from "@/components/connected/billing/fixtures/billing.mjs";
const fetchMock=vi.fn();
beforeEach(()=>{vi.mocked(accountAuditHeaders).mockClear();resetAccountCsrf();vi.stubGlobal("fetch",fetchMock);fetchMock.mockReset();});
afterEach(()=>vi.unstubAllGlobals());
it("reads only the owner snapshot without starting a provider operation",async()=>{
  fetchMock.mockResolvedValue(Response.json(disabled));expect(await billingRead(new AbortController().signal)).toEqual(disabled);
  expect(accountAuditHeaders).not.toHaveBeenCalled();expect(fetchMock).toHaveBeenCalledTimes(1);expect(fetchMock.mock.calls[0][0]).toBe("/api/account/billing");expect(fetchMock.mock.calls[0][1].method).toBe("GET");
});
it("sends only the selected interval through the CSRF-protected BFF and never retries a mutation",async()=>{
  fetchMock.mockResolvedValueOnce(Response.json({error:"billing_sync_pending"},{status:409}));
  await expect(billingDestination("checkout","YEAR",new AbortController().signal)).rejects.toMatchObject({code:"billing_sync_pending"});
  expect(fetchMock).toHaveBeenCalledTimes(1);expect(fetchMock.mock.calls[0][0]).toBe("/api/account/billing/checkout");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({interval:"YEAR"});expect(fetchMock.mock.calls[0][1].headers["X-Argos-CSRF"]).toHaveLength(43);
  expect(fetchMock.mock.calls.every(([url])=>String(url).startsWith("/api/account/"))).toBe(true);
});
it("refuses unknown errors and unsafe destinations even if the BFF returned them",async()=>{
  fetchMock.mockResolvedValueOnce(Response.json({url:"https://attacker.invalid/secret"}));
  await expect(billingDestination("portal","MONTH",new AbortController().signal)).rejects.toMatchObject({code:"billing_unavailable"});
  fetchMock.mockResolvedValue(Response.json({error:"private provider failure",customer:"cus_private"},{status:500}));
  try{await billingRead(new AbortController().signal);throw Error("Expected failure");}catch(e){expect(e).toBeInstanceOf(BillingClientError);expect(String(e)).not.toMatch(/cus_private|provider failure/);}
});
it("cancels a streamed owner response without exposing the partial body",async()=>{
  const control=new AbortController();fetchMock.mockResolvedValue(new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"private":"secret'));}}),{headers:{"Content-Type":"application/json"}}));
  const result=billingRead(control.signal);queueMicrotask(()=>control.abort());
  await expect(result).rejects.toMatchObject({code:"billing_unavailable"});
});
