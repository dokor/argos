// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScoreGrid from "./ScoreGrid";
import { LangProvider } from "@/lib/i18n/LangContext";
import type { Coverage } from "./types";

const aggregate = { key: "security", measuredWeight: 0, expectedWeight: 100, ratio: 0, available: false, sufficient: false };
const coverage: Coverage = { version: "v1", threshold: .8, provisional: true, global: aggregate, domains: [aggregate], checks: [] };
describe("four stable Argos domains", () => {
  it("keeps four cards in business order and never substitutes zero for an unmeasured domain", () => {
    render(<ScoreGrid categories={[{ key: "security", label: "SSL", score: 0, issues: 8 }, { key: "performance", label: "Performance", score: 0, issues: 0 }]} coverage={coverage} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map(heading => heading.textContent))
      .toEqual(["Performance", "Sécurité", "Référencement", "Accessibilité"]);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getAllByText("0/100")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /^Sécurité/ })).toHaveTextContent("Non évalué");
  });
  it("retains historical domain scores but never repeats the global score", () => {
    render(<ScoreGrid categories={[{ key: "seo", label: "SEO", score: 75, issues: 2 }]} />);
    expect(screen.getByText("75/100")).toBeInTheDocument();
    expect(screen.queryByText("Score global")).not.toBeInTheDocument();
  });
  it("uses the shared domain selection and translates missing scores", async () => {
    const select = vi.fn();
    render(<LangProvider initialLang="en"><ScoreGrid categories={[]} onSelectDomain={select} /></LangProvider>);
    const security = screen.getByRole("link", { name: /^Security/ });
    expect(security).toHaveTextContent("Not evaluated");
    await userEvent.click(security);
    expect(select).toHaveBeenCalledWith("security");
  });
});
