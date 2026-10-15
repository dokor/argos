// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import { AccountClientError } from "@/lib/account-client";
import AnalyticsView, { type ProductMetrics } from "./AnalyticsView";

const { api, session } = vi.hoisted(() => ({ api: vi.fn(), session: { ready: true, denied: false, profile: { verified: true, admin: true } } }));
vi.mock("@/lib/account-client", async original => ({ ...await original<typeof import("@/lib/account-client")>(), accountFetch: api }));
vi.mock("@/components/account/AccountSession", () => ({ useAccountSession: () => session, PersonalNavigation: () => null }));
vi.mock("@/components/site/SiteNav", () => ({ default: () => null }));
vi.mock("@/components/site/SiteFooter", () => ({ default: () => null }));
const delay = { sample: 0, excluded: 2, medianMs: null, p90Ms: null, p95Ms: null };
const metrics: ProductMetrics = { enabled: false, capped: true, from: "2026-10-01", until: "2026-10-13", cohort: { accepted: 24, started: 22, completed: 18, failed: 2, pending: 4, viewed: 15, completedViewed: 14 }, bySource: [], queue: delay, processing: delay, endToEnd: delay, events: [] };
beforeEach(() => { session.ready = true; session.denied = false; session.profile = { verified: true, admin: true }; api.mockReset().mockResolvedValue(metrics); });

it.each(["fr", "en"] as const)("renders metrics, empty results and unavailable delays in %s", async lang => {
  render(<LangProvider initialLang={lang}><AnalyticsView /></LangProvider>);
  await screen.findByText("24");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(lang === "fr" ? "Mesure produit" : "Product measurement");
  expect(screen.getAllByText(lang === "fr" ? "Indisponible" : "Unavailable")).toHaveLength(9);
  expect(screen.getByText(lang === "fr" ? "Aucune source pour cette période." : "No sources for this period.")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("100");
  expect(api).toHaveBeenCalledWith("admin/analytics?days=30", "GET", undefined, expect.any(AbortSignal));
});
it("never requests private metrics for unverified or ordinary accounts", () => {
  session.profile.verified = false;
  const view = render(<AnalyticsView />);
  expect(api).not.toHaveBeenCalled();
  session.profile = { verified: true, admin: false }; view.rerender(<AnalyticsView />);
  expect(api).not.toHaveBeenCalled(); expect(screen.getByRole("alert")).toHaveTextContent("administrateur");
});
it("aborts stale periods, clears data while loading, and supports refresh after errors", async () => {
  render(<AnalyticsView />); await screen.findByText("24");
  const signal = api.mock.calls[0][3];
  api.mockRejectedValue(new AccountClientError("account_unavailable", 503));
  fireEvent.change(screen.getByLabelText("Période glissante UTC"), { target: { value: "7" } });
  expect(signal.aborted).toBe(true);
  expect(screen.queryByText("24")).not.toBeInTheDocument();
  expect(await screen.findByRole("alert")).toHaveTextContent("indisponibles");
  api.mockResolvedValue(metrics); fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
  await screen.findByText("24");
  expect(api).toHaveBeenLastCalledWith("admin/analytics?days=7", "GET", undefined, expect.any(AbortSignal));
});
it("ignores late responses and hides metrics immediately after revocation", async () => {
  let resolve!: (data: ProductMetrics) => void;
  api.mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = render(<AnalyticsView />);
  const signal = api.mock.calls[0][3];
  session.denied = true; view.rerender(<AnalyticsView />);
  await act(async () => resolve(metrics));
  expect(signal.aborted).toBe(true); expect(screen.queryByText("24")).not.toBeInTheDocument();
});
it("denies and removes the controls after a backend role refusal", async () => {
  api.mockRejectedValue(new AccountClientError("admin_required", 403));
  render(<AnalyticsView />);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("administrateur"));
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});
