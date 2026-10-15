// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import AccountShell from "./AccountShell";
import { LangProvider } from "@/lib/i18n/LangContext";
const state = vi.hoisted(() => ({ path: "/account/integrations", session: {
  ready: true, denied: false, error: "", profile: { displayName: "Camille", verified: true, admin: false },
  usage: { offer: "FREE", limit: 100 as number | null, used: 32, reserved: 4, available:64 }, usageError: false, refreshUsage: vi.fn(),
} }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path, useRouter: () => ({replace: vi.fn(), refresh: vi.fn()}) }));
vi.mock("@/components/account/AccountSession", () => ({ useAccountSession: () => state.session }));
vi.mock("@/components/ThemeToggle", () => ({ default: () => <button>Theme</button> }));
vi.mock("@/components/LangToggle", () => ({ default: () => <span>FR / EN</span> }));
beforeEach(() => {
  state.path = "/account/integrations";
  Object.assign(state.session, { ready: true, denied: false, error: "", profile: { displayName: "Camille", verified: true, admin: false }, usage: { offer: "FREE", limit: 100, used: 32, reserved: 4, available:64 }, usageError: false });
});
const content = <main><h1>Private page</h1><p>Private result</p></main>;
it("collapses and restores navigation without losing accessible destinations or the current page", () => {
  const view = render(<AccountShell>{content}</AccountShell>);
  const shell = view.container.querySelector("[data-connected-shell]")!;
  const navigation = screen.getByRole("navigation", { name: "Navigation de l’espace connecté" });
  expect(shell).toHaveAttribute("data-collapsed", "false");
  const toggle = screen.getByRole("button", { name: "Réduire le menu" });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(shell).toHaveAttribute("data-collapsed", "true");
  expect(screen.getByRole("button", { name: /Menu du compte/ }).parentElement).toHaveAttribute("data-compact", "true");
  for (const label of ["Vue d’ensemble", "Analyse de site", "Domaines", "Intégrations — Bientôt", "Mon compte", "Offre et quotas"]) {
    expect(within(navigation).getByRole("link", { name: label })).toBeInTheDocument();
  }
  const integrations = within(navigation).getByRole("link", { name: "Intégrations — Bientôt" });
  expect(integrations).toHaveAttribute("aria-current", "page");
  fireEvent.keyDown(integrations, { key: "Escape" });
  expect(shell).toHaveAttribute("data-tooltip-dismissed", "true");
  fireEvent.focus(integrations);
  expect(shell).toHaveAttribute("data-tooltip-dismissed", "false");
  state.path = "/account/domains";
  view.rerender(<AccountShell>{content}</AccountShell>);
  expect(shell).toHaveAttribute("data-collapsed", "true");
  expect(within(navigation).getByRole("link", { name: "Domaines" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("button", { name: "Déployer le menu" }));
  expect(shell).toHaveAttribute("data-collapsed", "false");
  expect(screen.getByRole("button", { name: /Menu du compte/ }).parentElement).toHaveAttribute("data-compact", "false");
});
it("localizes compact controls and preserves English navigation destinations", () => {
  state.path = "/en/account/integrations";
  render(<LangProvider initialLang="en"><AccountShell>{content}</AccountShell></LangProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Collapse menu" }));
  expect(screen.getByRole("button", { name: "Expand menu" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("link", { name: "Integrations — Soon" })).toHaveAttribute("href", "/en/account/integrations");
});
it("shares one footer, real available credits and a current navigation item", () => {
  render(<AccountShell>{content}</AccountShell>);
  expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
  expect(screen.getByRole("link",{name:"Retour au site"})).toHaveAttribute("href","/");
  expect(screen.getAllByRole("link",{name:"Aide"})).toHaveLength(2);
  expect(screen.getByRole("link", { name: "64 crédits restants" })).toHaveAttribute("href", "/account/usage");
  expect(screen.getByRole("link", { name: /Intégrations/ })).toHaveAttribute("aria-current", "page");
  expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
});
it("only offers administration to a verified active administrator", () => {
  state.session.profile.admin = true;
  const view = render(<AccountShell>{content}</AccountShell>);
  expect(screen.getByRole("link", { name: "Administration" })).toBeInTheDocument();
  state.session.profile.verified = false; view.rerender(<AccountShell>{content}</AccountShell>);
  expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
});
it("removes private children and quota immediately on session invalidation, keeping the footer", () => {
  state.path = "/account/urls/9/history";
  const view = render(<AccountShell>{content}</AccountShell>);
  state.session.denied = true; view.rerender(<AccountShell>{content}</AccountShell>);
  expect(screen.queryByText("Private result")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Menu du compte/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /crédits/ })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/account/sign-in?returnTo=%2Faccount%2Furls%2F9%2Fhistory");
  state.path = "/en/account/runs/9";
  view.rerender(<LangProvider initialLang="en"><AccountShell>{content}</AccountShell></LangProvider>);
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/en/account/sign-in?returnTo=%2Fen%2Faccount%2Fruns%2F9");
  expect(screen.getByRole("contentinfo")).toBeInTheDocument();
});
it("distinguishes unavailable identity from sign-out and permits retry", () => {
  state.session.profile = null as unknown as typeof state.session.profile;
  const reload = vi.fn(); window.addEventListener("argos-account-login", reload);
  render(<AccountShell>{content}</AccountShell>);
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(reload).toHaveBeenCalledOnce();
  expect(screen.queryByText("Private result")).not.toBeInTheDocument();
  window.removeEventListener("argos-account-login", reload);
});
it("keeps loading in the shared shell and exposes only one h1", () => {
  state.session.ready = false;
  render(<AccountShell>{content}</AccountShell>);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  expect(screen.queryByText("Private result")).not.toBeInTheDocument();
});
it("closes the mobile disclosure on Escape, navigation and a changed route", () => {
  const view = render(<AccountShell>{content}</AccountShell>);
  const menu = screen.getByRole("button", { name: "Menu" });
  fireEvent.click(menu); expect(menu).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(menu, { key: "Escape" }); expect(menu).toHaveAttribute("aria-expanded", "false"); expect(menu).toHaveFocus();
  fireEvent.click(menu);
  const link = screen.getByRole("link", { name: "Analyse de site" });
  link.addEventListener("click", event => event.preventDefault(), { once: true });
  fireEvent.click(link);
  expect(menu).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(menu); state.path = "/account/sites"; view.rerender(<AccountShell>{content}</AccountShell>);
  expect(menu).toHaveAttribute("aria-expanded", "false");
});
it("localizes navigation and handles unlimited and zero quota without fake counts", () => {
  state.path = "/en/account/integrations"; state.session.usage.limit = null;
  const view = render(<LangProvider initialLang="en"><AccountShell>{content}</AccountShell></LangProvider>);
  expect(screen.getByRole("link", { name: /Unlimited credits/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Integrations/ })).toHaveAttribute("href", "/en/account/integrations");
  state.session.usage.limit = 0; state.session.usage.available=0; view.rerender(<LangProvider initialLang="en"><AccountShell>{content}</AccountShell></LangProvider>);
  expect(screen.getByRole("link", { name: "0 credits remaining" })).toBeInTheDocument();
});
it("does not install private chrome around public authentication forms", () => {
  state.path = "/account/sign-in";
  render(<AccountShell>{content}</AccountShell>);
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
});
it("closes navigation when the account opens and dismisses the account panel on route change", () => {
  vi.stubGlobal("matchMedia", () => ({addEventListener: vi.fn(), removeEventListener: vi.fn()}));
  const view = render(<AccountShell>{content}</AccountShell>);
  const navigation = screen.getByRole("button", {name: "Menu"});
  fireEvent.click(navigation);
  fireEvent.click(screen.getByRole("button", {name: /Menu du compte/}));
  expect(navigation).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("region", {name: "Menu du compte"})).toBeInTheDocument();
  state.path = "/account/sites"; view.rerender(<AccountShell>{content}</AccountShell>);
  expect(screen.queryByRole("region", {name: "Menu du compte"})).not.toBeInTheDocument();
});
it("does not replace an unavailable quota with zero or block access to results", () => {
  state.session.usage = null as unknown as typeof state.session.usage; state.session.usageError = true;
  render(<AccountShell>{content}</AccountShell>);
  expect(screen.getByText("Quota indisponible")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /crédits/ })).not.toBeInTheDocument();
  expect(screen.getByText("Private result")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(state.session.refreshUsage).toHaveBeenCalled();
});
