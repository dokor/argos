// @vitest-environment jsdom
import {beforeEach,it,expect,vi} from "vitest";
import {render,screen,fireEvent,waitFor,act} from "@/test/render";
import UsageView from "./UsageView";
vi.mock("./UsageTimeline",()=>({default:()=>null}));
import {LangProvider} from "@/lib/i18n/LangProvider";
import {accountFetch,AccountClientError} from "@/lib/account-client";
const mock=vi.hoisted(()=>({query:"",push:vi.fn(),session:{profile:{verified:true},denied:false,usageError:false,invalidate:vi.fn(),refreshUsage:vi.fn(),usage:null as null|{offer:string;period:string;timezone:string;startsAt:string;resetsAt:string;used:number;reserved:number;available:number|null;limit:number|null;canLaunch:boolean}}}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:mock.push}),useSearchParams:()=>new URLSearchParams(mock.query),usePathname:()=>"/account/usage"}));
vi.mock("@/components/account/AccountSession",()=>({useAccountSession:()=>mock.session}));
vi.mock("@/lib/account-client",()=>({accountFetch:vi.fn(),AccountClientError:class extends Error{constructor(public code:string,public status:number){super(code);}}}));
const event={runId:"9007199254740992",batchId:"9007199254740993",state:"COUNTED",period:"2026-10",createdAt:"2026-10-13T08:00:00Z",countedAt:"2026-10-13T08:05:00Z",releasedAt:null,url:"https://example.com/real-page"};
const page={items:[event],total:1,limit:20,offset:0,snapshotAt:"2026-10-14T08:00:00Z",period:"2026-10"};
beforeEach(()=>{mock.query="";mock.push.mockReset();mock.session.denied=false;mock.session.usageError=false;mock.session.refreshUsage.mockReset();mock.session.usage={offer:"FREE",period:"2026-10",timezone:"UTC",startsAt:"2026-10-01T00:00:00Z",resetsAt:"2026-11-01T00:00:00Z",used:2,reserved:1,available:17,limit:20,canLaunch:true};vi.mocked(accountFetch).mockReset();vi.mocked(accountFetch).mockResolvedValue(page);});
it.each(["fr","en"] as const)("shows human URL labels while preserving exact run/batch identifiers in %s",async lang=>{
 render(<LangProvider initialLang={lang}><UsageView/></LangProvider>);
 expect(screen.getByText("17")).toBeInTheDocument();expect(screen.getByText("FREE")).toBeInTheDocument();
 expect(await screen.findByRole("link",{name:"example.com/real-page"})).toHaveAttribute("href",(lang==="en"?"/en":"")+"/account/runs/"+event.runId);
 expect(screen.getByText(lang==="fr"?"octobre 2026":"October 2026")).toBeInTheDocument();
 expect(screen.getAllByText(lang==="fr"?"Non communiqué par le serveur":"Not provided by the server")).toHaveLength(2);
 const details=screen.getByText(lang==="fr"?"Identifiants techniques":"Technical identifiers").closest("details")!;expect(details).not.toHaveAttribute("open");fireEvent.click(details.querySelector("summary")!);
 const remaining=lang==="fr"?"crédits restants":"credits remaining";
 expect(screen.getByText("/ 20 "+remaining)).toBeInTheDocument();
 expect(screen.getByRole("meter",{name:remaining})).toHaveAttribute("value","17");
 expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext","17 / 20 "+remaining);
 expect(screen.getByText((lang==="fr"?"Lot de domaine":"Domain batch")+" #"+event.batchId)).toBeInTheDocument();expect(document.querySelector('time[datetime="2026-11-01T00:00:00Z"]')).not.toBeNull();
});
it("drains the server-provided balance as credits are reserved and consumed, and refills when released",async()=>{
 const usage=mock.session.usage!;
 Object.assign(usage,{used:0,reserved:0,available:20});
 const view=render(<UsageView/>);await screen.findByRole("table");
 expect(screen.getByRole("meter")).toHaveAttribute("value","20");
 Object.assign(usage,{reserved:3,available:17});view.rerender(<UsageView/>);
 expect(screen.getByRole("meter")).toHaveAttribute("value","17");
 Object.assign(usage,{used:3,reserved:0});view.rerender(<UsageView/>);
 expect(screen.getByRole("meter")).toHaveAttribute("value","17");
 Object.assign(usage,{used:19,reserved:1,available:0,canLaunch:false});view.rerender(<UsageView/>);
 expect(screen.getByRole("meter")).toHaveAttribute("value","0");
 expect(screen.getByRole("status")).toHaveTextContent("Le plafond est atteint ou réservé");
 Object.assign(usage,{reserved:0,available:1,canLaunch:true});view.rerender(<UsageView/>);
 expect(screen.getByRole("meter")).toHaveAttribute("value","1");
});
it("renders zero capacity without an invalid meter and preserves reading access",async()=>{
 Object.assign(mock.session.usage!,{limit:0,available:0,canLaunch:false});render(<UsageView/>);expect(await screen.findByRole("status")).toHaveTextContent("Votre plafond est fixé à zéro");expect(screen.queryByRole("meter")).not.toBeInTheDocument();expect(screen.getByRole("link",{name:/Contacter/})).toHaveAttribute("href","/feedback");
});
it("shows unlimited as a null limit rather than a made-up number",async()=>{
 Object.assign(mock.session.usage!,{limit:null,available:null});render(<UsageView/>);await screen.findByRole("table");expect(screen.getAllByText("Illimité")).toHaveLength(2);expect(screen.queryByRole("meter")).not.toBeInTheDocument();
});
it("filters historical months without changing the current monthly quota and resets pagination",async()=>{
 mock.query="period=2026-09&offset=40";vi.mocked(accountFetch).mockResolvedValue({...page,period:"2026-09",offset:40,total:41});render(<UsageView/>);
 await screen.findByRole("table");expect(screen.getByText("17")).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText("Mois du journal"),{target:{value:"2026-08"}});fireEvent.submit(screen.getByRole("button",{name:"Afficher"}).closest("form")!);
 expect(mock.push).toHaveBeenCalledWith("/account/usage?period=2026-08");expect(accountFetch).toHaveBeenCalledWith("usage/events?limit=20&offset=40&period=2026-09","GET",undefined,expect.any(AbortSignal));
});
it("clears the previous page immediately and ignores its response after a navigation",async()=>{
 let resolve!:(value:unknown)=>void;vi.mocked(accountFetch).mockImplementation(async()=>new Promise(r=>{resolve=r;}));
 const view=render(<UsageView/>);await waitFor(()=>expect(resolve).toBeDefined());const old=resolve;
 mock.query="period=2026-09";view.rerender(<UsageView/>);await waitFor(()=>expect(resolve).not.toBe(old));await act(async()=>old(page));expect(screen.queryByText("example.com/real-page")).not.toBeInTheDocument();
 await act(async()=>resolve({...page,items:[],total:0,period:"2026-09"}));expect(await screen.findByRole("heading",{name:"Aucune opération pour ce mois"})).toBeInTheDocument();
});
it("does not invent zero counters when usage is unavailable but still loads its ledger",async()=>{
 mock.session.usage=null;mock.session.usageError=true;render(<UsageView/>);expect(screen.getByRole("heading",{name:"Consommation indisponible"})).toBeInTheDocument();expect(await screen.findByText("example.com/real-page")).toBeInTheDocument();expect(screen.queryByText("17")).not.toBeInTheDocument();
});
it("provides a recoverable ledger error and refreshes both sources deliberately",async()=>{
 vi.mocked(accountFetch).mockRejectedValue(new AccountClientError("account_unavailable",503));render(<UsageView/>);expect(await screen.findByRole("alert")).toHaveTextContent("Impossible de charger");
 vi.mocked(accountFetch).mockResolvedValue(page);fireEvent.click(screen.getByRole("button",{name:"Réessayer"}));await screen.findByRole("table");fireEvent.click(screen.getByRole("button",{name:"Actualiser"}));expect(mock.session.refreshUsage).toHaveBeenCalledTimes(1);
});
it("removes private ledger data immediately after a revoked session",async()=>{
 const view=render(<UsageView/>);await screen.findByText("example.com/real-page");mock.session.denied=true;view.rerender(<UsageView/>);expect(screen.queryByText("example.com/real-page")).not.toBeInTheDocument();expect(screen.queryByText("FREE")).not.toBeInTheDocument();
});
it("rejects malformed filters without a read and offers the current month",async()=>{
 mock.query="period=2026-13&offset=-1";render(<UsageView/>);expect(screen.getByRole("heading",{name:"Les filtres du journal sont invalides."})).toBeInTheDocument();expect(accountFetch).not.toHaveBeenCalled();fireEvent.click(screen.getAllByRole("button",{name:"Mois courant"}).at(-1)!);expect(mock.push).toHaveBeenCalledWith("/account/usage");
});
