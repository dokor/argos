// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@/test/render";
import AnalysisForm from "./AnalysisForm";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { pendingAnalysis } from "@/lib/connected/analysis-recovery";
const {push,session}=vi.hoisted(()=>({push:vi.fn(),session:{profile:{verified:true},denied:false,invalidate:vi.fn(),refreshUsage:vi.fn(),usage:{canLaunch:true}}}));
const router={push};
vi.mock("next/navigation",()=>({useRouter:()=>router}));
vi.mock("@/components/account/AccountSession",()=>({useAccountSession:()=>session}));
vi.mock("@/lib/account-client",()=>({accountFetch:vi.fn(),AccountClientError:class extends Error {constructor(public code:string,public status:number){super(code);}}}));
const profiles={defaultProfileId:"server-default-v1",items:[{id:"server-default-v1"}]};
it("shows the same URL surprise without admitting a connected analysis", async () => {
  vi.mocked(accountFetch).mockResolvedValue(profiles);
  render(<AnalysisForm initialUrl="https://argos.lelouet.fr/" />);
  expect(screen.getByText("Qui audite l’auditeur ? Bien vu.")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Lancer l’analyse" })).toBeEnabled());
  expect(vi.mocked(accountFetch).mock.calls.some(call => call[0] === "analyses")).toBe(false);
});
it("shows an empty, labelled URL input with an example and never launches from the placeholder",async()=>{
  vi.mocked(accountFetch).mockResolvedValue(profiles);render(<AnalysisForm/>);
  const input=screen.getByPlaceholderText('https://www.exemple.fr/page');expect(input).toHaveValue('');expect(input).toHaveAccessibleName();
  await waitFor(()=>expect(accountFetch).toHaveBeenCalled());expect(vi.mocked(accountFetch).mock.calls.some(call=>call[0]==='analyses')).toBe(false);
});
it("recovers the exact admitted run after remount, including at exhausted quota, without posting again",async()=>{
  let accepted=false;
  vi.mocked(accountFetch).mockImplementation(async path=>{
    if(path==="analysis-profiles")return profiles;
    if(path.startsWith("analyses/"))return {runId:"42",status:"COMPLETED"};
    accepted=true;throw new AccountClientError("account_unavailable",503);
  });
  const first=render(<AnalysisForm initialUrl="https://example.com/path"/>);
  await waitFor(()=>expect(screen.getByRole("button",{name:"Lancer l’analyse"})).toBeEnabled());
  fireEvent.click(screen.getByRole("button",{name:"Lancer l’analyse"}));
  await screen.findByRole("button",{name:"Réessayer"});
  const key=pendingAnalysis()!.key;expect(accepted).toBe(true);
  first.unmount();session.usage.canLaunch=false;
  render(<AnalysisForm/>);
  await waitFor(()=>expect(push).toHaveBeenCalledWith("/account/runs/42"));
  expect(accountFetch).toHaveBeenCalledWith("analyses/"+key,"GET",undefined,expect.any(AbortSignal));
  expect(vi.mocked(accountFetch).mock.calls.filter(call=>call[0]==="analyses")).toHaveLength(1);
  expect(pendingAnalysis()).toBeNull();
});
it("keeps the original key when recovery finds no admission and does not submit automatically",async()=>{
  vi.mocked(accountFetch).mockImplementation(async path=>{
    if(path==="analysis-profiles")return profiles;
    if(path.startsWith("analyses/"))throw new AccountClientError("resource_unavailable",404);
    throw new AccountClientError("account_unavailable",503);
  });
  const first=render(<AnalysisForm initialUrl="https://example.com/path"/>);
  await waitFor(()=>expect(screen.getByRole("button",{name:"Lancer l’analyse"})).toBeEnabled());
  fireEvent.click(screen.getByRole("button",{name:"Lancer l’analyse"}));
  await screen.findByRole("button",{name:"Réessayer"});
  const key=pendingAnalysis()!.key;first.unmount();
  render(<AnalysisForm/>);
  await waitFor(()=>expect(screen.getByRole("button",{name:"Réessayer"})).toBeEnabled());
  expect(screen.getByLabelText("URL de la page")).toHaveValue("https://example.com/path");
  expect(vi.mocked(accountFetch).mock.calls.filter(call=>call[0]==="analyses")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button",{name:"Réessayer"}));
  await waitFor(()=>expect(vi.mocked(accountFetch).mock.calls.filter(call=>call[0]==="analyses")).toHaveLength(2));
  expect(vi.mocked(accountFetch).mock.calls.filter(call=>call[0]==="analyses").map(call=>call[4])).toEqual([key,key]);
});
it("does not admit if the pending intention cannot be saved",async()=>{
  vi.mocked(accountFetch).mockResolvedValue(profiles);
  const storage=vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new DOMException("Unavailable");});
  try {
    render(<AnalysisForm initialUrl="https://example.com"/>);
    await waitFor(()=>expect(screen.getByRole("button",{name:"Lancer l’analyse"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button",{name:"Lancer l’analyse"}));
    await screen.findByRole("alert");
    expect(vi.mocked(accountFetch).mock.calls.some(call=>call[0]==="analyses")).toBe(false);
  }finally{storage.mockRestore();}
});
beforeEach(()=>{sessionStorage.clear();push.mockReset();vi.mocked(accountFetch).mockReset();session.usage.canLaunch=true;session.denied=false;});
it("blocks double submission and uses only the catalogue profile for a private run",async()=>{
  let resolve:(value:unknown)=>void=()=>{};
  vi.mocked(accountFetch).mockImplementation(async path=>path==="analysis-profiles" ? profiles : new Promise(done=>{resolve=done;}));
  render(<AnalysisForm initialUrl="https://example.com/path"/>);
  await waitFor(()=>expect(screen.getByRole("button",{name:"Lancer l’analyse"})).toBeEnabled());
  const form=screen.getByLabelText("URL de la page").closest("form")!;
  fireEvent.submit(form);fireEvent.submit(form);
  expect(vi.mocked(accountFetch).mock.calls.filter(call=>call[0]==="analyses")).toHaveLength(1);
  expect(accountFetch).toHaveBeenLastCalledWith("analyses","POST",{url:"https://example.com/path",profileId:"server-default-v1"},undefined,expect.any(String));
  resolve({runId:"9223372036854775807"});
  await waitFor(()=>expect(push).toHaveBeenCalledWith("/account/runs/9223372036854775807"));
});
it("reuses the request key after a lost response even when that admission exhausted quota",async()=>{
  let attempts=0;
  vi.mocked(accountFetch).mockImplementation(async path=>{if(path==="analysis-profiles") return profiles;if(++attempts===1) throw new AccountClientError("account_unavailable",503);return {runId:"42"};});
  const view=render(<AnalysisForm initialUrl="https://example.com"/>);
  await waitFor(()=>expect(screen.getByRole("button",{name:"Lancer l’analyse"})).toBeEnabled());
  fireEvent.click(screen.getByRole("button",{name:"Lancer l’analyse"}));
  const retry=await screen.findByRole("button",{name:"Réessayer"});
  session.usage.canLaunch=false;view.rerender(<AnalysisForm initialUrl="https://example.com"/>);
  expect(screen.getByLabelText("URL de la page")).toHaveAttribute("readonly");
  fireEvent.click(retry);
  await waitFor(()=>expect(push).toHaveBeenCalledWith("/account/runs/42"));
  const calls=vi.mocked(accountFetch).mock.calls.filter(call=>call[0]==="analyses");
  expect(calls[0][4]).toBe(calls[1][4]);
});
it("does not admit a new request at zero quota or without a supported profile",async()=>{
  session.usage.canLaunch=false;vi.mocked(accountFetch).mockResolvedValue(profiles);
  render(<AnalysisForm/>);
  await screen.findByText(/server-default-v1/);
  expect(screen.getByRole("button",{name:"Lancer l’analyse"})).toBeDisabled();
  fireEvent.submit(screen.getByLabelText("URL de la page").closest("form")!);
  expect(vi.mocked(accountFetch).mock.calls.some(call=>call[0]==="analyses")).toBe(false);
});

it("does not redirect back after the user leaves while admission is pending",async()=>{
  let resolve:(value:unknown)=>void=()=>{};
  vi.mocked(accountFetch).mockImplementation(async path=>path==="analysis-profiles" ? profiles : new Promise(done=>{resolve=done;}));
  const view=render(<AnalysisForm initialUrl="https://example.com"/>);
  await waitFor(()=>expect(screen.getByRole("button",{name:"Lancer l’analyse"})).toBeEnabled());
  fireEvent.click(screen.getByRole("button",{name:"Lancer l’analyse"}));
  view.unmount();await act(async()=>{resolve({runId:"42"});});
  await waitFor(()=>expect(vi.mocked(accountFetch).mock.calls.filter(call=>call[0]==="analyses")).toHaveLength(1));
  expect(push).not.toHaveBeenCalled();
  expect(pendingAnalysis()?.url).toBe("https://example.com");
});
