// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@/test/render";
import { LangProvider } from "@/lib/i18n/LangProvider";
import { AccountClientError } from "@/lib/account-client";
import ProblemStatisticsView, { type ProblemStatistics } from "./ProblemStatisticsView";

const { api, session } = vi.hoisted(() => ({ api: vi.fn(), session: { ready: true, denied: false, profile: { verified: true, admin: true } } }));
vi.mock("@/lib/account-client", async original => ({ ...await original<typeof import("@/lib/account-client")>(), accountFetch: api }));
vi.mock("@/components/account/AccountSession", () => ({ useAccountSession: () => session }));
vi.mock("./AdminNavigation", () => ({ default: () => null }));
const metrics: ProblemStatistics = {
  from: "2026-07-19T00:00:00Z", until: "2026-10-17T00:00:00Z", generatedAt: "2026-10-17T10:00:00Z",
  scoringVersion: 13, scoringFingerprint: "a".repeat(64), coverageVersion: "weighted-coverage-v3", minimumGroupSize: 10,
  reports: 27, domains: 14, retainedDomains: 12, partialDomains: 2, excludedDomains: 2, pendingDomains: 1,
  findings: [{ key: "http.security.csp", category: "security", severity: "important", affectedDomains: 10, measuredDomains: 12, frequency: 10 / 12 }],
};
beforeEach(() => { session.ready = true; session.denied = false; session.profile = { verified: true, admin: true }; api.mockReset().mockResolvedValue(metrics); });

it.each(["fr", "en"] as const)("shows measured denominators, exclusions and method in %s", async lang => {
  render(<LangProvider initialLang={lang}><ProblemStatisticsView /></LangProvider>);
  await screen.findByText("http.security.csp");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(lang === "fr" ? "Les problèmes les plus fréquents" : "The most frequent problems");
  expect(screen.getByText(/10 \/ 12/)).toBeInTheDocument();
  expect(screen.getByText(lang === "fr" ? /83,3/ : /83\.3/)).toBeInTheDocument();
  expect(screen.getByText(/non représentatif|not representative/)).toBeInTheDocument();
  expect(screen.getByText(/temporairement incomplet|temporarily incomplete/)).toBeInTheDocument();
  expect(screen.getByText(lang === "fr" ? /1 domaine attend/ : /1 domain still awaits/)).toBeInTheDocument();
  expect(screen.getByText(metrics.scoringFingerprint)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: lang === "fr" ? "Problèmes détectés" : "Detected problems" })).toHaveAttribute("aria-current", "page");
  expect(api).toHaveBeenCalledWith("admin/problem-statistics?days=90", "GET", undefined, expect.any(AbortSignal));
});
it("distinguishes no reports from no publishable findings", async () => {
  api.mockResolvedValue({ ...metrics, findings: [], pendingDomains: 0 });
  render(<ProblemStatisticsView />);
  expect(await screen.findByText(/Aucun résultat diffusable/)).toBeInTheDocument();
  api.mockResolvedValue({ ...metrics, reports: 0, domains: 0, retainedDomains: 0, partialDomains: 0, excludedDomains: 0, pendingDomains: 0, findings: [] });
  fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
  expect(await screen.findByText(/Aucun rapport publié/)).toBeInTheDocument();
});
it("aborts old filters, hides stale numbers and retries errors", async () => {
  render(<ProblemStatisticsView />); await screen.findByText("http.security.csp");
  const signal = api.mock.calls[0][3];
  api.mockRejectedValue(new AccountClientError("account_unavailable", 503));
  fireEvent.change(screen.getByLabelText("Période"), { target: { value: "30" } });
  expect(signal.aborted).toBe(true); expect(screen.queryByText("http.security.csp")).not.toBeInTheDocument();
  expect(await screen.findByRole("alert")).toHaveTextContent("indisponibles");
  api.mockResolvedValue(metrics);
  fireEvent.change(screen.getByLabelText("Domaine d’analyse"), { target: { value: "security" } });
  await screen.findByText("http.security.csp");
  expect(api).toHaveBeenLastCalledWith("admin/problem-statistics?days=30&category=security", "GET", undefined, expect.any(AbortSignal));
});
it("does not load private metrics for ordinary or unverified accounts", () => {
  session.profile.admin = false; const view = render(<ProblemStatisticsView />);
  expect(api).not.toHaveBeenCalled(); expect(screen.getByRole("alert")).toHaveTextContent("administrateur");
  session.profile = { admin: true, verified: false }; view.rerender(<ProblemStatisticsView />);
  expect(api).not.toHaveBeenCalled();
});
it("ignores late data after session revocation and handles server role refusal", async () => {
  let resolve!: (data: ProblemStatistics) => void;
  api.mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = render(<ProblemStatisticsView />);
  session.denied = true; view.rerender(<ProblemStatisticsView />);
  await act(async () => resolve(metrics)); expect(screen.queryByText("http.security.csp")).not.toBeInTheDocument();
  view.unmount(); session.denied = false; api.mockRejectedValue(new AccountClientError("admin_required", 403));
  render(<ProblemStatisticsView />);
  await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
  expect(screen.getByRole("alert")).toHaveTextContent("administrateur");
});
