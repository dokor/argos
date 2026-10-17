// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// RelaunchButton (#9) utilise useRouter via useAuditSubmit : on mocke le routing.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import ReportHero from "./ReportHero";
import { LangProvider } from "@/lib/i18n/LangContext";
import type { Report } from "./types";

// Compact synthetic weights reproduce the production sample's missing contributions.
const summaryCoverage: NonNullable<Report["scores"]["coverage"]> = {
  version:"weighted-coverage-v3",threshold:.8,provisional:true,domains:[],
  global:{key:"global",measuredWeight:167,expectedWeight:217,ratio:167/217,available:true,sufficient:false},
  checks:[{key:"http.status_code",module:"http",domain:"security",weight:167,state:"MEASURED",reason:"CHECK_OBSERVED",confidence:"MEASURED"},
    ...([['accessibility',10,'a11y'],['best-practices',6,'security'],['performance',22,'performance'],['seo',8,'seo']] as const).map(([key,weight,domain])=>({
      key:`lighthouse.score.${key}`,module:"lighthouse",domain,weight,state:"UNAVAILABLE" as const,reason:"DEADLINE_EXCEEDED",confidence:"UNKNOWN"})),
    {key:"runtime.network.bytes_estimated",module:"runtime",domain:"performance",weight:4,state:"UNAVAILABLE",reason:"CHECK_MISSING",confidence:"UNKNOWN"}],
};

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
  it.each(["fr","en"] as const)("explains missing coverage in the public summary without login in %s",lang=>{
    render(<LangProvider initialLang={lang}><ReportHero report={{...report,access:"summary",
      scores:{...report.scores,coverage:summaryCoverage}}}/></LangProvider>);
    const title=lang==="fr"?"Détail de la couverture":"Coverage breakdown";
    const summaries=screen.getAllByText(title);
    const disclosure=summaries.find(element=>element.tagName==="SUMMARY")!;
    expect(disclosure.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(disclosure);
    expect(disclosure.closest('details')).toHaveAttribute('open');
    expect(screen.getByText(lang==="fr"?"77 % mesurés — 23 % non couverts":"77 % measured — 23 % not covered")).toBeInTheDocument();
    expect(screen.getByText('167 / 217 · weighted-coverage-v3')).toBeInTheDocument();
    expect(screen.getAllByText('DEADLINE_EXCEEDED')).toHaveLength(4);
    expect(screen.getByText('runtime.network.bytes_estimated')).toBeInTheDocument();
    expect(screen.queryByRole('link',{name:/connexion|log in/i})).not.toBeInTheDocument();
  });
  it.each(["fr", "en"] as const)("adds the 42 reference in %s without changing the score or counts", lang => {
    render(<LangProvider initialLang={lang}><ReportHero report={{ ...report, scores: { ...report.scores, global: 42 } }} /></LangProvider>);
    expect(screen.getByLabelText("Score 42/100")).toHaveTextContent("42/100");
    expect(screen.getByText(lang === "fr" ? "La réponse est 42. Les pistes d’amélioration sont juste en dessous." : "The answer is 42. The improvements are right below.")).toBeInTheDocument();
    expect(screen.getByText(lang === "fr" ? /Constats uniques : 3/ : /Unique findings: 3/)).toBeInTheDocument();
  });
  it.each([
    { global: 41.99 }, { global: 43 }, { global: 42, globalAvailable: false },
    { global: 42, coverage: { version: "test", threshold: 0.8, provisional: true,
      global: { key: "global", measuredWeight: 0, expectedWeight: 100, ratio: 0, available: false, sufficient: false }, domains: [], checks: [] } },
  ])("does not round or celebrate an unavailable score: %j", scores => {
    render(<ReportHero report={{ ...report, scores: { ...report.scores, ...scores } } as Report} />);
    expect(screen.queryByText(/La réponse est 42/)).not.toBeInTheDocument();
  });
  it("identifies historical incomplete measurements as provisional beside the score", () => {
    render(<ReportHero report={{ ...report, scores: { ...report.scores, completeness: 50 } }} />);
    expect(screen.getByText("Score provisoire")).toBeInTheDocument();
    expect(screen.queryByText("Score mesuré")).not.toBeInTheDocument();
  });
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
    expect(screen.getByText(/Constats uniques : 3/)).toBeInTheDocument();
  });

  it("affiche le DR avec la date et l'attribution Ahrefs quand il est disponible", () => {
    render(<ReportHero report={{ ...report, site: {
      ...report.site, domainRating: { score: 42.4, fetchedAt: "2026-10-06T12:00:00Z" },
    } }} />);
    expect(screen.getByText("DR 42/100")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Informations sur la mesure"));
    expect(screen.getByRole("link", { name: "Domain Rating by Ahrefs" }))
      .toHaveAttribute("href", "https://ahrefs.com/");
    expect(screen.getByText(/mesuré le/)).toBeInTheDocument();
  });

  it("ne montre aucun badge DR pour un rapport historique sans donnée Ahrefs", () => {
    render(<ReportHero report={report} />);
    expect(screen.queryByText(/Domain Rating by Ahrefs/)).not.toBeInTheDocument();
  });
});
