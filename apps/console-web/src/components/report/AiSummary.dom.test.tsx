// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LangProvider } from "@/lib/i18n/LangContext";
import AiSummary from "./AiSummary";

const summary = {
  fr: {
    headline: "Une base saine avec quelques priorités",
    summary: "Le site présente de bons fondamentaux mais plusieurs améliorations restent utiles.",
    keyPoints: ["Améliorer la performance", "Renforcer la sécurité"],
  },
  en: {
    headline: "A solid base with a few priorities",
    summary: "The site has solid fundamentals with a few useful improvements remaining.",
    keyPoints: ["Improve performance", "Strengthen security"],
  },
};

describe("AiSummary", () => {
  it("affiche la synthèse française par défaut", () => {
    render(
      <LangProvider>
        <AiSummary summary={summary} />
      </LangProvider>,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Une base saine avec quelques priorités",
    );
    expect(screen.getByText("Améliorer la performance")).toBeInTheDocument();
  });

  it("ne rend rien quand aucune synthèse n'est disponible", () => {
    const { container } = render(
      <LangProvider>
        <AiSummary summary={undefined} />
      </LangProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
