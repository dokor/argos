// @vitest-environment jsdom
import {render,screen,waitFor,fireEvent} from "@testing-library/react";
import {beforeEach,afterEach,it,expect,vi} from "vitest";
import ReportPage from "@/app/(fr)/report/[token]/ReportPage";
import {LangProvider} from "@/lib/i18n/LangContext";
import {demoReport} from "@/components/marketing/reportDemoFixture";
import {accountFetch} from "@/lib/account-client";
import {safeAccountReturn} from "@/lib/account-return";
import {localizedPath} from "@/lib/i18n/routes";
vi.mock("next/navigation",()=>({usePathname:()=>window.location.pathname,useRouter:()=>({push:vi.fn()})}));
vi.mock("@/lib/account-client",()=>({accountFetch:vi.fn()}));
vi.mock("./ReportIntroductionEditor",()=>({default:()=>null}));
vi.mock("@/components/account/RunClaim",()=>({default:()=>null}));
vi.mock("@/components/account/PublicReportHistory",()=>({default:()=>null}));
const token="a".repeat(43),full=demoReport("fr"),summary={...full,access:"summary" as const,issues:full.issues.map(i=>({...i,evidence:undefined,recommendation:""}))};
beforeEach(()=>{window.history.replaceState(null,"","/share/"+token);vi.mocked(accountFetch).mockReset();vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({signedIn:false})));});
afterEach(()=>vi.unstubAllGlobals());
it("keeps public and shared details gated and only offers summary PDF",()=>{
 render(<LangProvider><ReportPage params={{report:summary}} shared/></LangProvider>);
 expect(screen.getAllByRole("term")).toHaveLength(13);
 expect(screen.getByRole("link",{name:"English"})).toHaveAttribute("href","/en/share/"+token);
 expect(screen.getByRole("link",{name:"Créer mon compte"})).toHaveAttribute("href","/account/register?returnTo="+encodeURIComponent("/share/"+token));
 expect(screen.queryByRole("option",{name:/preuves/i})).not.toBeInTheDocument();
 expect(screen.queryByText("Fonctionnalité Premium")).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:/Constats techniques/}));
 expect(screen.getByRole("link",{name:"Créer mon compte"})).toBeInTheDocument();
 expect(document.querySelectorAll("details[id^=finding-]")).toHaveLength(0);
});
it.each([false,true])("does not expose the private breadcrumb on a public or shared report (shared=%s)",shared=>{
 render(<ReportPage params={{report:summary}} shared={shared}/>);
 expect(screen.queryByRole("navigation",{name:"Fil d’Ariane"})).not.toBeInTheDocument();
 expect(screen.queryByRole("link",{name:"Mes sites"})).not.toBeInTheDocument();
});
it("loads shared details only through the authenticated endpoint",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({signedIn:true})));vi.mocked(accountFetch).mockResolvedValue(full);
 render(<LangProvider><ReportPage params={{report:summary}} shared/></LangProvider>);
 await waitFor(()=>expect(accountFetch).toHaveBeenCalledWith("shared-reports/"+token,"GET",undefined,expect.any(AbortSignal)));
 await waitFor(()=>expect(screen.queryByRole("link",{name:"Créer mon compte"})).not.toBeInTheDocument());
 fireEvent.click(screen.getByRole("button",{name:"Constats techniques"}));
 expect(document.querySelectorAll("details[id^=finding-]").length).toBeGreaterThan(0);
 expect(screen.queryByText("Relancer l’audit")).not.toBeInTheDocument();
});
it("preserves shared routes across login and language changes without accepting external redirects",()=>{
 expect(safeAccountReturn("/en/share/"+token)).toBe("/en/share/"+token);
 expect(localizedPath("/share/"+token,"en")).toBe("/en/share/"+token);
 expect(safeAccountReturn("https://evil.example/share/"+token)).toBe("/account/sites");
});
