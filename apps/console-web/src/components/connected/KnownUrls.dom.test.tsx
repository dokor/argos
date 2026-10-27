// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/test/render";
import { LangProvider } from "@/lib/i18n/LangProvider";
import KnownUrls from "./KnownUrls";
import AnalysisNavigation from "./AnalysisNavigation";
const state = vi.hoisted(() => ({ data: null as unknown, error: "", reload: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/account/analyses/new", useSearchParams: () => new URLSearchParams() }));
vi.mock("./domains/useDomainResource", () => ({ useDomainResource: () => state }));
beforeEach(() => { Object.assign(state, { data: null, error: "" }); state.reload.mockReset(); });
it("preserves exact URLs including queries and fragments without submitting, with contextual history", () => {
  const url = "https://atelier.example/produit?taille=M&couleur=bleu#details";
  state.data = { recentRuns: [{ pageId: "7", normalizedUrl: url }, { pageId: "7", normalizedUrl: url },
    { pageId: "8", normalizedUrl: "https://atelier.example/contact" }, { pageId: "9", normalizedUrl: "https://atelier.example/a" },
    { pageId: "10", normalizedUrl: "https://atelier.example/b" }] };
  render(<KnownUrls />);
  const links = screen.getAllByRole("link", { name: "Utiliser cette URL" });
  expect(links).toHaveLength(3);
  expect(links[0]).toHaveAttribute("href", `/account/analyses/new?url=${encodeURIComponent(url)}#analysis-url`);
  expect(screen.getAllByRole("link", { name: "Historique de cette URL" })[0]).toHaveAttribute("href", "/account/urls/7/history");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("distinguishes loading, empty history and read errors, and retries instead of displaying stale URLs", () => {
  const view = render(<KnownUrls />); expect(screen.getByRole("status")).toBeInTheDocument();
  state.data = { recentRuns: [] }; view.rerender(<KnownUrls />);
  expect(screen.getByText(/Aucune URL enregistrée/)).toBeInTheDocument();
  state.error = "account_unavailable"; view.rerender(<KnownUrls />);
  expect(screen.getByRole("status")).toHaveTextContent(/momentanément indisponibles/);
  expect(screen.queryByText(/Aucune URL enregistrée/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(state.reload).toHaveBeenCalledOnce();
});
it("localizes prefill and history links and offers a visible navigation shortcut", () => {
  state.data = { recentRuns: [{ pageId: "7", normalizedUrl: "https://atelier.example" }] };
  render(<LangProvider initialLang="en"><AnalysisNavigation active="new" /><KnownUrls /></LangProvider>);
  expect(screen.getByRole("link", { name: "Use this URL" })).toHaveAttribute("href", expect.stringMatching(/^\/en\/account\/analyses\/new/));
  expect(screen.getByRole("link", { name: "History for this URL" })).toHaveAttribute("href", "/en/account/urls/7/history");
  expect(screen.getByRole("link", { name: "URL history" })).toHaveAttribute("href", "#known-urls");
});
