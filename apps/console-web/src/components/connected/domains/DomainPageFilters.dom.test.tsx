// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import DomainPageFilters from "./DomainPageFilters";
import { findingTitle } from "@/components/report/findingCatalogue";

for (const lang of ["fr", "en"] as const) {
  it(`offers one All scope, the applied sort and folded advanced filters in ${lang}`, () => {
    const submit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const { container } = render(<LangProvider initialLang={lang}><DomainPageFilters query={new URLSearchParams("ruleKey=runtime.network.failed_requests&definitionVersion=" + "a".repeat(64) + "&limit=20&offset=20")} base="/account/domains/7/batches/700" onSubmit={submit}/></LangProvider>);
    const scope = screen.getByRole("combobox", { name: lang === "fr" ? "Afficher" : "Show" });
    expect(within(scope).getAllByRole("option", { name: lang === "fr" ? "Tous" : "All" })).toHaveLength(1);
    expect(scope).toHaveValue("all");
    expect(screen.getByRole("combobox", { name: lang === "fr" ? "Trier par" : "Sort by" })).toHaveValue("priority");
    expect(screen.getByText(lang === "fr" ? "Filtres avancés" : "Advanced filters").closest("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: lang === "fr" ? "Appliquer les filtres" : "Apply filters" }));
    expect(submit).toHaveBeenCalledOnce();
    const form = new FormData(container.querySelector("form")!);
    expect(form.get("rule")).toBe("runtime.network.failed_requests");
    expect(form.get("definitionVersion")).toBe("a".repeat(64));
    expect(form.get("offset")).toBeNull();
    expect(form.get("limit")).toBe("20");
    expect(form.get("sort")).toBe("priority");
    expect(screen.getByRole("link", { name: lang === "fr" ? "Réinitialiser les filtres" : "Reset filters" })).toHaveAttribute("href", (lang === "en" ? "/en" : "") + "/account/domains/7/batches/700?tab=pages");
  });
}
it("keeps active advanced filters visible and uses localized stable rule labels", () => {
  render(<LangProvider initialLang="en"><DomainPageFilters query={new URLSearchParams("status=FAILED&sort=url")} base="/account/domains/7/batches/700" onSubmit={vi.fn()}/></LangProvider>);
  expect(screen.getByText("Advanced filters (1)").closest("details")).toHaveAttribute("open");
  expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("FAILED");
  expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("url");
  expect(findingTitle("runtime.network.failed_requests", "en")).toBe("Review failed requests");
  expect(findingTitle("future.check", "en")).toBe("Technical check to review");
  expect(findingTitle("future.check", "fr")).toBe("Contrôle technique à examiner");
});
