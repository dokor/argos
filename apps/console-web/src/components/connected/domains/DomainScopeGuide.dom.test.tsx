// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/test/render";
import { LangProvider } from "@/lib/i18n/LangProvider";
import DomainScopeGuide from "./DomainScopeGuide";
const state = vi.hoisted(() => ({ usage: null as { available: number | null } | null, usageError: false, refreshUsage: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/account/domains/new" }));
vi.mock("@/components/account/AccountSession", () => ({ useAccountSession: () => state }));
beforeEach(() => { state.usage = null; state.usageError = false; state.refreshUsage.mockReset(); });
it("explains exact-host scope, free discovery and selected-page cost separately from capacity", () => {
  state.usage = { available: 36 }; render(<DomainScopeGuide />);
  expect(screen.getByRole("complementary", { name: "Avant l’analyse" })).toBeInTheDocument();
  expect(screen.getByText(/Les sous-domaines restent exclus/)).toBeInTheDocument();
  expect(screen.getByText(/Aucun crédit n’est réservé/)).toBeInTheDocument();
  expect(screen.getByText(/limite l’exploration, pas votre capacité/)).toHaveTextContent(/un crédit par page/);
  expect(screen.getByText("36")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ouvrir mes quotas" })).toHaveAttribute("href", "/account/usage");
});
it("keeps loading, quota failures and real zero capacity distinct", () => {
  const view = render(<DomainScopeGuide />); expect(screen.getByRole("status")).toHaveTextContent(/quota/i);
  state.usageError = true; state.usage = { available: 36 }; view.rerender(<DomainScopeGuide />);
  expect(screen.queryByText("36")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Quota indisponible");
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" })); expect(state.refreshUsage).toHaveBeenCalledOnce();
  state.usageError = false; state.usage = { available: 0 }; view.rerender(<DomainScopeGuide />);
  expect(screen.getByText("0")).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("shows an actually unlimited quota and localized links in English", () => {
  state.usage = { available: null }; render(<LangProvider initialLang="en"><DomainScopeGuide /></LangProvider>);
  expect(screen.getByText(/unlimited/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open my quotas" })).toHaveAttribute("href", "/en/account/usage");
  expect(screen.getByText(/Only the entered host/)).toBeInTheDocument();
});
