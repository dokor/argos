// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import { accountFetch } from "@/lib/account-client";
import type { UsageTimeline as Timeline } from "@/lib/usage-timeline";
import UsageTimeline from "./UsageTimeline";

const session = vi.hoisted(() => ({ invalidate: vi.fn() }));
vi.mock("@/components/account/AccountSession", () => ({ useAccountSession: () => session }));
vi.mock("@/lib/account-client", () => ({ accountFetch: vi.fn() }));
const sample: Timeline = { timezone: "UTC", snapshotAt: "2026-10-17T10:00:00Z", coverageFrom: "2026-10-01T00:00:00Z", undatedCredits: 1, granularity: "DAY", dimension: "GLOBAL", total: 5,
  series: [{ key: "10", label: "example.com", total: 3 }, { key: "11", label: "www.example.com", total: 2 }],
  buckets: [{ from: "2026-09-30", until: "2026-10-01", total: 0, values: {} }, { from: "2026-10-15", until: "2026-10-16", total: 5, values: { "10": 3, "11": 2 } }],
  options: [{ key: "10", label: "example.com", total: 3 }, { key: "11", label: "www.example.com", total: 2 }], moreOptions: false };
beforeEach(() => { vi.mocked(accountFetch).mockReset().mockResolvedValue(sample); session.invalidate.mockClear(); });

it.each(["fr", "en"] as const)("exposes period details on focus and an equivalent table in %s", async lang => {
  render(<LangProvider initialLang={lang}><UsageTimeline timezone="UTC"/></LangProvider>);
  expect(await screen.findByText(lang === "fr" ? "crédits consommés" : "credits consumed", { exact: false })).toBeInTheDocument();
  const bars = screen.getAllByRole("button", { name: lang === "fr" ? /Afficher le détail/ : /Show detail/ });
  fireEvent.focus(bars[1]); expect(screen.getByRole("status")).toHaveTextContent("5");
  const table = screen.getByRole("table", { hidden: true });
  expect(within(table).getAllByText("—")).toHaveLength(1);
  expect(screen.getByText(lang === "fr" ? /débits historiques sans date/ : /historical debits without a date/)).toBeInTheDocument();
});
it("changes granularity, filters multiple exact hosts, searches targets and resets the selection", async () => {
  render(<UsageTimeline timezone="UTC"/>); await screen.findByText("crédits consommés", { exact: false });
  fireEvent.change(screen.getByLabelText("Échelle de temps"), { target: { value: "MONTH" } });
  await waitFor(() => expect(accountFetch).toHaveBeenLastCalledWith(expect.stringContaining("granularity=MONTH"), "GET", undefined, expect.any(AbortSignal)));
  fireEvent.change(screen.getByLabelText("Ventilation"), { target: { value: "DOMAIN" } });
  fireEvent.click(screen.getByText("Isoler des sites ou URL"));
  const first = await screen.findByRole("checkbox", { name: /example.com 3/ }); fireEvent.click(first);
  await waitFor(() => expect(accountFetch).toHaveBeenLastCalledWith(expect.stringContaining("filter=10"), "GET", undefined, expect.any(AbortSignal)));
  fireEvent.click(await screen.findByRole("checkbox", { name: /www.example.com 2/ }));
  await waitFor(() => expect(accountFetch).toHaveBeenLastCalledWith(expect.stringContaining("filter=10&filter=11"), "GET", undefined, expect.any(AbortSignal)));
  fireEvent.change(screen.getByLabelText("Rechercher une cible"), { target: { value: "www" } }); fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
  await waitFor(() => expect(accountFetch).toHaveBeenLastCalledWith(expect.stringContaining("q=www"), "GET", undefined, expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole("button", { name: "Effacer la sélection" }));
  await waitFor(() => expect(String(vi.mocked(accountFetch).mock.calls.at(-1)?.[0])).not.toMatch(/filter=|q=/));
});
it("distinguishes loading, failure, retry and a genuinely empty selection", async () => {
  let resolve!: (value: Timeline) => void;
  vi.mocked(accountFetch).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  render(<UsageTimeline timezone="UTC"/>); expect(screen.getByRole("status")).toHaveTextContent("Chargement");
  await act(async () => { resolve({ ...sample, total: 0, series: [] }); });
  expect(screen.getByRole("heading", { name: "Aucun débit enregistré pour cette sélection" })).toBeInTheDocument();
  vi.mocked(accountFetch).mockRejectedValueOnce(new Error("unavailable"));
  act(() => { window.dispatchEvent(new Event("argos-usage-refresh")); });
  expect(await screen.findByRole("alert")).toHaveTextContent("n’a pas pu être chargé");
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
});
it("ignores stale results when a filter changes and aborts requests on unmount", async () => {
  let resolve!: (value: Timeline) => void;
  vi.mocked(accountFetch).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const view = render(<UsageTimeline timezone="UTC"/>);
  const signal = vi.mocked(accountFetch).mock.calls[0][3]!;
  fireEvent.change(screen.getByLabelText("Échelle de temps"), { target: { value: "YEAR" } });
  expect(signal.aborted).toBe(true);
  await screen.findByText("crédits consommés", { exact: false });
  await act(async () => { resolve({ ...sample, total: 999 }); });
  expect(screen.queryByText("999")).not.toBeInTheDocument();
  const lastSignal = vi.mocked(accountFetch).mock.calls.at(-1)![3]!; view.unmount(); expect(lastSignal.aborted).toBe(true);
});
