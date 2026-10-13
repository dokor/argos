// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import { accountFetch } from "@/lib/account-client";
import SitesView from "./SitesView";
const {push,session}=vi.hoisted(()=>({push:vi.fn(),session:{profile:{verified:true},ready:true,denied:false,invalidate:vi.fn()}}));
vi.mock("./AccountSession",()=>({useAccountSession:()=>session,PersonalNavigation:()=>null}));
vi.mock("next/navigation",()=>({useRouter:()=>({push,replace:vi.fn()}),useSearchParams:()=>new URLSearchParams(),usePathname:()=>"/account/sites"}));
vi.mock("@/components/site/SiteNav",()=>({default:()=>null}));
vi.mock("@/components/site/SiteFooter",()=>({default:()=>null}));
vi.mock("@/components/AuditForm",()=>({default:({initialUrl}:{initialUrl:string})=><p>Analyse: {initialUrl}</p>}));
vi.mock("@/lib/account-client",()=>({accountFetch:vi.fn(),AccountClientError:class extends Error {}}));
const site={siteId:"42",hostname:"example.com",urlCount:1,latestActivityAt:null,latestRunStatus:null};
beforeEach(()=>{window.scrollTo=vi.fn();vi.mocked(accountFetch).mockReset();push.mockReset();session.denied=false;session.profile.verified=true;});
it("adds without an audit, blocks duplicate submit and opens the existing site",async()=>{
  let finish:(value:unknown)=>void=()=>{};
  vi.mocked(accountFetch).mockImplementation(async(path,method)=>method==="POST" ? new Promise(resolve=>{finish=resolve;}) : {items:[],nextCursor:null});
  render(<SitesView/>);
  expect(await screen.findByText("Vous ne suivez encore aucun site.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("URL à suivre"),{target:{value:"https://example.com"}});
  const form=screen.getByLabelText("URL à suivre").closest("form")!;
  fireEvent.submit(form);fireEvent.submit(form);
  await waitFor(()=>expect(vi.mocked(accountFetch).mock.calls.filter(c=>c[1]==="POST")).toHaveLength(1));
  finish({site,created:false});
  await waitFor(()=>expect(push).toHaveBeenCalledWith("/account/sites/42"));
  expect(accountFetch).toHaveBeenCalledWith("sites","POST",{url:"https://example.com"});
});
it.each(["fr","en"] as const)("links a failed latest attempt and an earlier available report independently in %s",async lang=>{
  vi.mocked(accountFetch).mockImplementation(async path=>path==="sites/42" ? site : {items:[{siteUrlId:"9",normalizedUrl:"https://example.com/path?q=1",latestAttempt:{runId:"20",status:"FAILED",createdAt:"2026-10-11T08:00:00Z"},latestAvailableReport:{runId:"10",publishedAt:"2026-10-10T08:00:00Z",globalScore:null,provisional:true}}],nextCursor:null});
  render(<LangProvider initialLang={lang}><SitesView siteId="42"/></LangProvider>);
  const report=await screen.findByRole("link",{name:lang==="fr" ? "Ouvrir le rapport" : "Open report"});
  expect(report).toHaveAttribute("href",(lang==="en" ? "/en" : "")+"/account/runs/10");
  expect(screen.getByRole("link",{name:lang==="fr" ? "Ouvrir la progression" : "Open progress"})).toHaveAttribute("href",(lang==="en" ? "/en" : "")+"/account/runs/20");
  expect(screen.queryByText("0/100")).not.toBeInTheDocument();
  expect(screen.getByRole("link",{name:lang==="fr" ? "Analyser" : "Analyse"})).toHaveAttribute("href",(lang==="en" ? "/en" : "")+"/account/analyses/new?url=https%3A%2F%2Fexample.com%2Fpath%3Fq%3D1");
});
it("reads the next server page and hides private content on revocation",async()=>{
  vi.mocked(accountFetch).mockResolvedValue({items:[site],nextCursor:"42"});
  const view=render(<SitesView/>);
  fireEvent.click(await screen.findByRole("button",{name:"Page suivante"}));
  expect(push).toHaveBeenCalledWith("/account/sites?cursor=42");
  session.denied=true;view.rerender(<SitesView/>);
  expect(screen.queryByText("example.com")).not.toBeInTheDocument();
});
