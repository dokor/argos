// @vitest-environment jsdom
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import AccountSession, { useAccountSession } from "./AccountSession";
import { accountFetch, AccountClientError } from "@/lib/account-client";
vi.mock("./AccountView.module.scss", () => ({ default: {} }));
vi.mock("@/lib/account-client",()=>({accountFetch:vi.fn(),AccountClientError:class extends Error {constructor(public code:string,public status:number){super(code);}}}));
const profile={verified:true,displayName:"Fixture",email:"fixture@example.com"};
const usage={offer:"FREE",used:0,reserved:1,limit:null,canLaunch:true,period:"2026-10",timezone:"UTC",startsAt:"2026-10-01T00:00:00Z",resetsAt:"2026-11-01T00:00:00Z"};
function Probe({name}:{name:string}) {const s=useAccountSession();return <div>{s.profile && <span>{name}: {s.usage ? s.usage.reserved : s.usageError ? "unavailable" : "waiting"}</span>}<button onClick={s.refreshUsage}>{name}</button></div>;}
beforeEach(()=>{vi.mocked(accountFetch).mockReset();vi.mocked(accountFetch).mockImplementation(async path=>path==="me" ? profile : usage);});
afterEach(()=>vi.useRealTimers());
it("shares one consumption read and clears it immediately on revoked session",async()=>{
  render(<AccountSession><Probe name="one"/><Probe name="two"/></AccountSession>);
  await screen.findByText("one: 1");expect(vi.mocked(accountFetch).mock.calls.filter(c=>c[0]==="usage")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button",{name:"one"}));await waitFor(()=>expect(vi.mocked(accountFetch).mock.calls.filter(c=>c[0]==="usage")).toHaveLength(2));
  act(()=>window.dispatchEvent(new Event("argos-account-invalid")));expect(screen.queryByText("one: 1")).not.toBeInTheDocument();
});
it("a usage service error does not remove a valid identity or hide reading access",async()=>{
  vi.mocked(accountFetch).mockImplementation(async path=>{if(path==="usage") throw new AccountClientError("account_unavailable",503);return profile;});
  render(<AccountSession><Probe name="reader"/></AccountSession>);expect(await screen.findByText("reader: unavailable")).toBeInTheDocument();
});
it("refreshes at the calendar boundary without adding an activity request",async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-31T23:59:59Z"));let reads=0;
  vi.mocked(accountFetch).mockImplementation(async path=>path==="me" ? profile : {...usage,reserved:++reads,resetsAt:reads===1 ? usage.resetsAt : "2026-12-01T00:00:00Z"});
  render(<AccountSession><Probe name="reset"/></AccountSession>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});expect(screen.getByText("reset: 1")).toBeInTheDocument();
  await act(async()=>{await vi.advanceTimersByTimeAsync(1200);});expect(screen.getByText("reset: 2")).toBeInTheDocument();
  expect(vi.mocked(accountFetch).mock.calls.map(c=>c[0])).toEqual(["me","usage","usage"]);
});
it("aborts a pending usage read on unmount",async()=>{
  let signal:AbortSignal|undefined;
  vi.mocked(accountFetch).mockImplementation(async(path,_method,_body,s)=>{if(path==="me") return profile;signal=s;return new Promise(()=>{});});
  const view=render(<AccountSession><Probe name="abort"/></AccountSession>);await waitFor(()=>expect(signal).toBeDefined());view.unmount();expect(signal?.aborted).toBe(true);
});

it("refreshes the profile without unmounting content and cannot restore a revoked session",async()=>{
  function Identity(){const session=useAccountSession();return session.ready&&session.profile&&!session.denied ? <input aria-label="preserved form" defaultValue={session.profile.displayName}/> : <p>No access</p>;}
  render(<AccountSession><Identity/></AccountSession>);
  const input=await screen.findByLabelText("preserved form");fireEvent.change(input,{target:{value:"unsaved input"}});
  let resolve!:(value:unknown)=>void;
  vi.mocked(accountFetch).mockImplementation(async path=>path==="me" ? new Promise(r=>{resolve=r;}) : usage);
  act(()=>window.dispatchEvent(new Event("argos-account-profile")));
  expect(screen.getByLabelText("preserved form")).toBe(input);expect(input).toHaveValue("unsaved input");
  act(()=>window.dispatchEvent(new Event("argos-account-invalid")));
  await act(async()=>resolve(profile));expect(screen.queryByLabelText("preserved form")).not.toBeInTheDocument();
});

it("leaves loading on invalidation even when the initial profile request is still pending",async()=>{
  let resolve!:(value:unknown)=>void;
  vi.mocked(accountFetch).mockImplementation(async()=>new Promise(r=>{resolve=r;}));
  function State(){const s=useAccountSession();return <p>{s.ready ? s.denied ? "Denied" : "Ready" : "Loading"}</p>;}
  render(<AccountSession><State/></AccountSession>);expect(screen.getByText("Loading")).toBeInTheDocument();
  act(()=>window.dispatchEvent(new Event("argos-account-invalid")));expect(screen.getByText("Denied")).toBeInTheDocument();
  await act(async()=>resolve(profile));expect(screen.getByText("Denied")).toBeInTheDocument();
});
