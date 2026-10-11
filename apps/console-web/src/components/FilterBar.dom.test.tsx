// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilterBar from "./FilterBar";
import fr from "@/lib/i18n/fr.json";

function props() {
  return { tl: fr.auditList, statusCounts: { ALL: 2, COMPLETED: 1, FAILED: 1 },
    allModules: ["html"], allTags: ["a11y"], allTechs: ["Next.js"],
    sortBy: "date_desc" as const, filterStatus: "ALL", filterModule: "ALL", filterTag: "ALL", filterTech: "ALL",
    hasActiveFilters: false, setSortBy: vi.fn(), setFilterStatus: vi.fn(), setFilterModule: vi.fn(),
    setFilterTag: vi.fn(), setFilterTech: vi.fn(), clearFilters: vi.fn() };
}
describe("Admin audit filters", () => {
  it("labels every select and applies the selected technology", async () => {
    const p = props(); render(<FilterBar {...p} />);
    for (const label of [p.tl.filters.sortLabel, p.tl.filters.moduleLabel, p.tl.filters.tagLabel, p.tl.filters.techLabel]) {
      expect(screen.getByRole("combobox", { name: label })).toBeInTheDocument();
    }
    await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: p.tl.filters.techLabel }), "Next.js");
    expect(p.setFilterTech).toHaveBeenCalledWith("Next.js");
  });
  it("exposes the active status and lets the user select failed runs", async () => {
    const p = props(); render(<FilterBar {...p} />);
    expect(screen.getByRole("button", { name: `${p.tl.filters.all} 2` })).toHaveAttribute("aria-pressed", "true");
    const failed = screen.getByRole("button", { name: `${p.tl.status.FAILED} 1` });
    expect(failed).toHaveAttribute("aria-pressed", "false");
    await userEvent.setup().click(failed);
    expect(p.setFilterStatus).toHaveBeenCalledWith("FAILED");
  });
});
