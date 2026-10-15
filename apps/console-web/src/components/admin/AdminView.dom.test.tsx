// @vitest-environment jsdom
import { beforeEach,it,expect,vi } from "vitest";
import { render,screen,fireEvent,waitFor } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import { AccountClientError } from "@/lib/account-client";
import AdminView from "./AdminView";
const nav=vi.hoisted(()=>({api:vi.fn(),push:vi.fn(),query:"",session:{profile:{admin:true,verified:true},ready:true,denied:false,refreshUsage:vi.fn()}}));
const {api,session}=nav;
vi.mock("next/navigation",()=>({useSearchParams:()=>new URLSearchParams(nav.query),useRouter:()=>({push:nav.push})}));
vi.mock("@/lib/account-client",async importOriginal=>({...await importOriginal<typeof import("@/lib/account-client")>(),accountFetch:nav.api}));
vi.mock("@/components/account/AccountSession",()=>({useAccountSession:()=>nav.session,PersonalNavigation:()=>null}));
vi.mock("@/components/site/SiteNav",()=>({default:()=>null}));
vi.mock("@/components/site/SiteFooter",()=>({default:()=>null}));
vi.mock("@/app/(fr)/report/[token]/ReportPage",()=>({default:()=> <h1>Report fixture</h1>}));
const row={id:"42",displayName:"Alice",email:"alice@example.com",state:"ACTIVE",role:"USER",offer:"FREE",createdAt:"2026-10-11T10:00:00Z"};
beforeEach(()=>{
 nav.query="";nav.push.mockReset();session.profile={admin:true,verified:true};session.denied=false;api.mockReset();
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
 const view=render(<LangProvider initialLang={lang}><AdminView/></LangProvider>);
 await screen.findByText("example.com");expect(screen.getByText("27")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:lang==="fr"?"Page suivante":"Next page"}));
 expect(nav.push).toHaveBeenCalledWith((lang==="en"?"/en":"")+"/account/admin/runs?cursor=42");
 nav.query="cursor=42";view.rerender(<LangProvider initialLang={lang}><AdminView/></LangProvider>);
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

it("restores filters and cursor from the URL, resets the cursor on edits, and carries the exact list return", async()=>{
 nav.query="site=atelier.example&status=FAILED&cursor=42";
 api.mockImplementation(async(path:string)=>path==="admin/queue"?{queued:1,running:0}:{items:[{id:"41",site:"atelier.example",status:"FAILED",createdAt:"2026-10-11T10:00:00Z"}],nextCursor:"40"});
 const view=render(<LangProvider><AdminView/></LangProvider>);
 const detail=await screen.findByRole("link",{name:"Détail"});
 expect(decodeURIComponent(detail.getAttribute("href")!)).toContain("returnTo=/account/admin/runs?site=atelier.example&status=FAILED&cursor=42");
 expect(screen.getByLabelText("Site (nom d’hôte exact)")).toHaveValue("atelier.example");
 fireEvent.change(screen.getByLabelText("Site (nom d’hôte exact)"),{target:{value:"other.example"}});
 fireEvent.click(screen.getByRole("button",{name:"Appliquer les filtres"}));
 expect(nav.push.mock.lastCall?.[0]).toContain("site=other.example");
 expect(nav.push.mock.lastCall?.[0]).not.toContain("cursor=");
 nav.query="site=previous.example";view.rerender(<LangProvider><AdminView/></LangProvider>);
 expect(screen.getByLabelText("Site (nom d’hôte exact)")).toHaveValue("previous.example");
});
it.each(["fr","en"] as const)("keeps the shared administration and safe detail return in %s",async lang=>{
 nav.query="returnTo="+encodeURIComponent("/account/admin/runs?site=atelier.example&cursor=42");
 api.mockResolvedValue({id:"41",site:"atelier.example",status:"FAILED",attempts:1,modules:{http:"COMPLETED"}});
 render(<LangProvider initialLang={lang}><AdminView runId="41"/></LangProvider>);
 await screen.findByRole("heading",{name:"atelier.example"});
 expect(screen.getByRole("link",{name:lang==="fr"?"Retour à l’administration":"Back to administration"})).toHaveAttribute("href",(lang==="en"?"/en":"")+"/account/admin/runs?site=atelier.example&cursor=42");
 const navigation=screen.getByRole("navigation",{name:"Administration"});
 expect(navigation.querySelectorAll("a")).toHaveLength(5);
 expect(navigation.querySelector('[aria-current="page"]')).toHaveTextContent(lang==="fr"?"Analyses":"Analyses");
});

it("loads recorded collector causes without opening the full report", async () => {
 api.mockImplementation(async (path: string) => path.endsWith("/report")
  ? {scores:{coverage:{checks:[{module:"ssl",state:"UNAVAILABLE",reason:"POLICY_DISABLED"}]}}}
  : {id:"41",site:"atelier.example",status:"COMPLETED",attempts:1,reportAvailable:true,modules:{ssl:"FAILED"}});
 render(<LangProvider><AdminView runId="41"/></LangProvider>);
 await screen.findByText("Collecte désactivée par la politique Argos", {exact:false});
 expect(screen.queryByRole("heading",{name:"Report fixture"})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Ouvrir le rapport"}));
 await screen.findByRole("heading",{name:"Report fixture"});
});
