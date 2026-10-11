// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ScoreGrid from "./ScoreGrid";
import type { Coverage } from "./types";

describe("ScoreGrid global availability", () => {
  it("arrondit la couverture sans afficher les artefacts flottants", () => {
    render(<ScoreGrid categories={[]} globalScore={64} completeness={55.00000000000001} />);
    expect(screen.getByText(/Analyse partielle/)).toHaveTextContent("55%");
    expect(screen.queryByText(/55\.00000000000001/)).not.toBeInTheDocument();
  });
  it("ne présente pas une catégorie non mesurée comme un zéro", () => {
    const coverage = { domains: [{ key: "security", available: false }] } as Coverage;
    render(<ScoreGrid categories={[{ key: "security", label: "Sécurité", score: 0, issues: 0 }]} globalScore={50} coverage={coverage} />);
    const domain = screen.getByRole("link", { name: /Sécurité/ });
    expect(domain).toHaveTextContent("Score indisponible");
    expect(domain).not.toHaveTextContent("0/100");
  });
  it("affiche une note indisponible sans zéro ni unité", () => {
    render(<ScoreGrid categories={[]} globalScore={0} globalAvailable={false} />);
    expect(screen.getByText("Score indisponible")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("/100")).not.toBeInTheDocument();
  });
  it("conserve un zéro réellement mesuré", () => {
    render(<ScoreGrid categories={[]} globalScore={0} globalAvailable={true} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("Score indisponible")).not.toBeInTheDocument();
  });
  it("conserve le score d'un ancien rapport sans indicateur", () => {
    render(<ScoreGrid categories={[]} globalScore={75} />);
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.queryByText("Score indisponible")).not.toBeInTheDocument();
  });
});
