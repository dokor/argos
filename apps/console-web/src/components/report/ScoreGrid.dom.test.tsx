// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ScoreGrid from "./ScoreGrid";

describe("ScoreGrid global availability", () => {
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
