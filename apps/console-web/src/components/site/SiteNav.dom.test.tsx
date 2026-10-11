// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import { accountFetch, AccountClientError, type AccountProfile } from "@/lib/account-client";
import SiteNav from "./SiteNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/useIsAdmin", () => ({ useIsAdmin: () => false }));
vi.mock("@/components/ThemeToggle", () => ({ default: () => <button>Theme</button> }));
vi.mock("@/components/LangToggle", () => ({ default: () => <span>Languages</span> }));
vi.mock("@/lib/account-client", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/account-client")>(), accountFetch: vi.fn(),
}));

const profile: AccountProfile = { displayName: "Test", email: "test@example.com", verified: false };
beforeEach(() => { vi.mocked(accountFetch).mockReset(); });

it.each(["fr", "en"] as const)("links signed-out visitors directly to registration in %s", async lang => {
  vi.mocked(accountFetch).mockRejectedValue(new AccountClientError("session_invalid", 401));
  render(<LangProvider initialLang={lang}><SiteNav /></LangProvider>);
  expect(await screen.findByRole("link", { name: lang === "fr" ? "S’inscrire" : "Sign up" }))
    .toHaveAttribute("href", lang === "fr" ? "/account/register" : "/en/account/register");
  expect(screen.getByRole("link", { name: lang === "fr" ? "Audit gratuit" : "Free audit" }))
    .toHaveAttribute("href", lang === "fr" ? "/#audit" : "/en#audit");
});

it("updates after login and logout, including accounts awaiting email verification", async () => {
  vi.mocked(accountFetch).mockRejectedValueOnce(new AccountClientError("session_invalid", 401));
  render(<SiteNav />);
  await screen.findByRole("link", { name: "S’inscrire" });
  vi.mocked(accountFetch).mockResolvedValue(profile);
  act(() => window.dispatchEvent(new Event("argos-account-login")));
  expect(await screen.findByRole("link", { name: "Mon compte" })).toHaveAttribute("href", "/account");
  act(() => window.dispatchEvent(new Event("argos-account-invalid")));
  expect(screen.getByRole("link", { name: "S’inscrire" })).toHaveAttribute("href", "/account/register");
});

it("retains the account entry on service errors and retries on window focus", async () => {
  vi.mocked(accountFetch).mockRejectedValue(new AccountClientError("account_unavailable", 503));
  render(<SiteNav />);
  await waitFor(() => expect(accountFetch).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("link", { name: "Mon compte" })).toHaveAttribute("href", "/account");
  vi.mocked(accountFetch).mockRejectedValue(new AccountClientError("session_invalid", 401));
  act(() => window.dispatchEvent(new Event("focus")));
  await screen.findByRole("link", { name: "S’inscrire" });
});

it("ignores a stale session response after logout and aborts on unmount", async () => {
  let resolve!: (profile: AccountProfile) => void;
  vi.mocked(accountFetch).mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = render(<SiteNav />);
  const signal = vi.mocked(accountFetch).mock.calls[0][3];
  act(() => window.dispatchEvent(new Event("argos-account-invalid")));
  expect(signal?.aborted).toBe(true);
  await act(async () => resolve(profile));
  expect(screen.getByRole("link", { name: "S’inscrire" })).toBeInTheDocument();
  act(() => window.dispatchEvent(new Event("argos-account-login")));
  const nextSignal = vi.mocked(accountFetch).mock.calls[1][3];
  view.unmount();
  expect(nextSignal?.aborted).toBe(true);
});

it("opens the disclosure and restores focus to its toggle on Escape", () => {
  vi.mocked(accountFetch).mockResolvedValue(profile);
  render(<SiteNav />);
  const toggle = screen.getByRole("button", { name: "Ouvrir le menu" });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(screen.getByRole("link", { name: "Guides" }), { key: "Escape" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveFocus();
  fireEvent.click(toggle);
  const guides = screen.getByRole("link", { name: "Guides" });
  guides.addEventListener("click", event => event.preventDefault(), { once: true });
  fireEvent.click(guides);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
});
