// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import AccountJourneyPanel, { type AccountJourney } from "./AccountJourneyPanel";

const data: AccountJourney = {
  activeAccounts: 12, returningAccounts: 4, activityDays: 17, authentications: 14, claimedReports: 3,
  cohorts: [{ method: "github", lang: "en", registered: 10, activated: 5, claimed: 2,
    day7: { eligible: 8, returned: 2 }, day30: { eligible: 0, returned: 0 } }],
};
it.each(["fr", "en"] as const)("shows actual denominators and unavailable immature rates in %s", lang => {
  render(<LangProvider initialLang={lang}><AccountJourneyPanel data={data} /></LangProvider>);
  const region = screen.getByRole("region", { name: lang === "fr" ? "Retours après inscription" : "Returns after registration" });
  const rows = within(region).getAllByRole("row");
  expect(rows[1]).toHaveTextContent("2"); expect(rows[1]).toHaveTextContent("8"); expect(rows[1]).toHaveTextContent(/25\s?%/);
  expect(rows[2]).toHaveTextContent(lang === "fr" ? "Indisponible" : "Unavailable");
  expect(rows[2]).not.toHaveTextContent("0%");
  expect(screen.getByText(/GitHub · EN/)).toBeInTheDocument();
  expect(screen.getByText(lang === "fr" ? /Premium : mesure en attente/ : /Premium: measurement awaits/)).toBeInTheDocument();
});
it("explains absence of measured registrations without inventing history", () => {
  render(<AccountJourneyPanel data={{ ...data, cohorts: [] }} />);
  expect(screen.getByText(/Aucune inscription mesurée/)).toBeInTheDocument();
  expect(screen.getAllByText("Indisponible")).toHaveLength(2);
  expect(screen.getByText("12")).toBeInTheDocument();
});
