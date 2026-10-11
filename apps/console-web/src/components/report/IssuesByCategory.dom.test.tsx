// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@/lib/i18n/LangContext";
import { buildReportModel } from "./reportModel";
import historical from "./fixtures/historical-report.json";
import IssuesByCategory from "./IssuesByCategory";
import type { Report } from "./types";

const report = {
  generatedAt: "2026-01-01T12:00:00Z",
  domain: "example.com",
  url: "https://example.com",
  site: {},
  scores: {
    global: 55,
    byCategory: [
      { key: "performance", label: "Performance", score: 50, issues: 1 },
      { key: "security", label: "Securite", score: 50, issues: 1 },
      { key: "seo", label: "SEO", score: 100, issues: 0 },
      { key: "a11y", label: "Accessibilite", score: 50, issues: 1 },
    ],
  },
  summary: { oneLiner: "fair", priorities: [] },
  issues: [
    { id: "http.status_code", categoryKey: "performance", categoryKeys: ["performance"], severity: "critical", title: "HTTP status", impact: "HTTP failed", recommendation: "Fix it" },
    { id: "lighthouse.audit.color-contrast", categoryKey: "a11y", categoryKeys: ["a11y"], severity: "important", title: "Color contrast", impact: "Contrast", recommendation: "Fix it" },
    { id: "lighthouse.audit.no-vulnerable-libraries", categoryKey: "security", categoryKeys: ["security"], severity: "important", title: "Libraries", impact: "Known vulnerable dependency", recommendation: "Fix it" },
  ],
} satisfies Report;

describe("IssuesByCategory", () => {
  it("renders every issue in its canonical business category", () => {
    render(<IssuesByCategory report={report} />);

    expect(within(document.querySelector("#cat-performance")!).getByText(/Titre technique original: HTTP status/)).toBeInTheDocument();
    expect(within(document.querySelector("#cat-a11y")!).getByText(/Titre technique original: Color contrast/)).toBeInTheDocument();
    expect(within(document.querySelector("#cat-security")!).getByText("Libraries")).toBeInTheDocument();
  });
});

for (const lang of ["fr", "en"] as const) describe("technical findings " + lang, () => {
  it("filters canonical unique findings without changing scores or priorities", async () => {
    const before = JSON.stringify(historical); const user = userEvent.setup();
    const {container} = render(<LangProvider initialLang={lang}><IssuesByCategory report={historical as Report} /></LangProvider>);
    expect(screen.getByRole('status')).toHaveTextContent(lang === 'fr' ? '6 constats sur 6' : '6 findings of 6');
    await user.click(screen.getByRole('button', {name:lang === 'fr' ? 'Critiques' : 'Critical'}));
    expect(container.querySelectorAll('details')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent(lang === 'fr' ? '2 constats sur 6' : '2 findings of 6');
    expect(JSON.stringify(historical)).toBe(before);
  });
  it("reveals an unknown-domain finding and focuses its direct disclosure", () => {
    const model = buildReportModel(historical as Report); const unknown = model.findings.find(f => f.domain === 'unknown')!;
    const {container} = render(<LangProvider initialLang={lang}><IssuesByCategory report={historical as Report} model={model} selection={{key:unknown.key,request:1}} /></LangProvider>);
    const detail = container.querySelector<HTMLDetailsElement>('#' + unknown.anchor)!;
    expect(detail.open).toBe(true); expect(detail.querySelector('summary')).toHaveFocus();
    expect(container.querySelector('#cat-unknown')).toBeInTheDocument();
  });
  it("offers a reset for an empty filter and exposes an accessible severity group", async () => {
    const {vi} = await import('vitest'); const change = vi.fn(); const user = userEvent.setup();
    render(<LangProvider initialLang={lang}><IssuesByCategory report={report} domain="seo" severity="critical" onFilterChange={change} /></LangProvider>);
    expect(screen.getByRole('group', {name:lang === 'fr' ? 'Sévérité' : 'Severity'})).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name:lang === 'fr' ? 'Afficher tous les constats' : 'Show all findings'}));
    expect(change).toHaveBeenCalledWith('all','all');
  });
});
