// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LangProvider } from "@/lib/i18n/LangContext";
import ReportPage from "@/app/(fr)/report/[token]/ReportPage";
import { buildReportModel } from "./reportModel";
import { findingContent } from "./findingCatalogue";
import { localizedPath } from "@/lib/i18n/routes";
import historical from "./fixtures/historical-report.json";
import type { Report } from "./types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => window.location.pathname }));
vi.mock("@/lib/useIsAdmin", () => ({ useIsAdmin: () => false }));
const report = historical as Report;
const model = buildReportModel(report);
function restore(url: string) { act(() => { window.history.replaceState(null, "", url); window.dispatchEvent(new PopStateEvent("popstate")); }); }
beforeEach(() => { window.history.replaceState(null, "", "/report/example"); });
describe("shared report navigation", () => {
  it("starts with overview, uses keyboard navigation, preserves factual summary and exposes exact priority findings", async () => {
    const user = userEvent.setup();
    const { container } = render(<LangProvider><ReportPage params={{ report }} /></LangProvider>);
    expect(screen.getByRole("button", { name: "Vue d’ensemble" })).toHaveAttribute("aria-pressed", "true");
    const facts = screen.getByText(/6 constats uniques/).textContent;
    const actions = screen.getByRole("button", { name: "Plan d’action" });
    actions.focus(); await user.keyboard("{Enter}");
    expect(actions).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toBe("?view=actions");
    expect(screen.getByText(/6 constats uniques/).textContent).toBe(facts);
    await user.click(screen.getByRole("link", { name: "Voir le constat: Load resources" }));
    const finding = model.findings.find(item => item.key === "runtime.load")!;
    const detail = container.querySelector(`#${finding.anchor}`) as HTMLDetailsElement;
    expect(detail.open).toBe(true); expect(detail.querySelector("summary")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Constats techniques" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/6 constats uniques/).textContent).toBe(facts);
    expect(report.scores.global).toBe(73);
  });
  it("restores URL views and filters with history, keeps locale links and handles missing anchors", async () => {
    const user = userEvent.setup();
    render(<LangProvider initialLang="en"><ReportPage params={{ report }} /></LangProvider>);
    restore("/en/report/example?view=technical&domain=security&severity=critical");
    expect(screen.getByRole("combobox", { name: "Domain" })).toHaveValue("security");
    expect(screen.getByRole("button", { name: "Critical" })).toHaveAttribute("aria-pressed", "true");
    const french = screen.getByRole("link", { name: "Français" });
    expect(french).toHaveAttribute("href", "/report/example?view=technical&domain=security&severity=critical");
    await user.selectOptions(screen.getByRole("combobox", { name: "Domain" }), "all");
    expect(window.location.search).not.toContain("domain=");
    restore("/en/report/example?view=actions");
    expect(screen.getByRole("button", { name: "Action plan" })).toHaveAttribute("aria-pressed", "true");
    restore("/en/report/example#finding-absent");
    expect(screen.getByText(/This finding is absent/)).toBeInTheDocument();
  });
  it("direct anchor lifts incompatible filters, opens the detail and retains language and path", () => {
    const finding = model.findings.find(item => item.key === "runtime.load")!;
    window.history.replaceState(null, "", `/en/report/example?domain=security&severity=critical#${finding.anchor}`);
    render(<LangProvider initialLang="en"><ReportPage params={{ report }} /></LangProvider>);
    expect(document.getElementById(finding.anchor)?.querySelector("summary")).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Domain" })).toHaveValue("all");
    expect(localizedPath(window.location.pathname + window.location.search + window.location.hash, "fr")).toContain(`/report/example?domain=security&severity=critical#${finding.anchor}`);
  });
  it("renders explicit units, safe third-party text, original metadata and missing measurement without inventing LCP time", () => {
    const measured: Report = { ...report, summary: { oneLiner: "fair", priorities: [], ai: null }, issues: [
      { id: "lighthouse.audit.largest-contentful-paint", categoryKey: "performance", severity: "critical", title: "LCP", impact: "LCP", recommendation: "", evidence: "{score=0.02}" },
      { id: "runtime.network.request_count", categoryKey: "performance", severity: "info", title: "Requests", impact: "", recommendation: "", structuredEvidence: { source: "runtime", measurement: { value: 140, unit: "count" }, details: [{ key: "sample", text: "<script>alert(1)</script>\u0001" }] } },
    ] };
    window.history.replaceState(null, "", "/report/example?view=technical");
    const { container } = render(<LangProvider><ReportPage params={{ report: measured }} /></LangProvider>);
    expect(screen.getByText("140 éléments")).toBeInTheDocument();
    expect(screen.getByText("Mesure détaillée non disponible dans ce rapport.")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    const lcp = buildReportModel(measured).findings[0];
    const content = findingContent(lcp.issue, "fr");
    const detail = container.querySelector<HTMLElement>(`#${lcp.anchor}`)!;
    expect(within(detail).getByText(content.verification)).toBeInTheDocument();
    expect(container.textContent).not.toContain("0,02 s");
    expect(screen.getByText(/2 constats uniques/)).toBeInTheDocument();
  });
  it("keeps counts and limitations factual when free-form AI has no grounding contract", () => {
    const ungrounded = { headline: "Zero findings and guaranteed compliance", summary: "Everything is fixed", keyPoints: ["Invented cause"] };
    const partial: Report = { ...report, summary: { ...report.summary, ai: { fr: ungrounded, en: ungrounded } }, scores: { ...report.scores, completeness: 50 } };
    render(<LangProvider initialLang="en"><ReportPage params={{ report: partial }} /></LangProvider>);
    expect(screen.getByText(/6 unique findings/)).toBeInTheDocument();
    expect(screen.getByText("Partial analysis: available findings do not cover every check.")).toBeInTheDocument();
    expect(screen.queryByText(/guaranteed compliance/)).not.toBeInTheDocument();
  });
});
