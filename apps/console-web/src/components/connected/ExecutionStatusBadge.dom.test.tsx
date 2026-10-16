// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import ExecutionStatusBadge from "./ExecutionStatusBadge";

it.each([
  ["COMPLETED", "success", "Terminé", "Completed"],
  ["SUCCESS", "success", "Succès", "Success"],
  ["RUNNING", "info", "En cours", "Running"],
  ["PENDING", "neutral", "En attente", "Pending"],
  ["QUEUED", "neutral", "En attente", "Pending"],
  ["FAILED", "danger", "Échoué", "Failed"],
  ["ERROR", "danger", "Erreur", "Error"],
  ["TIMEOUT", "danger", "Délai dépassé", "Timed out"],
  ["PARTIAL", "warning", "Partiel", "Partial"],
  ["WARNING", "warning", "Avertissement", "Warning"],
  ["SKIPPED", "neutral", "Non exécuté", "Skipped"],
  ["CANCELED", "neutral", "Annulé", "Canceled"],
  ["CANCELLED", "neutral", "Annulé", "Canceled"],
  ["NOT_APPLICABLE", "neutral", "Non applicable", "Not applicable"],
  ["unexpected", "neutral", "Non renseigné", "Unknown"],
  [null, "neutral", "Non renseigné", "Unknown"],
])("labels %s with its semantic tone in both languages", (state, tone, fr, en) => {
  const view = render(<LangProvider initialLang="fr"><ExecutionStatusBadge state={state}/></LangProvider>);
  expect(screen.getByText(fr)).toHaveAttribute("data-tone", tone);
  view.unmount();
  render(<LangProvider initialLang="en"><ExecutionStatusBadge state={state}/></LangProvider>);
  expect(screen.getByText(en)).toHaveAttribute("data-tone", tone);
});

it("updates the badge when a polled module changes state", () => {
  const view = render(<ExecutionStatusBadge state="PENDING"/>);
  expect(screen.getByText("En attente")).toHaveAttribute("data-tone", "neutral");
  view.rerender(<ExecutionStatusBadge state="RUNNING"/>);
  expect(screen.getByText("En cours")).toHaveAttribute("data-tone", "info");
  view.rerender(<ExecutionStatusBadge state="COMPLETED"/>);
  expect(screen.getByText("Terminé")).toHaveAttribute("data-tone", "success");
});
