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
it.each(["fr","en"] as const)("renders global counts and pagination in %s",async lang=>{
 render(<LangProvider initialLang={lang}><AdminView/></LangProvider>);
 expect(await screen.findByRole("button",{name:lang==="fr"?"Consulter Alice":"View Alice"})).toBeInTheDocument();expect(screen.getByText("27")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:lang==="fr"?"Page suivante":"Next page"}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith("admin/users?limit=20&cursor=42","GET",undefined,expect.any(AbortSignal)));
 expect(document.querySelectorAll("h1")).toHaveLength(1);
});
it("does not load private data for a regular account and clears the view on revocation",async()=>{
 session.profile.admin=false;
 const view=render(<LangProvider><AdminView/></LangProvider>);expect(api).not.toHaveBeenCalled();expect(screen.getByRole("alert")).toHaveTextContent("administrateur");
 session.profile.admin=true;view.rerender(<LangProvider><AdminView/></LangProvider>);await screen.findByRole("button",{name:"Consulter Alice"});
 session.denied=true;view.rerender(<LangProvider><AdminView/></LangProvider>);expect(screen.queryByText("Alice")).not.toBeInTheDocument();
});
it("submits a confirmed explicit quota change and retains its success feedback",async()=>{
 render(<LangProvider><AdminView/></LangProvider>);
 fireEvent.click(await screen.findByRole("button",{name:"Consulter Alice"}));
 const limit=await screen.findByLabelText("Plafond individuel");fireEvent.change(limit,{target:{value:"0"}});
 fireEvent.click(screen.getByRole("checkbox"));
 fireEvent.click(screen.getByRole("button",{name:"Enregistrer"}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith("admin/users/42/entitlement","PATCH",{offer:"FREE",monthlyLimit:0,confirmed:true}));
 expect(await screen.findByText("Modification enregistrée et journalisée.")).toBeInTheDocument();
 await screen.findByLabelText("Plafond individuel");expect(screen.getByText("Modification enregistrée et journalisée.")).toBeInTheDocument();
});
it("shows service failures with a refresh path and denies after a server role refusal",async()=>{
 api.mockImplementation(async(path:string)=>{if(path==="admin/queue")return {queued:1,running:0};throw new AccountClientError("account_unavailable",503);});
 render(<LangProvider><AdminView/></LangProvider>);expect(await screen.findByRole("alert")).toHaveTextContent("indisponible");
 api.mockRejectedValue(new AccountClientError("admin_required",403));fireEvent.click(screen.getByRole("button",{name:"Actualiser"}));
 await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("administrateur"));expect(screen.queryByRole("button",{name:"Utilisateurs"})).not.toBeInTheDocument();
});
it("transfers the selected user into the analyses filter and supports empty results",async()=>{
 render(<LangProvider><AdminView/></LangProvider>);fireEvent.click(await screen.findByRole("button",{name:"Consulter Alice"}));
 await screen.findByLabelText("Plafond individuel");
 const buttons=screen.getAllByRole("button",{name:"Analyses"});fireEvent.click(buttons[1]);
 expect(await screen.findByText("Aucun résultat pour ces filtres.")).toBeInTheDocument();
 expect(screen.getByLabelText("Utilisateur")).toHaveValue("42");
 expect(api).toHaveBeenCalledWith("admin/runs?limit=20&user=42","GET",undefined,expect.any(AbortSignal));
});
