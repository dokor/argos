// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import ScoreGrid from "./ScoreGrid";
import { LangProvider } from "@/lib/i18n/LangProvider";
import type { Coverage } from "./types";

const aggregate = { key: "security", measuredWeight: 0, expectedWeight: 100, ratio: 0, available: false, sufficient: false };
const coverage: Coverage = { version: "v1", threshold: .8, provisional: true, global: aggregate, domains: [aggregate], checks: [] };
describe("four stable Argos domains", () => {
  it("keeps four cards in business order and never substitutes zero for an unmeasured domain", () => {
    render(<ScoreGrid categories={[{ key: "security", label: "SSL", score: 0, issues: 8 }, { key: "performance", label: "Performance", score: 0, issues: 0 }]} coverage={coverage} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map(heading => heading.textContent))
      .toEqual(["Performance", "Sécurité", "Référencement", "Accessibilité"]);
    expect(screen.getAllByRole("link").filter(link=>link.getAttribute("href")?.startsWith("#cat-"))).toHaveLength(4);
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

for (const lang of ["fr", "en"] as const) it(`inflects finding counts in ${lang}`, () => {
  render(<LangProvider initialLang={lang}><ScoreGrid categories={[{key:"security",label:"Security",score:60,issues:1},{key:"seo",label:"SEO",score:70,issues:2}]} /></LangProvider>);
  expect(screen.getByText(lang === "fr" ? "1 constat" : "1 finding")).toBeInTheDocument();
  expect(screen.getByText(lang === "fr" ? "2 constats" : "2 findings")).toBeInTheDocument();
  expect(screen.getAllByText(lang === "fr" ? "0 constats" : "0 findings")).toHaveLength(2);
});
