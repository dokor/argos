// @vitest-environment jsdom
import { beforeEach,it,expect,vi } from "vitest";
import { render,screen,fireEvent,waitFor } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import { AccountClientError } from "@/lib/account-client";
import AdminView from "./AdminView";
const {api,session}=vi.hoisted(()=>({api:vi.fn(),session:{profile:{admin:true,verified:true},ready:true,denied:false,refreshUsage:vi.fn()}}));
vi.mock("@/lib/account-client",async importOriginal=>({...await importOriginal<typeof import("@/lib/account-client")>(),accountFetch:api}));
vi.mock("@/components/account/AccountSession",()=>({useAccountSession:()=>session,PersonalNavigation:()=>null}));
vi.mock("@/components/site/SiteNav",()=>({default:()=>null}));
vi.mock("@/components/site/SiteFooter",()=>({default:()=>null}));
vi.mock("@/app/(fr)/report/[token]/ReportPage",()=>({default:()=> <h1>Report fixture</h1>}));
const row={id:"42",displayName:"Alice",email:"alice@example.com",state:"ACTIVE",role:"USER",offer:"FREE",createdAt:"2026-10-11T10:00:00Z"};
beforeEach(()=>{
 session.profile={admin:true,verified:true};session.denied=false;api.mockReset();
 api.mockImplementation(async(path:string,method:string)=>{
  if(method==="PATCH")return {changed:true};
  if(path==="admin/queue")return {queued:27,running:3};
  if(path==="admin/users/42")return {...row,monthlyLimit:null,offers:["FREE","PRO"],usage:{used:2,reserved:1,limit:10,resetsAt:"2026-11-01T00:00:00Z",timezone:"UTC"}};
  if(path.startsWith("admin/users"))return {items:[row],nextCursor:"42"};
  if(path.startsWith("admin/runs"))return {items:[],nextCursor:null};
  return {items:[],nextCursor:null};
 });
});
it.each(["fr","en"] as const)("keeps monitoring counts and private run pagination in %s",async lang=>{
 api.mockImplementation(async(path:string)=>path==="admin/queue"?{queued:27,running:3}:{items:[{id:"42",site:"example.com",status:"FAILED",createdAt:"2026-10-11T10:00:00Z"}],nextCursor:"42"});
 render(<LangProvider initialLang={lang}><AdminView/></LangProvider>);
 await screen.findByText("example.com");expect(screen.getByText("27")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:lang==="fr"?"Page suivante":"Next page"}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith("admin/runs?limit=20&cursor=42","GET",undefined,expect.any(AbortSignal)));
 expect(document.querySelectorAll("h1")).toHaveLength(1);
});
it("does not request private monitoring for a regular account",()=>{
 session.profile.admin=false;render(<LangProvider><AdminView/></LangProvider>);expect(api).not.toHaveBeenCalled();expect(screen.getByRole("alert")).toHaveTextContent("administrateur");
});
it("clears private monitoring after the server revokes the role",async()=>{
 render(<LangProvider><AdminView/></LangProvider>);await screen.findByText("27");
 api.mockRejectedValue(new AccountClientError("admin_required",403));fireEvent.click(screen.getByRole("button",{name:"Actualiser"}));
 await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("administrateur"));expect(screen.queryByText("27")).not.toBeInTheDocument();
});
