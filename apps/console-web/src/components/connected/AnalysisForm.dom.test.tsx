// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AnalysisForm from "./AnalysisForm";
import { accountFetch, AccountClientError } from "@/lib/account-client";
const {push,session}=vi.hoisted(()=>({push:vi.fn(),session:{profile:{verified:true},denied:false,invalidate:vi.fn(),refreshUsage:vi.fn(),usage:{canLaunch:true}}}));
vi.mock("next/navigation",()=>({useRouter:()=>({push})}));
vi.mock("@/components/account/AccountSession",()=>({useAccountSession:()=>session}));
vi.mock("@/lib/account-client",()=>({accountFetch:vi.fn(),AccountClientError:class extends Error {constructor(public code:string,public status:number){super(code);}}}));
const profiles={defaultProfileId:"server-default-v1",items:[{id:"server-default-v1"}]};
beforeEach(()=>{push.mockReset();vi.mocked(accountFetch).mockReset();session.usage.canLaunch=true;session.denied=false;});
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
  view.unmount();resolve({runId:"42"});
  await waitFor(()=>expect(vi.mocked(accountFetch).mock.calls.filter(call=>call[0]==="analyses")).toHaveLength(1));
  expect(push).not.toHaveBeenCalled();
});
