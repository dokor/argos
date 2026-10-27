// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@/lib/i18n/LangProvider";
import ReportPage from "@/app/(fr)/report/[token]/ReportPage";
import { demoReport } from "@/components/marketing/reportDemoFixture";
import { buildReportModel } from "./reportModel";
import { findingContent } from "./findingCatalogue";
import { interpretationCopy, scoreLimit } from "./reportInterpretation";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => window.location.pathname }));

beforeEach(() => { window.history.replaceState(null, "", "/report/example"); });

function fixture() {
  const report = demoReport("fr");
  report.scores.global = 95;
  report.scores.coverage!.provisional = true;
  Object.assign(report.scores.coverage!.domains.find(d => d.key === "a11y")!, { ratio: .4, sufficient: false });
  report.issues.unshift(
    { id: "lighthouse.score.performance", categoryKey: "performance", module: "lighthouse", severity: "critical", title: "Performance score", impact: "Tool threshold", recommendation: "", confidence: "HIGH" },
    { id: "lighthouse.audit.unused-css-rules", categoryKey: "performance", module: "lighthouse", severity: "important", title: "Unused CSS", impact: "Tool diagnosis", recommendation: "", confidence: "HIGH" },
    { id: "lighthouse.audit.image-alt", categoryKey: "a11y", module: "lighthouse", severity: "important", title: "Image alt", impact: "Other domain", recommendation: "" },
    { id: "runtime.lcp", categoryKey: "performance", module: "runtime", severity: "important", title: "LCP", impact: "Other tool", recommendation: "" },
  );
  report.summary.priorities.unshift({ severity: "critical", findingKey: "lighthouse.score.performance", categoryKey: "performance", rank: 7, title: "Performance score", impact: "Tool threshold" });
  return report;
}

describe.each(["fr", "en"] as const)("current report interpretation (%s)", lang => {
  it("keeps score and severity limits visible in every view despite sufficient global coverage", async () => {
    const report = fixture(), before = JSON.stringify(report);
    render(<LangProvider initialLang={lang}><ReportPage params={{ report }} /></LangProvider>);
    for (const name of lang === "fr" ? ["Vue d’ensemble", "Plan d’action", "Constats techniques"] : ["Overview", "Action plan", "Technical findings"]) {
      await userEvent.click(screen.getByRole("button", { name }));
      const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
      for (const text of [scoreLimit(report, lang), interpretationCopy[lang].severity]) {
        expect(within(hero).getByText(text).closest("details")).toBeNull();
        expect(within(hero).getByText(text)).toBeVisible();
      }
      expect(within(hero).getByLabelText("Score 95/100")).toBeVisible();
    }
    expect(JSON.stringify(report)).toBe(before);
  });

  it("explains model order and opens underlying findings from an aggregate without changing its rank", async () => {
    const report = fixture(), before = JSON.stringify(report), model = buildReportModel(report);
    render(<LangProvider initialLang={lang}><ReportPage params={{ report }} /></LangProvider>);
    await userEvent.click(screen.getByRole("button", { name: lang === "fr" ? "Plan d’action" : "Action plan" }));
    const section = screen.getByRole("region", { name: lang === "fr" ? "Plan d’action" : "Action plan" });
    expect(within(section).getByText(interpretationCopy[lang].actions)).toBeVisible();
    const row = within(section).getAllByRole("listitem")[0];
    expect(within(row).getByText("07")).toBeVisible();
    expect(within(row).getByText(lang === "fr" ? /n’est pas une correction à chiffrer/ : /not an estimable correction/)).toBeVisible();
    const detail = model.findings.find(f => f.key === "lighthouse.audit.unused-css-rules")!;
    const name = `${lang === "fr" ? "Voir le constat" : "View finding"}: ${findingContent(detail.issue, lang).title}`;
    const link = within(row).getByRole("link", { name });
    expect(link).toHaveAttribute("href", `#${detail.anchor}`);
    expect(within(row).getAllByRole("link")).toHaveLength(2); // Aggregate plus detail; other tools/domains excluded.
    await userEvent.click(link);
    expect(document.getElementById(detail.anchor)).toHaveAttribute("open");
    expect(document.getElementById(detail.anchor)?.querySelector("summary")).toHaveFocus();
    expect(JSON.stringify(report)).toBe(before);
  });

  it("requests the source diagnosis when no underlying finding is available", () => {
    const report = fixture();
    report.issues = report.issues.filter(f => f.id !== "lighthouse.audit.unused-css-rules");
    render(<LangProvider initialLang={lang}><ReportPage params={{ report }} /></LangProvider>);
    const row = screen.getByRole("heading", { name: lang === "fr" ? "Par où commencer" : "Where to start" }).closest("section")!.querySelector("li")!;
    expect(within(row).getByText(lang === "fr" ? /demander le diagnostic source/ : /request the source diagnosis/)).toBeVisible();
    expect(within(row).getAllByRole("link")).toHaveLength(1);
  });
});
