// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/test/render";
import { LangProvider } from "@/lib/i18n/LangProvider";
import { AccountClientError } from "@/lib/account-client";
import MeasurementControl from "./MeasurementControl";
const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/account-client", async original => ({ ...await original<typeof import("@/lib/account-client")>(), accountFetch: api }));
const state = { enabled: false, requestedEnabled: false, deploymentAllowed: true, bffAllowed: true, version: 0, lastCollectedAt: null };
beforeEach(() => { api.mockReset().mockResolvedValue(state); });
it.each(["fr", "en"] as const)("requires explicit activation confirmation, saves and disables in %s", async lang => {
  const changed=vi.fn(), denied=vi.fn();
  api.mockImplementation(async (_path, method, body) => method === "PATCH" ? { ...state, enabled: body.enabled, requestedEnabled: body.enabled, version: body.expectedVersion+1 } : state);
  render(<LangProvider initialLang={lang}><MeasurementControl onChanged={changed} onDenied={denied}/></LangProvider>);
  const toggle=await screen.findByRole("switch"); expect(toggle).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toHaveAttribute("aria-checked","true"));
  expect(api).toHaveBeenCalledWith("admin/analytics/settings","PATCH",{enabled:true,expectedVersion:0,confirmation:true});
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toHaveAttribute("aria-checked","false"));
  expect(changed).toHaveBeenCalledTimes(2);expect(denied).not.toHaveBeenCalled();
});
it.each(["deploymentAllowed", "bffAllowed"])("shows the blocking guard %s and prevents a fake activation", async key => {
  api.mockResolvedValue({...state,[key]:false});
  render(<MeasurementControl onChanged={vi.fn()} onDenied={vi.fn()}/>);
  expect(await screen.findByRole("switch")).toBeDisabled();
  expect(screen.getByText(/Indisponible · bloquée/)).toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});
it("keeps the previous state visible on conflicts and requires a refresh", async () => {
  api.mockImplementation(async (_path, method) => {if(method==="PATCH")throw new AccountClientError("version_conflict",409);return state;});
  const changed=vi.fn();render(<MeasurementControl onChanged={changed} onDenied={vi.fn()}/>);
  const toggle=await screen.findByRole("switch");fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(toggle);
  expect(await screen.findByRole("alert")).toHaveTextContent("Le réglage a changé");
  expect(toggle).toHaveAttribute("aria-checked","false");expect(changed).not.toHaveBeenCalled();
});
it("propagates backend role revocation", async () => {
  api.mockRejectedValue(new AccountClientError("admin_required",403));const denied=vi.fn();
  render(<MeasurementControl onChanged={vi.fn()} onDenied={denied}/>);
  await waitFor(()=>expect(denied).toHaveBeenCalled());expect(screen.queryByRole("switch")).not.toBeInTheDocument();
});
