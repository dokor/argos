// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccessibilitySection, { safeAccessibilitySource } from "./AccessibilitySection";
import type { Report } from "./types";
import fr from "@/lib/i18n/fr.json";
import en from "@/lib/i18n/en.json";

let locale: "fr" | "en" = "fr";
vi.mock("@/lib/i18n/LangContext", () => ({ useLang: () => ({ t: locale === "fr" ? fr : en }) }));

function fixture(): Report {
  return {
    generatedAt: "2026-10-05", domain: "example.com", url: "https://example.com", site: {},
    scores: { global: 100, byCategory: [{ key: "a11y", label: "A11y", score: 100, issues: 0 }] },
    summary: { oneLiner: "high", priorities: [] }, issues: [],
    accessibilityEvidence: {
      lighthouseScore: 93,
      version: "lighthouse-accessibility-v1", mappingVersion: "wcag-2.2-partial-v1", sourceVersion: "13.0.0",
      coverage: "COMPLETE", referencedAudits: 8, statusCounts: { FAIL: 1, PASS: 4, MANUAL: 2, NOT_APPLICABLE: 1 },
      failedAudits: 1, reportedElements: 3, elementCountComplete: false, surfacedFindings: 1, truncated: false,
      findings: [{ id: "lighthouse.audit.image-alt", source: "lighthouse", kind: "IMAGE_ALTERNATIVE",
        severity: "HIGH", score: 0, reportedElements: 3, wcagCriteria: ["1.1.1"] }],
    },
    accessibilityCompliance: {
      accessibilityComplianceVersion: "accessibility-compliance-proposal-v1", rulesValidated: false,
      scopes: ["POTENTIALLY_EAA", "POTENTIALLY_ARTICLE_47"], confidence: "LOW",
      risk: "UNKNOWN", riskReason: "RULES_PENDING",
      signals: [{ code: "PRICE", provenance: "OBSERVED", value: true },
        { code: "EXEMPTION", provenance: "DECLARED", value: true }],
      missingInformation: ["ENTERPRISE_SIZE", "RULES_REVIEW"],
      references: [{ title: "W3C", url: "https://www.w3.org/WAI/WCAG22/" }],
    },
  };
}

describe("AccessibilitySection (#263)", () => {
  beforeEach(() => { locale = "fr"; });
  it("keeps historical reports without the blocks unchanged", () => {
    const report = fixture();
    delete report.accessibilityEvidence; delete report.accessibilityCompliance;
    const { container } = render(<AccessibilitySection report={report} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("separates technical score, scope confidence and unknown regulatory risk", () => {
    const report = fixture();
    render(<AccessibilitySection report={report} />);
    expect(screen.getByRole("region", { name: fr.report.accessibility.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: fr.report.accessibility.testsTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: fr.report.accessibility.scopeSectionTitle })).toBeInTheDocument();
    expect(screen.getByText("100/100")).toBeInTheDocument();
    expect(screen.getByText("93/100")).toBeInTheDocument();
    expect(screen.getByText(fr.report.accessibility.riskReasons.RULES_PENDING)).toBeInTheDocument();
    expect(screen.getByText(/EAA potentiellement concerné · Article 47/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: fr.report.accessibility.resultsTitle })).toHaveTextContent("8contrôles référencés1contrôles en échec1constats affichés");
    expect(screen.getByText(fr.report.accessibility.statuses.MANUAL).nextElementSibling).toHaveTextContent("2");
    expect(report.issues).toEqual([]);
    expect(report.summary.priorities).toEqual([]);
  });
  it("does not substitute the Argos score for missing historical Lighthouse data", () => {
    const report = fixture();
    delete report.accessibilityEvidence!.lighthouseScore;
    render(<AccessibilitySection report={report} />);
    expect(screen.getAllByText("100/100")).toHaveLength(1);
    const label = screen.getByText(fr.report.accessibility.lighthouseScore);
    expect(label.nextElementSibling).toHaveTextContent(fr.report.accessibility.unknown);
  });
  it.each([null, -1, 101, NaN, Infinity])("does not present an invalid raw Lighthouse score: %s", score => {
    const report = fixture();
    report.accessibilityEvidence!.lighthouseScore = score;
    render(<AccessibilitySection report={report} />);
    expect(screen.getByText(fr.report.accessibility.lighthouseScore).nextElementSibling)
      .toHaveTextContent(fr.report.accessibility.unknown);
  });
  it.each(["COMPLETE", "PARTIAL", "UNAVAILABLE"] as const)("states collection coverage explicitly: %s", coverage => {
    const report = fixture();
    report.accessibilityEvidence!.coverage = coverage;
    report.accessibilityEvidence!.failedAudits = 0;
    report.accessibilityEvidence!.findings = [];
    render(<AccessibilitySection report={report} />);
    expect(screen.getByText(fr.report.accessibility.coverage[coverage])).toBeInTheDocument();
    if (coverage === "UNAVAILABLE") expect(screen.queryByText(fr.report.accessibility.noFailure)).not.toBeInTheDocument();
    else expect(screen.getByText(fr.report.accessibility.noFailure)).toBeInTheDocument();
  });
  it("renders outside scope without claiming technical conformance", () => {
    const report = fixture();
    report.accessibilityCompliance!.scopes = ["OUT_OF_SCOPE"];
    report.accessibilityCompliance!.riskReason = "OUTSIDE_SCOPE";
    render(<AccessibilitySection report={report} />);
    expect(screen.getByText(fr.report.accessibility.scopes.OUT_OF_SCOPE)).toBeInTheDocument();
    expect(screen.getByText(fr.report.accessibility.riskReasons.OUTSIDE_SCOPE)).toBeInTheDocument();
  });
  it("shows only persisted evidence, without inventing a regulatory assessment", () => {
    const report = fixture();
    delete report.accessibilityCompliance;
    render(<AccessibilitySection report={report} />);
    expect(screen.getByRole("heading", { name: fr.report.accessibility.testsTitle })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: fr.report.accessibility.scopeSectionTitle })).not.toBeInTheDocument();
    expect(screen.queryByText(fr.report.accessibility.riskTitle)).not.toBeInTheDocument();
  });
  it("shows a persisted scope without inventing missing technical results", () => {
    const report = fixture();
    delete report.accessibilityEvidence;
    render(<AccessibilitySection report={report} />);
    expect(screen.getByRole("heading", { name: fr.report.accessibility.scopeSectionTitle })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: fr.report.accessibility.testsTitle })).not.toBeInTheDocument();
    expect(screen.queryByText(fr.report.accessibility.coverage.UNAVAILABLE)).not.toBeInTheDocument();
  });
  it("supports disclosures, prioritised findings and safe references", async () => {
    const user = userEvent.setup();
    const report = fixture();
    report.accessibilityEvidence!.truncated = true;
    report.accessibilityEvidence!.failedAudits = 73;
    report.accessibilityCompliance!.references.push({ title: "Unsafe source", url: "javascript:alert(1)" });
    const { container } = render(<AccessibilitySection report={report} />);
    const disclosure = screen.getByText(fr.report.accessibility.findingsTitle);
    await user.tab();
    expect(disclosure).toHaveFocus();
    await user.click(disclosure);
    expect(disclosure.closest("details")).toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: fr.report.accessibility.kinds.IMAGE_ALTERNATIVE.title })).toBeInTheDocument();
    expect(screen.getByText(fr.report.accessibility.truncated)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Unsafe source" })).not.toBeInTheDocument();
    expect(container.querySelector("h1")).toBeNull();
    await user.click(screen.getByText(fr.report.accessibility.qualificationTitle));
    expect(screen.getByRole("link", { name: "W3C" })).toHaveAttribute("rel", "noopener noreferrer");
  });
  it("uses English wording for the same contract", () => {
    locale = "en";
    render(<AccessibilitySection report={fixture()} />);
    expect(screen.getByRole("heading", { level: 2, name: en.report.accessibility.title })).toBeInTheDocument();
    expect(screen.getByText(en.report.accessibility.limit)).toBeInTheDocument();
    expect(screen.queryByText(fr.report.accessibility.limit)).not.toBeInTheDocument();
  });
  it.each(["fr", "en"] as const)("shows persisted rule review states independently of score and risk in %s", language => {
    locale = language;
    const copy = (language === "fr" ? fr : en).report.accessibility;
    const report = fixture();
    const { rerender } = render(<AccessibilitySection report={report} />);
    expect(screen.getByText(copy.rulesReviewTitle).nextElementSibling).toHaveTextContent(copy.rulesReview.PENDING);
    expect(screen.getByText(copy.rulesSnapshot)).toBeInTheDocument();
    expect(screen.queryByText(copy.rulesReview.VALIDATED)).not.toBeInTheDocument();

    // Reading a hypothetical historical approved snapshot must not requalify it with today's pending rules.
    report.accessibilityCompliance!.rulesValidated = true;
    report.accessibilityCompliance!.accessibilityComplianceVersion = "historical-rules-version";
    report.accessibilityCompliance!.riskReason = "SCOPE_UNKNOWN";
    rerender(<AccessibilitySection report={report} />);
    expect(screen.getByText(copy.rulesReviewTitle).nextElementSibling).toHaveTextContent(copy.rulesReview.VALIDATED);
    expect(screen.getByText(copy.riskTitle).nextElementSibling).toHaveTextContent(copy.risk.UNKNOWN);
    expect(screen.getByText(/historical-rules-version/)).toBeInTheDocument();
    expect(report.issues).toEqual([]);
    expect(report.summary.priorities).toEqual([]);

    delete (report.accessibilityCompliance as Partial<NonNullable<Report["accessibilityCompliance"]>>).rulesValidated;
    rerender(<AccessibilitySection report={report} />);
    expect(screen.getByText(copy.rulesReviewTitle).nextElementSibling).toHaveTextContent(copy.rulesReview.UNKNOWN);
  });
  it("does not invent a rules review when only technical evidence was persisted", () => {
    const report = fixture();
    delete report.accessibilityCompliance;
    render(<AccessibilitySection report={report} />);
    expect(screen.queryByText(fr.report.accessibility.rulesReviewTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(fr.report.accessibility.rulesSnapshot)).not.toBeInTheDocument();
    expect(screen.getByText("93/100")).toBeInTheDocument();
  });
  it("escapes external text and supports long lists without changing counters", () => {
    const report = fixture();
    report.accessibilityEvidence!.findings = Array.from({ length: 50 }, (_, i) => ({
      id: "<img src=x onerror=alert(1)>" + i, source: "lighthouse", kind: "OTHER",
      severity: "HIGH", reportedElements: null, wcagCriteria: [],
    }));
    const { container } = render(<AccessibilitySection report={report} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelectorAll("h4").length).toBeGreaterThanOrEqual(50);
    expect(report.accessibilityEvidence!.failedAudits).toBe(1);
  });
  it.each(["javascript:alert(1)", "http://www.w3.org/", "https://www.w3.org.evil.test/",
    "https://user:pass@www.w3.org/", "https://www.w3.org:444/", "/relative"])("rejects unsafe sources: %s", value => {
      expect(safeAccessibilitySource(value)).toBeNull();
    });
  it("keeps translation keys and placeholder sets in parity", () => {
    function shape(value: unknown): unknown {
      if (typeof value === "string") return [...value.matchAll(/\{([a-z]+)\}/g)].map(m => m[1]).sort();
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, shape(v)]));
    }
    expect(shape(fr.report.accessibility)).toEqual(shape(en.report.accessibility));
  });
});
