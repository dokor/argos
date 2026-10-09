// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import fr from "@/lib/i18n/fr.json";
import en from "@/lib/i18n/en.json";
import PriorityCards from "./PriorityCards";
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
  it("explique le gain théorique, le domaine, la confiance et le regroupement en français", () => {
    render(<PriorityCards priorities={[action]} />);
    expect(screen.getByText("Sécurité")).toBeInTheDocument();
    expect(screen.getByText(/Gain de score modélisé : 3,13 points globaux/)).toBeInTheDocument();
    expect(screen.getByText("Confiance de mesure : inconnue")).toBeInTheDocument();
    expect(screen.getByText("Constats regroupés : 2")).toBeInTheDocument();
    expect(screen.getByText(/Le gain réel dépend/)).toBeInTheDocument();
    expect(screen.queryByText(/^Effort/)).not.toBeInTheDocument();
  });
  it("restitue la raison et les limites en anglais", () => {
    locale = "en";
    render(<PriorityCards priorities={[action]} />);
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText(/Modelled score gain: 3.13 global points/)).toBeInTheDocument();
    expect(screen.getByText("Measurement confidence: unknown")).toBeInTheDocument();
    expect(screen.getByText(/Actual improvement depends/)).toBeInTheDocument();
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
    expect(screen.queryByText(/Confiance de mesure/)).not.toBeInTheDocument();
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
