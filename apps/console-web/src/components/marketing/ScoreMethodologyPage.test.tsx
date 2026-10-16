// @vitest-environment jsdom
import {render, screen, within} from "@testing-library/react";
import {expect, it, vi} from "vitest";
import {LangProvider} from "@/lib/i18n/LangContext";
import ScoreMethodologyPage from "./ScoreMethodologyPage";
import {scoreMethodologyCopy} from "./scoreMethodologyCopy";
vi.mock("@/components/site/SiteNav",()=>({default:()=>null}));
vi.mock("@/components/site/SiteFooter",()=>({default:()=>null}));

it.each(["fr", "en"] as const)("preserves every example value and label in the mobile alternative in %s", lang => {
  const c = scoreMethodologyCopy[lang];
  render(<LangProvider initialLang={lang}><ScoreMethodologyPage lang={lang}/></LangProvider>);
  const cards = screen.getByRole("region", {name:c.caption});
  const table = screen.getByRole("table", {name:c.caption});
  const articles = within(cards).getAllByRole("article");
  expect(articles).toHaveLength(c.example.length);
  c.example.forEach((row, index) => {
    expect(within(articles[index]).getByRole("heading", {name:row.domain})).toBeInTheDocument();
    expect(within(articles[index]).getAllByRole("term").map(node=>node.textContent)).toEqual(c.columns.slice(1));
    expect(within(articles[index]).getAllByRole("definition").map(node=>node.textContent)).toEqual([row.checks,row.points,row.score]);
    for (const value of [row.checks,row.points,row.score]) expect(within(table).getByText(value)).toBeInTheDocument();
  });
  expect(screen.getByText(c.result)).toBeInTheDocument();
  expect(screen.getByText(c.result).parentElement?.textContent).toBe(c.result+c.resultFormula);
});
