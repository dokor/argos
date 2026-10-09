// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// RelaunchButton (#9) utilise useRouter via useAuditSubmit : on mocke le routing.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

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
  it("distingue un score indisponible d'un zéro mesuré", () => {
    render(<ReportHero report={{ ...report, scores: { ...report.scores, global: 0, globalAvailable: false } }} />);
    expect(screen.getByText("Non évalué")).toBeInTheDocument();
    expect(screen.queryByLabelText("Score 0/100")).not.toBeInTheDocument();
    expect(screen.queryByText("/100")).not.toBeInTheDocument();
    expect(screen.queryByText("À traiter en priorité")).not.toBeInTheDocument();
  });

  it("conserve une note zéro lorsqu'elle est mesurée", () => {
    render(<ReportHero report={{ ...report, scores: { ...report.scores, global: 0, globalAvailable: true } }} />);
    expect(screen.getByLabelText("Score 0/100")).toBeInTheDocument();
    expect(screen.queryByText("Non évalué")).not.toBeInTheDocument();
  });
  it("affiche le score global dans l'anneau", () => {
    render(<ReportHero report={report} />);
    expect(screen.getByLabelText("Score 93/100")).toBeInTheDocument();
    expect(screen.getByText("93")).toBeInTheDocument();
  });

  it("affiche le nom du site et le compteur total d'issues", () => {
    render(<ReportHero report={report} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("example.com");
    // 3 issues au total (1 critique + 1 important + 1 info).
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("affiche le DR avec la date et l'attribution Ahrefs quand il est disponible", () => {
    render(<ReportHero report={{ ...report, site: {
      ...report.site, domainRating: { score: 42.4, fetchedAt: "2026-10-06T12:00:00Z" },
    } }} />);
    expect(screen.getByText("DR 42/100")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Domain Rating by Ahrefs" }))
      .toHaveAttribute("href", "https://ahrefs.com/");
    expect(screen.getByText(/mesuré le/)).toBeInTheDocument();
  });

  it("ne montre aucun badge DR pour un rapport historique sans donnée Ahrefs", () => {
    render(<ReportHero report={report} />);
    expect(screen.queryByText(/Domain Rating by Ahrefs/)).not.toBeInTheDocument();
  });
});
