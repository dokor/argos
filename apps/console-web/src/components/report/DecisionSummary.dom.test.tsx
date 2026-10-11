// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@/lib/i18n/LangContext";
import ReportPage from "@/app/(fr)/report/[token]/ReportPage";
import historical from "./fixtures/historical-report.json";
import type { Report, Coverage } from "./types";
import { decisionCopy } from "./decisionCopy";
import { globalScore, domainScore, reportScope } from "./reportSummaryModel";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => window.location.pathname }));
vi.mock("@/lib/useIsAdmin", () => ({ useIsAdmin: () => false }));
const report = historical as Report;
const aggregate = { key: "global", measuredWeight: 40, expectedWeight: 100, ratio: .4, available: true, sufficient: false };
const coverage: Coverage = { version: "weighted-v1", threshold: .8, provisional: true, global: aggregate,
  domains: [{ ...aggregate, key: "performance" }, { ...aggregate, key: "security", available: false }],
  checks: [{ key: "ssl.grade", domain: "security", module: "ssl", weight: 10, state: "UNAVAILABLE", reason: "CHECK_MISSING", confidence: "UNKNOWN" },
    { key: "runtime.lcp", domain: "performance", module: "runtime", weight: 30, state: "BLOCKED_BY_ANTIBOT", reason: "ANTIBOT", confidence: "UNKNOWN" }] };
beforeEach(() => { window.history.replaceState(null, "", "/report/example"); Element.prototype.scrollIntoView = vi.fn(); });

for (const lang of ["fr", "en"] as const) {
  describe(`decision summary (${lang})`, () => {
    const copy = decisionCopy[lang];
    const show = (data: Report) => render(<LangProvider initialLang={lang}><ReportPage params={{ report: data }} /></LangProvider>);
    it("shows domain, safe scope, date, critical verdict and a single global score without AI", () => {
      const data = { ...report, site: { title: "A marketing page" }, url: "https://user:secret@example.com/catalog?token=secret#private" };
      const { container } = show(data);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(report.domain);
      expect(screen.getByText(/HTML/)).toHaveTextContent("A marketing page");
      expect(container.textContent).not.toContain("secret");
      expect(screen.getByText(copy.privacy)).toBeInTheDocument();
      expect(screen.getByText(copy.verdict.critical)).toBeInTheDocument();
      expect(screen.getByText(copy.favourable)).toBeInTheDocument();
      expect(screen.getAllByLabelText("Score 73/100")).toHaveLength(1);
      expect(container.querySelector("time")).toHaveAttribute("dateTime", report.generatedAt);
      expect(screen.getByRole("link", { name: copy.actions })).toBeInTheDocument();
    });
    it("qualifies partial anti-bot reports next to the score and separates all three measurement concepts", async () => {
      show({ ...report, scores: { ...report.scores, completeness: 75, coverage, calculation: { scoringVersion: 12, domains: [] } }, antiBot: { detected: true } });
      expect(screen.getByText(copy.provisional)).toBeInTheDocument();
      expect(within(screen.getByRole("heading", { level: 1 }).closest("section")!).getByText(copy.antiBot)).toBeInTheDocument();
      expect(within(screen.getByRole("heading", { level: 1 }).closest("section")!).getByText(/40 % —/)).toBeInTheDocument();
      const method = screen.getByRole("link", { name: copy.methodLink });
      await userEvent.click(method);
      const details = document.getElementById("report-method") as HTMLDetailsElement;
      expect(details.open).toBe(true);
      expect(document.getElementById("report-method-toggle")).toHaveFocus();
      expect(within(details).getByText("75 %")).toBeInTheDocument();
      expect(within(details).getByText(copy.completenessExplain)).toBeInTheDocument();
      expect(within(details).getByText(copy.confidenceExplain)).toBeInTheDocument();
      expect(within(details).getByText(`${copy.scoring}: 12`)).toBeInTheDocument();
      expect(within(details).getByText(copy.automaticLimit)).toBeInTheDocument();
      expect(within(details).getByText(copy.lighthouse)).toBeInTheDocument();
      expect(within(details).getByText(`${copy.missingModules}:`).parentElement).toHaveTextContent("ssl, runtime");
    });
    it("handles unavailable, historical, empty and absent AI states without invented certainty", async () => {
      show({ ...report, issues: [], summary: { oneLiner: "high", priorities: [], ai: null }, scores: { global: 0, globalAvailable: false, completeness: 50, byCategory: [] } });
      const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
      expect(within(hero).getByText(copy.notEvaluated)).toBeInTheDocument();
      expect(screen.queryByLabelText("Score 0/100")).not.toBeInTheDocument();
      expect(screen.getByText(copy.verdict.unavailable)).toBeInTheDocument();
      expect(screen.getByText(copy.empty)).toBeInTheDocument();
      expect(within(hero).getByText(copy.coverageUnknown)).toBeInTheDocument();
      await userEvent.click(screen.getByRole("link", { name: copy.methodLink }));
      const details = document.getElementById("report-method")!;
      expect(within(details).getByText("50 %")).toBeInTheDocument();
      expect(within(details).getByText(copy.coverageUnknown)).toBeInTheDocument();
      expect(screen.queryByText(/50 % —/)).not.toBeInTheDocument();
    });
    it("opens the action plan and domain selection through shared URL navigation", async () => {
      show(report);
      await userEvent.click(screen.getByRole("link", { name: copy.actions }));
      expect(window.location.search).toBe("?view=actions");
      await userEvent.click(screen.getByRole("button", { name: lang === "fr" ? "Vue d’ensemble" : "Overview" }));
      await userEvent.click(screen.getByRole("link", { name: lang === "fr" ? /^Sécurité/ : /^Security/ }));
      expect(window.location.search).toContain("view=technical");
      expect(window.location.search).toContain("domain=security");
      expect(screen.getByRole("combobox", { name: lang === "fr" ? "Domaine" : "Domain" })).toHaveValue("security");
    });
    it("does not claim a favourable diagnosis for an empty measured report", () => {
      show({ ...report, issues: [], summary: { oneLiner: "high", priorities: [] } });
      expect(screen.getByText(copy.verdict.empty)).toBeInTheDocument();
      expect(screen.getByText(copy.empty)).toBeInTheDocument();
    });
  });
}

describe("measurement availability and safe scope", () => {
  it("preserves measured zero and rejects invalid or explicitly unavailable scores", () => {
    expect(globalScore({ ...report, scores: { ...report.scores, global: 0 } })).toBe(0);
    for (const value of [NaN, Infinity, -1, 101]) expect(globalScore({ ...report, scores: { ...report.scores, global: value } })).toBeUndefined();
    expect(globalScore({ ...report, scores: { ...report.scores, coverage: { ...coverage, global: { ...aggregate, available: false } } } })).toBeUndefined();
    expect(domainScore(0, "security", coverage)).toBeUndefined();
  });
  it("does not expose credentials or query data from report scope", () => {
    expect(reportScope("https://user:secret@example.com/path?access=private#token")).toBe("https://example.com/path");
    expect(reportScope("javascript:alert(1)")).toBeUndefined();
    expect(reportScope("invalid")).toBeUndefined();
  });
});
