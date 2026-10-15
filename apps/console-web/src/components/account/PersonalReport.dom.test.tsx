// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import PersonalReport from "./PersonalReport";
const {session}=vi.hoisted(()=>({session:{profile:{verified:true},ready:true,denied:false,invalidate:vi.fn()}}));
vi.mock("./AccountSession",()=>({useAccountSession:()=>session,PersonalNavigation:()=>null}));
vi.mock("next/navigation",()=>({usePathname:()=>"/account/runs/42",useSearchParams:()=>new URLSearchParams(window.location.search)}));
vi.mock("./PrivateDiagnostic",()=>({default:({report}:{report:{domain:string}})=><p>{report.domain}</p>}));
vi.mock("@/lib/account-client",()=>({accountFetch:vi.fn(),AccountClientError:class extends Error {constructor(public code:string,public status:number,public retryAfter=0){super(code);}}}));
beforeEach(()=>{vi.useFakeTimers();vi.mocked(accountFetch).mockReset();session.denied=false;session.invalidate.mockReset();Object.defineProperty(document,"hidden",{value:false,configurable:true});});
afterEach(()=>vi.useRealTimers());
it("never overlaps a slow GET and aborts its request when unmounted",async()=>{
  vi.mocked(accountFetch).mockReturnValue(new Promise(()=>{}));
  const view=render(<PersonalReport runId="42"/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(6000);});
  expect(accountFetch).toHaveBeenCalledTimes(1);
  const signal=vi.mocked(accountFetch).mock.calls[0][3];
  view.unmount();expect(signal?.aborted).toBe(true);
});
it("pauses while hidden and stops at a terminal failure",async()=>{
  Object.defineProperty(document,"hidden",{value:true,configurable:true});
  vi.mocked(accountFetch).mockResolvedValue({status:"FAILED",siteId:"7"});
  render(<PersonalReport runId="42"/>);
  expect(accountFetch).not.toHaveBeenCalled();
  Object.defineProperty(document,"hidden",{value:false,configurable:true});
  await act(async()=>{document.dispatchEvent(new Event("visibilitychange"));});
  expect(screen.getByText("Échouée")).toBeInTheDocument();
  await act(async()=>{await vi.advanceTimersByTimeAsync(6000);});
  expect(accountFetch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link",{name:"Retour au site"})).toHaveAttribute("href","/account/sites/7");
});
it("stops polling a loaded report and clears it on session revocation",async()=>{
  vi.mocked(accountFetch).mockImplementation(async path=>path.endsWith("/report") ? {domain:"private.example"} : {status:"COMPLETED",siteId:"7"});
  const view=render(<PersonalReport runId="42"/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.getByText("private.example")).toBeInTheDocument();
  await act(async()=>{await vi.advanceTimersByTimeAsync(6000);});
  expect(accountFetch).toHaveBeenCalledTimes(2);
  session.denied=true;view.rerender(<PersonalReport runId="42"/>);
  expect(screen.queryByText("private.example")).not.toBeInTheDocument();
});
it("does not retry a permanent 401 and caps 503 retries",async()=>{
  vi.mocked(accountFetch).mockRejectedValue(new AccountClientError("session_invalid",401));
  const view=render(<PersonalReport runId="42"/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
  expect(accountFetch).toHaveBeenCalledTimes(1);expect(session.invalidate).toHaveBeenCalled();
  view.unmount();vi.mocked(accountFetch).mockReset();
  vi.mocked(accountFetch).mockRejectedValue(new AccountClientError("account_unavailable",503));
  render(<PersonalReport runId="43"/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
  expect(accountFetch).toHaveBeenCalledTimes(4);
});

it.each(["EXPIRED","UNAVAILABLE"])("does not substitute another report when the exact run is %s",async reportAvailability=>{
  vi.mocked(accountFetch).mockResolvedValue({status:"COMPLETED",siteId:"7",reportAvailability});
  render(<PersonalReport runId="42"/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(6000);});
  expect(accountFetch).toHaveBeenCalledTimes(1);
  expect(screen.getByText(reportAvailability==="EXPIRED" ? "Ce rapport a expiré" : "Le rapport de cette analyse n’est pas disponible")).toBeInTheDocument();
});
it("reads a published report even if execution failed and never exposes the preceding run while navigating",async()=>{
  vi.mocked(accountFetch).mockImplementation(async path=>path.endsWith("/report") ? {domain:"exact.example"} : {status:"FAILED",siteId:"7",reportAvailability:"AVAILABLE"});
  const view=render(<PersonalReport runId="42"/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.getByText("exact.example")).toBeInTheDocument();
  expect(accountFetch).toHaveBeenCalledWith("runs/42/report","GET",undefined,expect.any(AbortSignal));
  vi.mocked(accountFetch).mockReturnValue(new Promise(()=>{}));
  view.rerender(<PersonalReport runId="43"/>);
  expect(screen.queryByText("exact.example")).not.toBeInTheDocument();
});
