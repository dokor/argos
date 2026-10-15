// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@/lib/i18n/LangContext";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import AccountMenu from "./AccountMenu";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), invalidate: vi.fn(), onOpen: vi.fn(), breakpoint: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));
vi.mock("@/components/account/AccountSession", () => ({ useAccountSession: () => mocks }));
vi.mock("@/lib/account-client", () => ({ accountFetch: vi.fn(), AccountClientError: class extends Error {
  constructor(public code: string, public status: number) { super(code); }
} }));
const profile = { displayName: "Camille", email: null, verified: false };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(accountFetch).mockReset().mockResolvedValue({});
  vi.stubGlobal("matchMedia", () => ({ addEventListener: (_event: string, handler: () => void) => mocks.breakpoint.mockImplementation(handler), removeEventListener: vi.fn() }));
});
function menu(lang: "fr" | "en" = "fr") {
  return render(<LangProvider initialLang={lang}><AccountMenu profile={profile} onOpen={mocks.onOpen}/><button>Outside</button></LangProvider>);
}
it.each(["fr", "en"] as const)("offers localized settings and logout even before verification in %s", lang => {
  menu(lang);
  const trigger = screen.getByRole("button", { name: /Camille/ });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("region")).toHaveAttribute("id", trigger.getAttribute("aria-controls"));
  expect(screen.getByRole("link", {name: lang === "fr" ? "Mon compte" : "My account"})).toHaveAttribute("href", lang === "fr" ? "/account/settings" : "/en/account/settings");
  expect(screen.getByRole("button", {name: lang === "fr" ? "Se déconnecter" : "Sign out"})).toBeInTheDocument();
  expect(mocks.onOpen).toHaveBeenCalledOnce();
});
it("supports keyboard opening, tab order, Escape focus restoration and closing on focus departure", async () => {
  const user = userEvent.setup(); menu();
  const trigger = screen.getByRole("button", {name: /Camille/});
  await user.tab(); expect(trigger).toHaveFocus(); await user.keyboard("{Enter}");
  await user.tab(); expect(screen.getByRole("link")).toHaveFocus();
  await user.tab(); expect(screen.getByRole("button", {name: "Se déconnecter"})).toHaveFocus();
  await user.keyboard("{Escape}"); expect(trigger).toHaveFocus(); expect(trigger).toHaveAttribute("aria-expanded", "false");
  await user.keyboard(" "); await user.tab(); await user.tab(); await user.tab();
  expect(screen.getByRole("button", {name: "Outside"})).toHaveFocus(); expect(screen.queryByRole("region")).not.toBeInTheDocument();
});
it("closes on a second click, outside pointer, breakpoint change and settings navigation", () => {
  menu(); const trigger = screen.getByRole("button", {name: /Camille/});
  fireEvent.click(trigger); fireEvent.click(trigger); expect(screen.queryByRole("region")).not.toBeInTheDocument();
  fireEvent.click(trigger); fireEvent.pointerDown(screen.getByRole("button", {name: "Outside"})); expect(screen.queryByRole("region")).not.toBeInTheDocument();
  fireEvent.click(trigger); act(() => mocks.breakpoint()); expect(screen.queryByRole("region")).not.toBeInTheDocument();
  fireEvent.click(trigger); const link = screen.getByRole("link"); link.addEventListener("click", event => event.preventDefault(), {once: true}); fireEvent.click(link); expect(screen.queryByRole("region")).not.toBeInTheDocument();
});
it.each(["fr", "en"] as const)("sends a single logout POST and clears private state before localized navigation in %s", async lang => {
  let finish!: () => void;
  vi.mocked(accountFetch).mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  menu(lang); fireEvent.click(screen.getByRole("button", {name: /Camille/}));
  const logout = screen.getByRole("button", {name: lang === "fr" ? "Se déconnecter" : "Sign out"});
  fireEvent.click(logout); fireEvent.click(logout);
  expect(logout).toHaveAttribute("aria-disabled", "true"); expect(logout).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("status")).toHaveTextContent(lang === "fr" ? "Déconnexion…" : "Signing out…");
  expect(accountFetch).toHaveBeenCalledExactlyOnceWith("auth/logout", "POST", {});
  expect(mocks.replace).not.toHaveBeenCalled();
  await act(async () => finish());
  expect(mocks.invalidate).toHaveBeenCalledWith(expect.objectContaining({status: 401}));
  expect(mocks.replace).toHaveBeenCalledWith(lang === "fr" ? "/account/sign-in" : "/en/account/sign-in");
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
it.each([new Error("offline"), new AccountClientError("csrf_invalid", 403), new AccountClientError("rate_limited", 429)])("keeps the session and permits retry after logout failure %s", async reason => {
  vi.mocked(accountFetch).mockRejectedValueOnce(reason).mockResolvedValueOnce({});
  menu(); fireEvent.click(screen.getByRole("button", {name: /Camille/})); fireEvent.click(screen.getByRole("button", {name: "Se déconnecter"}));
  expect(await screen.findByRole("alert")).not.toBeEmptyDOMElement();
  expect(mocks.invalidate).not.toHaveBeenCalled(); expect(mocks.replace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "Se déconnecter"}));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
});
it("returns an already expired session to sign-in", async () => {
  vi.mocked(accountFetch).mockRejectedValueOnce(new AccountClientError("session_invalid", 401));
  menu(); fireEvent.click(screen.getByRole("button", {name: /Camille/})); fireEvent.click(screen.getByRole("button", {name: "Se déconnecter"}));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/account/sign-in"));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
