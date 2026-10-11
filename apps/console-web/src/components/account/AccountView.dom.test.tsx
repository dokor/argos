// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import AccountSession from "./AccountSession";
import AccountView from "./AccountView";
import RunClaim from "./RunClaim";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("./AccountView.module.scss", () => ({ default: {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }), usePathname: () => "/report/" + "r".repeat(43) }));
vi.mock("@/components/site/SiteNav", () => ({ default: () => null })); vi.mock("@/components/site/SiteFooter", () => ({ default: () => null }));
vi.mock("@/lib/account-client", () => ({ accountFetch: vi.fn(), AccountClientError: class extends Error { constructor(public code: string, public status: number) { super(code); } } }));
beforeEach(() => {
  vi.mocked(accountFetch).mockReset(); push.mockReset(); window.history.replaceState(null, "", "/account");
  vi.mocked(accountFetch).mockImplementation(async path => path === "auth/providers" ? { providers: [], enabled: true } : path === "return" ? { returnTo: "/account" } : path === "me" ? { displayName: "Fixture", email: "fixture@example.com", verified: true } : []);
});
describe("account screens", () => {
  it.each(["register", "sign-in", "forgot", "verify", "reset"] as const)("does not warn about a missing session on the public %s screen", async mode => {
    vi.mocked(accountFetch).mockImplementation(async path => {
      if (path === "me") throw new AccountClientError("session_invalid", 401);
      return path === "auth/providers" ? { providers: [], enabled: false } : { returnTo: "/account/sites" };
    });
    render(<AccountSession><AccountView mode={mode} /></AccountSession>);
    await screen.findByText("La création de comptes est momentanément indisponible.");
    await waitFor(() => expect(accountFetch).toHaveBeenCalledWith("me"));
    expect(screen.queryByText("Votre session est absente ou expirée. Connectez-vous à nouveau.")).not.toBeInTheDocument();
  });
  it("keeps the session warning on the protected account screen", async () => {
    vi.mocked(accountFetch).mockImplementation(async path => {
      if (path === "me") throw new AccountClientError("session_invalid", 401);
      return path === "auth/providers" ? { providers: [], enabled: true } : { returnTo: "/account/sites" };
    });
    render(<AccountSession><AccountView /></AccountSession>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Votre session est absente ou expirée. Connectez-vous à nouveau.");
  });
  it.each(["fr", "en"] as const)("labels registration fields and confirms email without revealing credentials in %s", async lang => {
    render(<LangProvider initialLang={lang}><AccountView mode="register" /></LangProvider>);
    fireEvent.change(screen.getByLabelText(lang === "fr" ? "Nom d’affichage" : "Display name"), { target: { value: "Fixture" } });
    fireEvent.change(screen.getByLabelText(lang === "fr" ? "Adresse email" : "Email address"), { target: { value: "fixture@example.com" } });
    fireEvent.change(screen.getByLabelText(lang === "fr" ? "Mot de passe" : "Password"), { target: { value: "a long synthetic passphrase" } });
    fireEvent.submit(screen.getByRole("button", { name: lang === "fr" ? "Créer un compte" : "Create an account" }).closest("form")!);
    await waitFor(() => expect(accountFetch).toHaveBeenCalledWith("auth/register", "POST", expect.objectContaining({ displayName: "Fixture" })));
    expect(await screen.findByRole("status")).toHaveTextContent(lang === "fr" ? "email" : "email");
    expect(screen.getByLabelText(lang === "fr" ? "Mot de passe" : "Password")).toHaveValue("");
  });
  it("requires an explicit POST to consume the email fragment token", async () => {
    window.history.replaceState(null, "", "/account/verify#token=" + "v".repeat(43));
    render(<AccountView mode="verify" />);
    await waitFor(() => expect(window.location.hash).toBe(""));
    expect(vi.mocked(accountFetch).mock.calls.some(c => c[0] === "auth/verify")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Vérifier mon adresse" }));
    await waitFor(() => expect(accountFetch).toHaveBeenCalledWith("auth/verify", "POST", { token: "v".repeat(43) }));
  });
  it("does not render unconfigured social buttons", async () => {
    render(<AccountView mode="sign-in" />);
    await waitFor(() => expect(accountFetch).toHaveBeenCalledWith("auth/providers"));
    expect(screen.queryByRole("button", { name: "Google" })).not.toBeInTheDocument();
  });
  it("disables archival until its explicit confirmation and keeps email read-only", async () => {
    render(<AccountView />);
    const close = await screen.findByRole("button", { name: "Fermer mon compte" }); expect(close).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Je confirme la fermeture de mon compte.")); expect(close).toBeEnabled();
    expect(screen.getByText("L’adresse de connexion est en lecture seule.")).toBeInTheDocument();
    fireEvent.click(close);
    await waitFor(() => expect(accountFetch).toHaveBeenCalledWith("me/archive", "POST", { confirmed: true }));
  });
  it("shows a claim action only for this browser's precise run and a verified user", async () => {
    vi.mocked(accountFetch).mockImplementation(async path => path === "claim-context" ? { runId: "42" } : { displayName: "Fixture", email: "fixture@example.com", verified: true });
    render(<RunClaim />);
    fireEvent.click(await screen.findByRole("button", { name: "Conserver cette analyse dans mon compte" }));
    await waitFor(() => expect(accountFetch).toHaveBeenCalledWith("runs/42/claim", "POST", {}));
    expect(await screen.findByRole("status")).toHaveTextContent("rattachée");
  });
});
