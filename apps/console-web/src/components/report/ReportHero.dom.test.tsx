// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ReportHero from "./ReportHero";
import type { Report } from "./types";

const report = {
  generatedAt: "2026-01-01T12:00:00Z",
  domain: "example.com",
  url: "https://example.com",
  site: { title: "Example" },
  scores: { global: 93 },
  issues: [
    { severity: "critical" },
    { severity: "important" },
    { severity: "info" },
  ],
  summary: { oneLiner: "good" },
} as unknown as Report;

describe("ReportHero (rendu du rapport)", () => {
  it("affiche le score global dans l'anneau", () => {
    render(<ReportHero report={report} />);
    expect(screen.getByLabelText("Score 93/100")).toBeInTheDocument();
    expect(screen.getByText("93")).toBeInTheDocument();
  });

  it("affiche le nom du site et le compteur total d'issues", () => {
    render(<ReportHero report={report} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Example");
    // 3 issues au total (1 critique + 1 important + 1 info).
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
