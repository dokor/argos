import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
import {GET} from "@/app/api/antibot/route";
import {POST as feedback} from "@/app/api/feedback/route";
import {accountProxy} from "./account-proxy";
const fetchMock=vi.fn(),csrf="c".repeat(43);
beforeEach(()=>{fetchMock.mockReset();vi.stubGlobal("fetch",fetchMock);vi.stubEnv("ACCOUNT_ORIGIN","http://localhost:3000");vi.stubEnv("API_BASE","http://fixture-backend");});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it("returns only public configuration and fails closed on a configuration outage",async()=>{
 fetchMock.mockResolvedValueOnce(new Response('{"enabled":true,"siteKey":"public","secret":"must-not-leak"}')).mockRejectedValueOnce(new Error("private data"));
 const config=await GET(new NextRequest("http://localhost:3000/api/antibot?action=register"));expect(await config.json()).toEqual({enabled:true,siteKey:"public"});expect(config.headers.get("cache-control")).toContain("no-store");
 const failure=await GET(new NextRequest("http://localhost:3000/api/antibot"));expect(failure.status).toBe(503);expect(await failure.json()).toEqual({error:"antibot_unavailable"});
});
it("does not exempt a forged cookie or public registration and verifies connected feedback sessions",async()=>{
 const request=(action:string)=>new NextRequest("http://localhost:3000/api/antibot?action="+action,{headers:{Cookie:"argos_account=forged"}});
 fetchMock.mockImplementation(async (url:string)=>url.endsWith("/me")?new Response('{}',{status:401}):new Response('{"enabled":true,"siteKey":"public"}'));
 expect(await (await GET(request("feedback"))).json()).toMatchObject({enabled:true});
 fetchMock.mockImplementation(async (url:string)=>url.endsWith("/me")?new Response('{}'):new Response('{"enabled":true,"siteKey":"public"}'));
 expect(await (await GET(request("feedback"))).json()).toEqual({enabled:false});expect(await (await GET(request("register"))).json()).toMatchObject({enabled:true});
});
it("forwards proofs across account and feedback BFFs without accepting validation claims",async()=>{
 fetchMock.mockImplementation(async()=>new Response('{"accepted":true}'));
 const request=(path:string,body:unknown)=>new NextRequest("http://localhost:3000/api/"+path,{method:"POST",headers:{Origin:"http://localhost:3000",Cookie:"argos_account_csrf="+csrf,"X-Argos-CSRF":csrf,"X-Argos-Captcha":"proof","X-Argos-Captcha-Verified":"true","Content-Type":"application/json"},body:JSON.stringify(body)});
 await accountProxy(request("account/auth/register",{email:"fixture@example.com",password:"synthetic passphrase",displayName:"Fixture"}),["auth","register"]);
 await feedback(request("feedback",{type:"BUG",description:"fixture"}));
 for(const call of fetchMock.mock.calls){expect(call[1].headers.get("X-Argos-Captcha")).toBe("proof");expect(call[1].headers.has("X-Argos-Captcha-Verified")).toBe(false);expect(call[1].body).not.toContain("proof");}
});
