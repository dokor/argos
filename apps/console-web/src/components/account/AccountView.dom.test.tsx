// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import AccountSession from "./AccountSession";
import AccountView from "./AccountView";
import AccountSettings from "./AccountSettings";
import RunClaim from "./RunClaim";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("./AccountView.module.scss", () => ({ default: {} }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ push, refresh: vi.fn() }), usePathname: () => "/report/" + "r".repeat(43) }));
vi.mock("@/components/site/SiteNav", () => ({ default: () => null })); vi.mock("@/components/site/SiteFooter", () => ({ default: () => null }));
vi.mock("@/lib/account-client", () => ({ accountFetch: vi.fn(), AccountClientError: class extends Error { constructor(public code: string, public status: number) { super(code); } } }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");}; HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
  vi.mocked(accountFetch).mockReset(); push.mockReset(); window.history.replaceState(null, "", "/account");
  vi.mocked(accountFetch).mockImplementation(async path => path === "auth/providers" ? { providers: [], enabled: true } : path === "return" ? { returnTo: "/account" } : path === "me" ? { displayName: "Fixture", email: "fixture@example.com", verified: true } : []);
});
describe("account screens", () => {
  it.each(["fr", "en"] as const)("explains an OAuth email collision and the linking action in %s", async lang => {
    window.history.replaceState(null, "", "/account/sign-in?error=use_existing_account");
    render(<LangProvider initialLang={lang}><AccountView mode="sign-in" /></LangProvider>);
    const message = await screen.findByRole("alert");
    expect(message).toHaveTextContent(lang === "fr" ? "Un compte Argos utilise déjà cette adresse email." : "An Argos account already uses this email address.");
    expect(message).toHaveTextContent(lang === "fr" ? "Mon compte" : "My account");
    expect(message).not.toHaveTextContent(lang === "fr" ? "La connexion au fournisseur a échoué" : "Provider sign-in failed");
  });
  it.each(["fr", "en"] as const)("distinguishes expired sessions and service outages from invalid OAuth in %s", async lang => {
    for (const [error, text] of [
      ["session_invalid", lang === "fr" ? "Votre session est absente ou expirée" : "Your session is missing or expired"],
      ["account_unavailable", lang === "fr" ? "Le service est momentanément indisponible" : "The service is temporarily unavailable"],
    ]) {
      window.history.replaceState(null, "", "/account/sign-in?error=" + error);
      const view = render(<LangProvider initialLang={lang}><AccountView mode="sign-in" /></LangProvider>);
      expect(await screen.findByRole("alert")).toHaveTextContent(text);
      view.unmount();
    }
  });
  it("never renders arbitrary error content from a callback URL", async () => {
    window.history.replaceState(null, "", "/account/sign-in?error=" + encodeURIComponent("<script>secret</script>"));
    render(<AccountView mode="sign-in" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("La connexion au fournisseur a échoué. Réessayez.");
    expect(screen.queryByText(/secret/)).not.toBeInTheDocument();
  });
  it.each(["fr", "en"] as const)("makes public policy links available before either sign-in method in %s", async lang => {
    for (const mode of ["sign-in", "register"] as const) {
      const view = render(<LangProvider initialLang={lang}><AccountView mode={mode} /></LangProvider>);
      await waitFor(() => expect(accountFetch).toHaveBeenCalledWith("auth/providers"));
      expect(screen.getByRole("link", { name: lang === "fr" ? "conditions d’utilisation" : "terms of use" })).toHaveAttribute("href", lang === "fr" ? "/conditions-utilisation" : "/en/terms-of-use");
      expect(screen.getByRole("link", { name: lang === "fr" ? "politique de confidentialité" : "privacy policy" })).toHaveAttribute("href", lang === "fr" ? "/confidentialite" : "/en/privacy");
      view.unmount();
    }
  });
  it.each(["fr", "en"] as const)("offers contextual registration navigation and preserves the destination in %s", async lang => {
    const destination = lang === "fr" ? "/account/sites/42" : "/en/account/sites/42";
    window.history.replaceState(null, "", "/account/register?returnTo=" + encodeURIComponent(destination));
    render(<LangProvider initialLang={lang}><AccountView mode="register" /></LangProvider>);
    const signIn = screen.getByRole("link", { name: lang === "fr" ? "Se connecter" : "Sign in" });
    await waitFor(() => expect(signIn).toHaveAttribute("href", (lang === "fr" ? "" : "/en") + "/account/sign-in?returnTo=" + encodeURIComponent(destination)));
    expect(signIn.parentElement).toHaveTextContent(lang === "fr" ? "Vous avez déjà un compte ?" : "Already have an account?");
    expect(screen.queryByRole("link", { name: /oublié|Forgot password|Retour au site|Back to the site/ })).not.toBeInTheDocument();
  });
  it.each(["forgot", "reset", "verify"] as const)("offers only a return to sign-in on the %s screen", async mode => {
    render(<AccountView mode={mode} />);
    await waitFor(() => expect(accountFetch).toHaveBeenCalledWith("auth/providers"));
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Revenir à la connexion" })).toHaveAttribute("href", "/account/sign-in?returnTo=%2Faccount");
  });
  it("offers password recovery and contextual registration on sign-in", async () => {
    render(<AccountView mode="sign-in" />);
    await waitFor(() => expect(accountFetch).toHaveBeenCalledWith("auth/providers"));
    expect(screen.getByRole("link", { name: "Mot de passe oublié" })).toHaveAttribute("href", "/account/forgot?returnTo=%2Faccount");
    expect(screen.getByRole("link", { name: "Créer un compte" }).parentElement).toHaveTextContent("Vous n’avez pas encore de compte ?");
  });
  it.each(["fr", "en"] as const)("explains an expired form and lets the user resubmit without retyping in %s", async lang => {
    let attempts = 0;
    vi.mocked(accountFetch).mockImplementation(async path => {
      if (path === "auth/register" && attempts++ === 0) throw new AccountClientError("csrf_invalid", 403);
      return path === "auth/providers" ? { providers: [], enabled: true } : { returnTo: "/account/sites" };
    });
    render(<LangProvider initialLang={lang}><AccountView mode="register" /></LangProvider>);
    const email = screen.getByLabelText(lang === "fr" ? "Adresse email" : "Email address");
    const password = screen.getByLabelText(lang === "fr" ? "Mot de passe" : "Password");
    fireEvent.change(screen.getByLabelText(lang === "fr" ? "Nom d’affichage" : "Display name"), { target: { value: "Fixture" } });
    fireEvent.change(email, { target: { value: "fixture@example.com" } });
    fireEvent.change(password, { target: { value: "synthetic long password" } });
    const form = screen.getByRole("button", { name: lang === "fr" ? "Créer un compte" : "Create an account" }).closest("form")!;
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent(lang === "fr" ? "Le formulaire a expiré. Envoyez-le à nouveau." : "The form has expired. Submit it again.");
    expect(email).toHaveValue("fixture@example.com"); expect(password).toHaveValue("synthetic long password");
    fireEvent.submit(form);
    await screen.findByRole("status");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(attempts).toBe(2);
  });
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
    render(<AccountSession><AccountSettings/></AccountSession>);
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
    expect(screen.queryByRole("region", { name: "Ou continuer avec" })).not.toBeInTheDocument();
  });
  it.each(["fr", "en"] as const)("offers only social providers that are not already linked in %s", async lang => {
    window.history.replaceState(null, "", "/account/settings?section=connections");
    const fallback = vi.mocked(accountFetch).getMockImplementation()!;
    vi.mocked(accountFetch).mockImplementation(async (path, ...args) => {
      if (path === "auth/providers") return { providers: ["google", "github", "linkedin"], enabled: true };
      if (path === "methods") return [{ id: "1", provider: "github" }, { id: "2", provider: "google" }];
      return fallback(path, ...args);
    });
    render(<LangProvider initialLang={lang}><AccountSettings/></LangProvider>);
    const add = lang === "fr" ? "Associer" : "Link";
    expect(await screen.findByRole("button", { name: add + " LinkedIn" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: add + " GitHub" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: add + " Google" })).not.toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
  });
  it("waits for the linked methods before offering an association", async () => {
    window.history.replaceState(null, "", "/account/settings?section=connections");
    const fallback = vi.mocked(accountFetch).getMockImplementation()!;
    let resolveMethods!: (value: { id: string; provider: string }[]) => void;
    const pendingMethods = new Promise<{ id: string; provider: string }[]>(resolve => { resolveMethods = resolve; });
    vi.mocked(accountFetch).mockImplementation(async (path, ...args) => {
      if (path === "auth/providers") return { providers: ["github"], enabled: true };
      if (path === "methods") return pendingMethods;
      return fallback(path, ...args);
    });
    render(<AccountSettings/>);
    await waitFor(() => expect(accountFetch).toHaveBeenCalledWith("methods", "GET", undefined, expect.any(AbortSignal)));
    expect(screen.queryByRole("button", { name: "Associer GitHub" })).not.toBeInTheDocument();
    resolveMethods([{ id: "1", provider: "github" }]);
    await screen.findByText("GitHub");
    expect(screen.queryByRole("button", { name: "Associer GitHub" })).not.toBeInTheDocument();
  });
  it("offers a provider again after its method is removed", async () => {
    window.history.replaceState(null, "", "/account/settings?section=connections");
    const fallback = vi.mocked(accountFetch).getMockImplementation()!;
    let methods = [{ id: "1", provider: "github" }, { id: "2", provider: "password" }];
    vi.mocked(accountFetch).mockImplementation(async (path, ...args) => {
      if (path === "auth/providers") return { providers: ["github"], enabled: true };
      if (path === "methods") return methods;
      if (path === "methods/1/remove") { methods = methods.filter(method => method.id !== "1"); return { accepted: true }; }
      return fallback(path, ...args);
    });
    render(<AccountSettings/>);
    const github = await screen.findByText("GitHub");
    expect(screen.queryByRole("button", { name: "Associer GitHub" })).not.toBeInTheDocument();
    fireEvent.click(github.closest("li")!.querySelector("button")!);
    fireEvent.change(screen.getByLabelText("Mot de passe actuel"), {target:{value:"synthetic long password"}});
    fireEvent.submit(screen.getByRole("button",{name:"Confirmer et continuer"}).closest("form")!);
    expect(await screen.findByRole("button", { name: "Associer GitHub" })).toBeEnabled();
    expect(screen.getByText("Aucun compte associé")).toBeInTheDocument();
    expect(accountFetch).toHaveBeenCalledWith("methods/1/remove", "POST", { confirmed: true });
  });
  it("keeps the connection email read-only", async () => {
    render(<AccountSettings/>);
    expect(await screen.findByLabelText("Adresse email")).toHaveAttribute("readonly");
    expect(screen.getByText("L’adresse de connexion est en lecture seule.")).toBeInTheDocument();
  });
  it("shows a claim action only for this browser's precise run and a verified user", async () => {
    vi.mocked(accountFetch).mockImplementation(async path => path === "claim-context" ? { runId: "42" } : { displayName: "Fixture", email: "fixture@example.com", verified: true });
    render(<RunClaim />);
    fireEvent.click(await screen.findByRole("button", { name: "Conserver cette analyse dans mon compte" }));
    await waitFor(() => expect(accountFetch).toHaveBeenCalledWith("runs/42/claim", "POST", {}));
    expect(await screen.findByRole("status")).toHaveTextContent("rattachée");
  });
});

it.each([
  ["fr", "sign-in"], ["fr", "register"], ["en", "sign-in"], ["en", "register"],
] as const)("offers labelled social actions and preserves the OAuth destination on %s %s", async (lang, mode) => {
  const returnTo = "/report/" + "r".repeat(43);
  window.history.replaceState(null, "", "/account/" + mode + "?returnTo=" + returnTo);
  vi.mocked(accountFetch).mockImplementation(async path => {
    if (path === "auth/providers") return { providers: ["google", "github", "linkedin"], enabled: true };
    if (path.startsWith("auth/oauth/")) throw new AccountClientError("oauth_invalid", 400);
    return {};
  });
  render(<LangProvider initialLang={lang}><AccountView mode={mode} /></LangProvider>);
  const prefix = lang === "fr" ? "Continuer avec " : "Continue with ";
  for (const provider of ["Google", "GitHub", "LinkedIn"]) {
    expect(await screen.findByRole("button", { name: prefix + provider })).toBeEnabled();
  }
  fireEvent.click(screen.getByRole("button", { name: prefix + "GitHub" }));
  await waitFor(() => expect(accountFetch).toHaveBeenCalledWith("auth/oauth/github/start", "POST", { intent: "login", returnTo }));
  expect(await screen.findByRole("alert")).toHaveTextContent(lang === "fr" ? "La connexion au fournisseur a échoué." : "Provider sign-in failed.");
});
