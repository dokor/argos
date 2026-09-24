// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
    { id: "lighthouse.audit.no-vulnerable-libraries", categoryKey: "security", categoryKeys: ["security"], severity: "important", title: "Libraries", impact: "Libraries", recommendation: "Fix it" },
  ],
} satisfies Report;

describe("IssuesByCategory", () => {
  it("renders every issue in its canonical business category", () => {
    render(<IssuesByCategory report={report} />);

    expect(within(document.querySelector("#cat-performance")!).getByText("HTTP status")).toBeInTheDocument();
    expect(within(document.querySelector("#cat-a11y")!).getByText("Color contrast")).toBeInTheDocument();
    expect(within(document.querySelector("#cat-security")!).getByText("Libraries")).toBeInTheDocument();
  });
});
