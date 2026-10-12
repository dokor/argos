// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import HistoryView, { HistoryChart } from "./HistoryView";
import PublicReportHistory from "./PublicReportHistory";
import type { HistoryItem } from "./history";
import fr from "@/lib/i18n/fr.json";
import en from "@/lib/i18n/en.json";
const state=vi.hoisted(()=>({lang:"fr",path:"/report/"+"t".repeat(43),session:{profile:{verified:true},ready:true,denied:false,invalidate:vi.fn(),usage:null}}));
vi.mock("./AccountSession",()=>({useAccountSession:()=>state.session,PersonalNavigation:()=>null}));
vi.mock("@/lib/i18n/LangContext",()=>({useLang:()=>({lang:state.lang,t:state.lang==="fr" ? fr : en})}));
vi.mock("next/navigation",()=>({usePathname:()=>state.path}));
vi.mock("@/components/LocalizedLink",()=>({default:({href,children}:{href:string;children:React.ReactNode})=><a href={href}>{children}</a>}));
vi.mock("@/components/site/SiteNav",()=>({default:()=>null}));
vi.mock("@/components/site/SiteFooter",()=>({default:()=>null}));
vi.mock("@/components/AuditForm",()=>({default:({initialUrl,mode}:{initialUrl:string;mode:string})=><div data-testid="audit-form">{mode}: {initialUrl}</div>}));
vi.mock("@/lib/account-client",()=>({accountFetch:vi.fn(),AccountClientError:class extends Error {constructor(public code:string,public status:number){super(code);}}}));
const context={siteId:"7",siteUrlId:"9",normalizedUrl:"https://example.com/path"};
const item=(runId:string,reason:NonNullable<HistoryItem["comparison"]>["reason"]="COMPARABLE"):HistoryItem=>({runId,status:"COMPLETED",createdAt:"2026-10-11T07:00:00Z",finishedAt:null,reportAvailable:true,publishedAt:"2026-10-11T07:01:00Z",expiresAt:null,globalScore:80,scoringVersion:11,coverage:1,provisional:false,comparison:{reason,globalDelta:30,domains:[],contributions:[],coverageChanged:false}});
beforeEach(()=>{vi.mocked(accountFetch).mockReset();state.lang="fr";state.session.denied=false;state.path="/report/"+"t".repeat(43);});
it("loads owner history, pages older runs and pre-fills a personal rerun",async()=>{
  vi.mocked(accountFetch).mockImplementation(async path=>({context,items:[item(path.includes("cursor") ? "1" : "2")],nextCursor:path.includes("cursor") ? null : "2"}));
  render(<HistoryView urlId="9"/>);
  expect(await screen.findByText("+30 points")).toBeInTheDocument();
  expect(screen.getByRole("link",{name:"Ouvrir le rapport"})).toHaveAttribute("href","/account/runs/2");
  fireEvent.click(screen.getByRole("button",{name:"Analyser à nouveau cette URL"}));
  expect(screen.getByTestId("audit-form")).toHaveTextContent("personal: https://example.com/path");
  fireEvent.click(screen.getByRole("button",{name:"Plus anciennes"}));
  await waitFor(()=>expect(screen.getByRole("link",{name:"Ouvrir le rapport"})).toHaveAttribute("href","/account/runs/1"));
  expect(accountFetch).toHaveBeenLastCalledWith("urls/9/history?cursor=2","GET",undefined,expect.any(AbortSignal));
});
it("never displays a delta or joins a curve across incompatible evidence",async()=>{
  vi.mocked(accountFetch).mockResolvedValue({context,items:[item("2","METHODOLOGY_CHANGED"),item("1")],nextCursor:null});
  const view=render(<HistoryView urlId="9"/>);
  expect(await screen.findByText("Méthode de calcul différente")).toBeInTheDocument();
  expect(view.container.querySelectorAll('[data-segment="comparable"]')).toHaveLength(0);
  view.unmount();
  const chart=render(<HistoryChart items={[item("3"),item("2"),{...item("1"),globalScore:null}]}/>);
  expect(chart.container.querySelectorAll('[data-segment="comparable"]')).toHaveLength(1);
});
it("renders unknown legacy coverage, empty state, errors and English",async()=>{
  state.lang="en";vi.mocked(accountFetch).mockResolvedValue({context,items:[],nextCursor:null});
  const view=render(<HistoryView urlId="9"/>);
  expect(await screen.findByText(/No analyses for this URL/)).toBeInTheDocument();view.unmount();
  vi.mocked(accountFetch).mockResolvedValue({context,items:[{...item("1","EVIDENCE_MISSING"),scoringVersion:null,coverage:null,provisional:null}],nextCursor:null});
  const legacy=render(<HistoryView urlId="9"/>);expect(await screen.findByText("Scoring evidence missing")).toBeInTheDocument();expect(screen.queryByText("+30 points")).not.toBeInTheDocument();legacy.unmount();
  vi.mocked(accountFetch).mockRejectedValue(new AccountClientError("resource_unavailable",404));render(<HistoryView urlId="9"/>);
  expect(await screen.findByRole("alert")).toHaveTextContent("This history is unavailable");
});
it("immediately hides private data on revocation and aborts pending reads",async()=>{
  vi.mocked(accountFetch).mockResolvedValue({context,items:[item("2")],nextCursor:null});
  const view=render(<HistoryView urlId="9"/>);await screen.findByText("+30 points");
  const signal=vi.mocked(accountFetch).mock.calls[0][3];state.session.denied=true;view.rerender(<HistoryView urlId="9"/>);
  expect(screen.queryByText(context.normalizedUrl)).not.toBeInTheDocument();expect(signal?.aborted).toBe(true);
});
it("shared report navigation requires server ownership and disappears at logout",async()=>{
  vi.mocked(accountFetch).mockRejectedValue(new AccountClientError("resource_unavailable",404));
  const visitor=render(<PublicReportHistory/>);await waitFor(()=>expect(accountFetch).toHaveBeenCalled());
  expect(screen.queryByRole("link")).not.toBeInTheDocument();visitor.unmount();
  vi.mocked(accountFetch).mockResolvedValue(context);render(<PublicReportHistory/>);
  expect(await screen.findByRole("link",{name:"Historique de cette URL"})).toHaveAttribute("href","/account/urls/9/history");
  fireEvent(window,new Event("argos-account-invalid"));expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
