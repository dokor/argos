// @vitest-environment jsdom
import {beforeEach, expect, it, vi} from "vitest";
import {render, screen, fireEvent, waitFor, within} from "@/test/render";
import {LangProvider} from "@/lib/i18n/LangProvider";
import {AccountClientError} from "@/lib/account-client";
import QueueView from "./QueueView";
const state = vi.hoisted(() => ({api: vi.fn(), push: vi.fn(), query: "", session: {ready:true, denied:false, profile:{admin:true,verified:true}}}));
vi.mock("next/navigation", () => ({useSearchParams: () => new URLSearchParams(state.query), useRouter: () => ({push:state.push})}));
vi.mock("@/lib/account-client", async original => ({...await original<typeof import("@/lib/account-client")>(), accountFetch:state.api}));
vi.mock("@/components/account/AccountSession", () => ({useAccountSession: () => state.session}));
const batch = {type:"BATCH",id:"7",site:"www.example.com",displayUrl:null,userId:"42",resolvedUserId:"42",userDisplayName:"Alice",userEmail:"alice@example.com",status:"RUNNING",diagnostic:"STALE",createdAt:"2026-10-17T08:00:00Z",startedAt:"2026-10-17T08:01:00Z",waitSeconds:60,elapsedSeconds:1300,pageCount:3,queuedChildren:2,runningChildren:1,batchId:null};
const snapshot = {items:[batch],hasMore:true,page:2,counts:[{type:"DISCOVERY",queued:4,running:1},{type:"BATCH",queued:2,running:1},{type:"RUN",queued:8,running:2}],snapshotAt:"2026-10-17T10:00:00Z",stuckSeconds:1200};
beforeEach(() => {
  state.query=""; state.push.mockReset(); state.session.profile={admin:true,verified:true}; state.session.denied=false;
  state.api.mockReset(); state.api.mockImplementation(async (path:string) => path.startsWith("admin/queue/tasks?") ? snapshot : {items:[],nextCursor:null});
});
it.each(["fr","en"] as const)("shows separate units and grouped tasks, and preserves server filters in %s", async lang => {
  state.query="site=www.example.com&status=RUNNING&sort=started&page=2";
  const view=render(<LangProvider initialLang={lang}><QueueView/></LangProvider>);
  await screen.findByText("www.example.com", {selector:"strong"});
  const table=screen.getByRole("table"); expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(screen.getByText(lang === "fr" ? "À vérifier · seuil de reprise dépassé" : "Needs attention · recovery threshold exceeded")).toBeInTheDocument();
  expect(screen.getByRole("link",{name:"Alice"}).getAttribute("href")).toContain("returnTo=");
  expect(decodeURIComponent(within(table).getByRole("link",{name:lang==="fr"?"Détail":"Details"}).getAttribute("href")!)).toContain("returnTo=/account/admin/queue?site=www.example.com&status=RUNNING&sort=started&page=2");
  fireEvent.click(screen.getByRole("button",{name:lang==="fr"?"Page suivante":"Next page"}));
  expect(state.push.mock.lastCall?.[0]).toContain("page=3");
  fireEvent.click(screen.getByRole("button",{name:lang==="fr"?"Appliquer les filtres":"Apply filters"}));
  expect(state.push.mock.lastCall?.[0]).not.toContain("page=");
  state.query="type=RUN&user=anonymous&page=3"; view.rerender(<LangProvider initialLang={lang}><QueueView/></LangProvider>);
  await waitFor(() => expect(state.api).toHaveBeenCalledWith("admin/queue/tasks?type=RUN&user=anonymous&page=3","GET",undefined,expect.any(AbortSignal)));
});
it("never requests queue data for ordinary or unverified users", () => {
  state.session.profile.admin=false; const view=render(<QueueView/>);
  expect(state.api).not.toHaveBeenCalled(); expect(screen.getByRole("alert")).toBeInTheDocument();
  state.session.profile={admin:true,verified:false}; view.rerender(<QueueView/>);
  expect(state.api).not.toHaveBeenCalled();
});
it("clears private rows when server authorization is revoked on refresh", async () => {
  render(<QueueView/>); await screen.findByText("www.example.com", {selector:"strong"});
  state.api.mockRejectedValue(new AccountClientError("admin_required",403));
  fireEvent.click(screen.getByRole("button",{name:"Actualiser"}));
  await screen.findByRole("alert"); expect(screen.queryByText("www.example.com", {selector:"strong"})).not.toBeInTheDocument();
});
it("keeps a terminal batch detail and links its child URLs back to the filtered queue", async () => {
  const back="/account/admin/queue?type=BATCH&page=2"; state.query="returnTo="+encodeURIComponent(back);
  state.api.mockResolvedValue({...batch,status:"CANCELED",diagnostic:"TERMINAL",snapshotAt:snapshot.snapshotAt,children:[{...batch,type:"RUN",id:"9",batchId:"7",status:"CANCELED",diagnostic:"TERMINAL",displayUrl:"https://www.example.com/contact"}]});
  render(<QueueView type="BATCH" id="7"/>);
  await screen.findByText("https://www.example.com/contact");
  expect(screen.getByRole("link",{name:"Retour à la file d’attente"})).toHaveAttribute("href",back);
  expect(document.querySelector('a[href^="/account/admin/runs/9"]')?.getAttribute("href")).toContain(encodeURIComponent(back));
  expect(state.api).toHaveBeenCalledWith("admin/queue/tasks/BATCH/7","GET",undefined,expect.any(AbortSignal));
});
it("distinguishes empty results, refresh errors and invalid URLs", async () => {
  state.api.mockResolvedValue({...snapshot,items:[]}); const view=render(<QueueView/>);
  await screen.findByText("Aucun traitement ne correspond à ces filtres.");
  state.api.mockRejectedValue(new Error("network")); fireEvent.click(screen.getByRole("button",{name:"Actualiser"}));
  await screen.findByRole("alert"); expect(screen.queryByText("Aucun traitement ne correspond à ces filtres.")).not.toBeInTheDocument();
  state.query="type=evil"; view.rerender(<QueueView/>);
  expect(screen.getByRole("alert")).toHaveTextContent("Vérifiez les filtres");
});
