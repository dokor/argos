// @vitest-environment jsdom
import { useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@/lib/i18n/LangContext";
import historical from "./fixtures/historical-report.json";
import type { Report } from "./types";
import { buildReportModel, type FindingSelection } from "./reportModel";
import ReportHero from "./ReportHero";
import ScoreGrid from "./ScoreGrid";
import PriorityCards from "./PriorityCards";
import IssuesByCategory from "./IssuesByCategory";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

const report = historical as Report;
function Reader() {
  const model = useMemo(() => buildReportModel(report), []);
  const [selection, setSelection] = useState<FindingSelection>();
  return <>
    <ReportHero report={report} model={model} />
    <PriorityCards priorities={report.summary.priorities} model={model}
      onSelectFinding={key => setSelection(previous => ({ key, request: (previous?.request ?? 0) + 1 }))} />
    <ScoreGrid categories={report.scores.byCategory} model={model} />
    <IssuesByCategory report={report} model={model} selection={selection} />
  </>;
}

describe("historical report consistency", () => {
  it("shows six unique findings, including unknown and historically empty domains, with consistent hero and group counts", () => {
    const { container } = render(<Reader />);
    const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
    expect(within(hero).getByText("6")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("6 constats sur 6");
    expect(container.querySelectorAll("details[id^='finding-']")).toHaveLength(6);
    expect(within(container.querySelector("#cat-a11y")!).getByText("Accessible controls")).toBeInTheDocument();
    expect(within(container.querySelector("#cat-unknown")!).getByText("No identifier")).toBeInTheDocument();
    expect(screen.getAllByText(/Domaine non renseigné/)).toHaveLength(2);
    expect(screen.getByText(/Le lien détaillé vers le constat manque/)).toBeInTheDocument();
    expect(screen.getByText(/Certains constats de cette action/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^Voir le constat/ })).toHaveLength(2);
    expect(screen.getByText("Constats regroupés : 2")).toBeInTheDocument();
    const gridLink = screen.getByRole("link", { name: /Accessibilité.*1 point/ });
    expect(gridLink).toHaveTextContent("65/100");
  });

  it("opens and focuses the exact finding, resets the filter, and supports opening the same action again", async () => {
    const user = userEvent.setup();
    render(<Reader />);
    await user.click(screen.getByRole("button", { name: "Critiques" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 constats sur 6");
    const link = screen.getByRole("link", { name: "Voir le constat: Load resources" });
    await user.click(link);
    const finding = buildReportModel(report).findings.find(item => item.key === "runtime.load")!;
    const detail = document.getElementById(finding.anchor) as HTMLDetailsElement;
    expect(detail.open).toBe(true);
    expect(detail.querySelector("summary")).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("6 constats sur 6");
    await user.click(screen.getByRole("button", { name: "Critiques" }));
    await user.click(link);
    expect(document.getElementById(finding.anchor)?.querySelector("summary")).toHaveFocus();
  });

  it("renders English fallbacks and never invents scores for missing domains", () => {
    const emptyScores = { ...report, scores: { ...report.scores, byCategory: [] } };
    const model = buildReportModel(emptyScores);
    const { container } = render(<LangProvider initialLang="en">
      <PriorityCards priorities={report.summary.priorities} model={model} />
      <ScoreGrid categories={[]} model={model} />
      <IssuesByCategory report={emptyScores} model={model} />
    </LangProvider>);
    expect(screen.getAllByText(/Domain not provided/)).toHaveLength(2);
    expect(screen.getByText(/The detailed finding link is missing/)).toBeInTheDocument();
    expect(screen.getByText(/Some findings for this action/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("6 findings of 6");
    expect(within(container.querySelector("#cat-performance")!).getByText("Not evaluated")).toBeInTheDocument();
    expect(screen.queryByText("0/100")).not.toBeInTheDocument();
  });
});
