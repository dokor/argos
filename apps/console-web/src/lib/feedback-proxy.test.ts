import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/feedback/route";
import { accountProxy } from "./account-proxy";
const fetchMock=vi.fn(),csrf="c".repeat(43);
beforeEach(()=>{vi.stubEnv("ACCOUNT_ORIGIN","http://localhost:3000");vi.stubEnv("API_BASE","http://fixture-backend");vi.stubGlobal("fetch",fetchMock);fetchMock.mockReset();});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
function request(path:string,body:unknown,valid=true,method="POST") {
  return new NextRequest("http://localhost:3000/api/"+path,{method,headers:{"Content-Type":"application/json",Origin:valid?"http://localhost:3000":"https://foreign.example","X-Argos-CSRF":csrf,Cookie:"argos_account_csrf="+csrf},body:JSON.stringify(body)});
}
it("requires same-origin CSRF and rejects unbounded or forged submissions before fetch",async()=>{
  expect((await POST(request("feedback",{type:"BUG",description:"x"},false))).status).toBe(403);
  expect((await POST(request("feedback",{type:"BUG",description:"x",ownerId:"7"}))).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("forwards only explicit report context, preserves rate limits and private responses",async()=>{
  const body={type:"FALSE_POSITIVE",description:"Incorrect on fixture",reportToken:"t".repeat(43),findingKey:"http.hsts"};
  fetchMock.mockResolvedValue(new Response('{"error":"rate_limited"}',{status:429,headers:{"Retry-After":"45"}}));
  const result=await POST(request("feedback",body));expect(result.status).toBe(429);expect(result.headers.get("retry-after")).toBe("45");expect(result.headers.get("cache-control")).toContain("no-store");
  expect(fetchMock.mock.calls[0][0]).toBe("http://fixture-backend/api/feedback");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(body);expect(fetchMock.mock.calls[0][1].headers.get("Cookie")).toBe("argos_account_csrf="+csrf);
});
it("returns a private service error without reflecting submitted text",async()=>{
  fetchMock.mockRejectedValue(new Error("secret"));const result=await POST(request("feedback",{type:"BUG",description:"private fixture"}));expect(result.status).toBe(503);expect(await result.json()).toEqual({error:"feedback_unavailable"});
});
it("admin treatment forwards CSRF, expected status and no score change",async()=>{
  const body={status:"PENDING",expectedStatus:"OPEN"};fetchMock.mockResolvedValue(new Response('{"changed":true}'));
  const response=await accountProxy(request("account/admin/feedback/42",body,true,"PATCH"),["admin","feedback","42"]);
  expect(response.status).toBe(200);expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(body);
});
