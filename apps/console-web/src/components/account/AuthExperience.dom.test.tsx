// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@/lib/i18n/LangContext";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { PUBLIC_CONTACT } from "@/lib/publicContact";
import AccountView from "./AccountView";

vi.mock("next/navigation", () => ({ usePathname: () => window.location.pathname, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/account-client", async original => ({ ...await original<typeof import("@/lib/account-client")>(), accountFetch: vi.fn() }));
beforeEach(() => {
  window.history.replaceState(null, "", "/account/sign-in");
  vi.mocked(accountFetch).mockReset().mockImplementation(async path => path === "auth/providers" ? { providers: ["github"], enabled: true } : { returnTo: "/account/sites" });
});

it.each([
  ["fr", "sign-in"], ["fr", "register"], ["fr", "reset"],
  ["en", "sign-in"], ["en", "register"], ["en", "reset"],
] as const)("reveals passwords without losing input, selection or pointer/keyboard focus in %s %s", async (lang, mode) => {
  const user = userEvent.setup();
    window.history.replaceState(null, "", "/account/" + mode + (mode === "reset" ? "#token=synthetic-token" : ""));
    const view = render(<LangProvider initialLang={lang}><AccountView mode={mode}/></LangProvider>);
    const input = await screen.findByLabelText(lang === "fr" ? "Mot de passe" : "Password") as HTMLInputElement;
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", mode === "sign-in" ? "current-password" : "new-password");
    await user.click(input);
    await user.paste("a synthetic passphrase");
    input.setSelectionRange(2, 8, "backward");
    const toggle = screen.getByRole("button", { name: lang === "fr" ? "Afficher le mot de passe" : "Show password" });
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAttribute("aria-controls", "password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("a synthetic passphrase");
    expect(input).toHaveFocus();
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([2, 8, "backward"]);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAccessibleName(lang === "fr" ? "Masquer le mot de passe" : "Hide password");
    await user.tab();
    expect(toggle).toHaveFocus();
    await user.keyboard(" ");
    expect(toggle).toHaveFocus();
    expect(input).toHaveAttribute("type", "password");
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 8]);
    await user.keyboard("{Enter}");
    expect(input).toHaveAttribute("type", "text");
    expect(vi.mocked(accountFetch).mock.calls.some(call => call[1] === "POST")).toBe(false);
    view.unmount();
});

it.each(["fr", "en"] as const)("keeps recovery next to the password and before social alternatives in %s", async lang => {
  render(<LangProvider initialLang={lang}><AccountView/></LangProvider>);
  const recovery = screen.getByRole("link", { name: lang === "fr" ? "Mot de passe oublié" : "Forgot password" });
  const social = await screen.findByRole("button", { name: /GitHub/ });
  expect(recovery.closest("form")).toContainElement(screen.getByLabelText(lang === "fr" ? "Mot de passe" : "Password"));
  expect(recovery.compareDocumentPosition(social) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it.each(["fr", "en"] as const)("explains reset, prevents duplicate requests and allows email correction in %s", async lang => {
  let finish!: (value: unknown) => void;
  const fallback = vi.mocked(accountFetch).getMockImplementation()!;
  vi.mocked(accountFetch).mockImplementation((path, ...args) => path === "auth/forgot" ? new Promise(resolve => { finish = resolve; }) : fallback(path, ...args));
  render(<LangProvider initialLang={lang}><AccountView mode="forgot"/></LangProvider>);
  const email = screen.getByLabelText(lang === "fr" ? "Adresse email" : "Email address");
  const submit = screen.getByRole("button", { name: lang === "fr" ? "Envoyer le lien de réinitialisation" : "Send password reset link" });
  expect(screen.getByText(lang === "fr" ? /Saisissez l’adresse email de votre compte/ : /Enter your account’s email address/)).toBeInTheDocument();
  expect(screen.getByText(lang === "fr" ? /uniquement un fournisseur externe/ : /only use an external provider/)).toBeInTheDocument();
  fireEvent.change(email, { target: { value: "fixture@example.invalid" } });
  fireEvent.submit(submit.closest("form")!);
  expect(submit).toBeDisabled();
  expect(submit).toHaveAttribute("aria-busy", "true");
  expect(email).toBeDisabled();
  fireEvent.submit(submit.closest("form")!);
  await waitFor(()=>expect(vi.mocked(accountFetch).mock.calls.filter(call => call[0] === "auth/forgot")).toHaveLength(1));
  await act(async () => finish({ sent: true }));
  const notice = await screen.findByRole("status");
  expect(notice).toHaveFocus();
  expect(notice).toHaveTextContent(lang === "fr" ? /Si cette adresse correspond à un compte éligible/ : /If this address belongs to an eligible account/);
  expect(notice).toHaveTextContent(lang === "fr" ? /courriers indésirables/ : /spam folder/);
  expect(screen.queryByLabelText(lang === "fr" ? "Adresse email" : "Email address")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: lang === "fr" ? "Corriger l’adresse email" : "Correct email address" }));
  const restored = screen.getByLabelText(lang === "fr" ? "Adresse email" : "Email address");
  expect(restored).toHaveFocus();
  expect(restored).toHaveValue("fixture@example.invalid");
  fireEvent.change(restored, { target: { value: "corrected@example.invalid" } });
  fireEvent.submit(restored.closest("form")!);
  await waitFor(()=>expect(accountFetch).toHaveBeenLastCalledWith("auth/forgot", "POST", { email: "corrected@example.invalid", returnTo: (lang === "fr" ? "" : "/en") + "/account/sites" }));
  await act(async () => finish({ sent: true }));
});

it.each(["fr", "en"] as const)("keeps the recovery address and enables retry after a service error in %s", async lang => {
  const fallback = vi.mocked(accountFetch).getMockImplementation()!;
  vi.mocked(accountFetch).mockImplementation(async (path, ...args) => {
    if (path === "auth/forgot") throw new AccountClientError("rate_limited", 429);
    return fallback(path, ...args);
  });
  render(<LangProvider initialLang={lang}><AccountView mode="forgot"/></LangProvider>);
  const email = screen.getByLabelText(lang === "fr" ? "Adresse email" : "Email address");
  fireEvent.change(email, { target: { value: "fixture@example.invalid" } });
  fireEvent.submit(email.closest("form")!);
  const error = await screen.findByRole("alert");
  await waitFor(() => expect(error).toHaveFocus());
  expect(error).toHaveTextContent(/15/);
  expect(email).toHaveValue("fixture@example.invalid");
  expect(email).toBeEnabled();
  expect(screen.getByRole("button", { name: lang === "fr" ? "Envoyer le lien de réinitialisation" : "Send password reset link" })).toBeEnabled();
});

it.each(["fr", "en"] as const)("retains a localized public exit, preferences and compact help/legal footer on every auth screen in %s", async lang => {
  for (const mode of ["sign-in", "register", "forgot", "reset", "verify"] as const) {
    window.history.replaceState(null, "", (lang === "fr" ? "" : "/en") + "/account/" + mode);
    const view = render(<LangProvider initialLang={lang}><AccountView mode={mode}/></LangProvider>);
    await waitFor(() => expect(accountFetch).toHaveBeenCalledWith("auth/providers"));
    const header = within(screen.getByRole("banner"));
    expect(header.getByRole("link", { name: /Argos/ })).toHaveAttribute("href", lang === "fr" ? "/" : "/en");
    expect(header.getByRole("button", { name: lang === "fr" ? "Passer en thème sombre" : "Switch to dark theme" })).toBeInTheDocument();
    expect(header.getByRole("link", { name: "English" }).getAttribute("href")?.split("?")[0]).toBe("/en/account/" + mode);
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByRole("link", { name: lang === "fr" ? "Aide" : "Help" })).toHaveAttribute("href", lang === "fr" ? "/faq" : "/en/faq");
    expect(footer.getByRole("link", { name: "Contact" })).toHaveAttribute("href", PUBLIC_CONTACT.emailHref);
    expect(footer.getByRole("link", { name: lang === "fr" ? "Confidentialité" : "Privacy" })).toHaveAttribute("href", lang === "fr" ? "/confidentialite" : "/en/privacy");
    expect(footer.getByRole("link", { name: lang === "fr" ? "Conditions d’utilisation" : "Terms of use" })).toHaveAttribute("href", lang === "fr" ? "/conditions-utilisation" : "/en/terms-of-use");
    expect(screen.queryByRole("link", { name: lang === "fr" ? "Audit gratuit" : "Free audit" })).not.toBeInTheDocument();
    view.unmount();
  }
});

vi.mock("@/components/security/useAntiBot",()=>({useAntiBot:()=>({verify:async()=>undefined,element:null})}));
