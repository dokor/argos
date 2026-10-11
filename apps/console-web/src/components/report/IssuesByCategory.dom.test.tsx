// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("expose le filtre actif, annonce le résultat et distingue un filtre vide", async () => {
    const user = userEvent.setup();
    render(<IssuesByCategory report={report} />);
    const all = screen.getByRole("button", { name: "Tous 3" });
    const critical = screen.getByRole("button", { name: "Critiques 1" });
    expect(all).toHaveAttribute("aria-pressed", "true");
    await user.click(critical);
    expect(critical).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Constats affichés : 1 sur 3");
    expect(screen.queryByText("Color contrast")).not.toBeInTheDocument();
    expect(within(document.querySelector("#cat-security")!).getByText(/Aucun constat ne correspond/)).toBeInTheDocument();
    await user.click(all);
    expect(screen.getByText("Color contrast")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Constats affichés : 3 sur 3");
  });
  it("renders every issue in its canonical business category", () => {
    render(<IssuesByCategory report={report} />);

    expect(within(document.querySelector("#cat-performance")!).getByText("HTTP status")).toBeInTheDocument();
    expect(within(document.querySelector("#cat-a11y")!).getByText("Color contrast")).toBeInTheDocument();
    expect(within(document.querySelector("#cat-security")!).getByText("Libraries")).toBeInTheDocument();
  });
});
