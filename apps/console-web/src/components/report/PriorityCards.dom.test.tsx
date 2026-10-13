// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fr from "@/lib/i18n/fr.json";
import en from "@/lib/i18n/en.json";
import PriorityCards from "./PriorityCards";
import { buildReportModel } from "./reportModel";
import { demoReport as createDemoReport } from "@/components/marketing/reportDemoFixture";
import type { PriorityItem } from "./types";

let locale: "fr" | "en" = "fr";
vi.mock("@/lib/i18n/LangContext", () => ({
  useLang: () => ({ lang: locale, t: locale === "fr" ? fr : en }),
}));
const action: PriorityItem = {
  severity: "important", title: "Fix CSP", impact: "Protection du navigateur",
  findingKey: "http.security.csp", categoryKey: "security",
  rootCauseKey: "http.security.csp", rank: 1, rankingVersion: "priority-impact-v1",
  rankReason: "MODELLED_SCORE_GAIN", confidence: "UNKNOWN", globalScoreGain: 3.125,
  relatedFindingKeys: ["http.security.csp", "observatory.score"], effort: null,
};

describe("PriorityCards", () => {
  beforeEach(() => { locale = "fr"; });
  it("relie l'action aux constats existants et ouvre l'explication", async () => {
    const user = userEvent.setup();
    const report = createDemoReport("fr");
    const model = buildReportModel(report);
    const finding = model.findings[0];
    const priority = { ...action, findingKey: finding.key, relatedFindingKeys: [finding.key] };
    report.summary.priorities = [priority];
    render(<PriorityCards priorities={[priority]} model={buildReportModel(report)} />);
    expect(screen.getByRole("link", { name: /Voir le constat/ })).toHaveAttribute("href", `#${finding.anchor}`);
    const summary = screen.getByText("Comprendre le classement");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    await user.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
  });
  it("ne crée pas de lien vers un domaine absent du rapport", () => {
    render(<PriorityCards priorities={[action]} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("explique le gain théorique, le domaine, la confiance et le regroupement en français", () => {
    render(<PriorityCards priorities={[action]} />);
    expect(screen.getByText("Sécurité")).toBeInTheDocument();
    expect(screen.getByText(/Gain de score modélisé : 3,13 points globaux/)).toBeInTheDocument();
    expect(screen.getByText("Confiance de mesure : inconnue")).toBeInTheDocument();
    expect(screen.getByText("Constats regroupés : 2")).toBeInTheDocument();
    expect(screen.getByText(/Seule une nouvelle analyse/)).toBeInTheDocument();
    expect(screen.getByText("Effort À estimer")).toBeInTheDocument();
  });
  it("restitue la raison et les limites en anglais", () => {
    locale = "en";
    render(<PriorityCards priorities={[action]} />);
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText(/Modelled score gain: 3.13 global points/)).toBeInTheDocument();
    expect(screen.getByText("Measurement confidence: unknown")).toBeInTheDocument();
    expect(screen.getByText(/Only a new analysis/)).toBeInTheDocument();
  });
  it("n'annonce aucun gain pour un finding explicatif de poids nul", () => {
    render(<PriorityCards priorities={[{ ...action, rankReason: "NO_DIRECT_SCORE_GAIN", globalScoreGain: 12 }]} />);
    expect(screen.getByText("Action explicative sans gain direct de score.")).toBeInTheDocument();
    expect(screen.queryByText(/Gain de score modélisé/)).not.toBeInTheDocument();
  });
  it("distingue une contribution indisponible et n'affiche pas de nombre non fini", () => {
    render(<PriorityCards priorities={[{ ...action, rankReason: "SCORE_UNAVAILABLE", globalScoreGain: Infinity }]} />);
    expect(screen.getByText(/Contribution au score indisponible/)).toBeInTheDocument();
    expect(screen.queryByText(/Gain de score modélisé/)).not.toBeInTheDocument();
  });
  it("conserve les cartes historiques et leur effort explicite", () => {
    render(<PriorityCards priorities={[{ severity: "critical", title: "Historical action", impact: "Impact", effort: "M" }]} />);
    expect(screen.getByText("Historical action")).toBeInTheDocument();
    expect(screen.getByText("Effort M")).toBeInTheDocument();
    expect(screen.getByText("Confiance de mesure : inconnue")).toBeInTheDocument();
  });
  it("limite la présentation à six actions sans reclassement client", () => {
    const list = Array.from({ length: 8 }, (_, i) => ({ ...action, findingKey: `key-${i}`, title: `Action ${i}` }));
    render(<PriorityCards priorities={list} />);
    expect(screen.getByText("Action 0")).toBeInTheDocument();
    expect(screen.getByText("Action 5")).toBeInTheDocument();
    expect(screen.queryByText("Action 6")).not.toBeInTheDocument();
  });
  it("affiche l'état vide", () => {
    render(<PriorityCards priorities={[]} />);
    expect(screen.getByText("Aucune priorité détectée.")).toBeInTheDocument();
  });
});

describe("action resolution", () => {
  it("keeps an aggregate rank while linking underlying tool findings without asserting a cause", () => {
    const report = createDemoReport("fr");
    report.issues = [
      { ...report.issues[0], id: "lighthouse.score.performance", categoryKey: "performance", module: "lighthouse" },
      { ...report.issues[1], id: "lighthouse.audit.unused-css", categoryKey: "performance", module: "lighthouse" },
    ];
    report.summary.priorities = [{ ...action, findingKey: report.issues[0].id, relatedFindingKeys: [], categoryKey: "performance", rank: 7 }];
    render(<PriorityCards priorities={report.summary.priorities} model={buildReportModel(report)} />);
    expect(screen.getByText("Priorité 7")).toBeInTheDocument();
    expect(screen.getByText(/n’est pas une correction à chiffrer/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Des styles peu utilisés/ })).toHaveAttribute("href", "#" + buildReportModel(report).findings[1].anchor);
  });
  const demoReport = createDemoReport("fr");
  beforeEach(() => { locale = "fr"; });
  it("preserves backend rank/order and counts actual unique grouped findings", () => {
    const report = {...demoReport, summary: {...demoReport.summary, priorities: [{...action, rank: 4, relatedFindingKeys: [demoReport.issues[0].id!, demoReport.issues[0].id!, 'missing'], findingKey: demoReport.issues[0].id}]}};
    render(<PriorityCards priorities={report.summary.priorities} model={buildReportModel(report)} />);
    expect(screen.getByText('Priorité 4')).toBeInTheDocument();
    expect(screen.getByText('Constats regroupés : 1')).toBeInTheDocument();
    expect(screen.getByText(fr.report.priorityCards.partialFindings)).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
  it("keeps orphan priorities visible without an invented finding link", () => {
    const report = {...demoReport, summary: {...demoReport.summary, priorities: [action]}};
    render(<PriorityCards priorities={[action]} model={buildReportModel(report)} />);
    expect(screen.getByText(fr.report.priorityCards.missingFinding)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
