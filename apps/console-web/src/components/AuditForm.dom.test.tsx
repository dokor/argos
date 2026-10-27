// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/test/render";

// Mocks des dépendances externes (routing + client API).
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/ArgosApi", () => ({ argosApi: { createAudit: vi.fn() } }));

import AuditForm from "./AuditForm";
import { argosApi } from "@/lib/ArgosApi";
import { LangProvider } from "@/lib/i18n/LangProvider";

describe("AuditForm (soumission d'audit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "open").mockReturnValue({} as Window);
  });

  it("reacts to recognized URLs without submitting and preserves the normal submission", async () => {
    vi.mocked(argosApi.createAudit).mockResolvedValue({ auditId: 1, runId: 2, reportToken: "mirror-token", status: "QUEUED" } as never);
    render(<AuditForm />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "argos.lelouet.fr" } });
    expect(screen.getByRole("status")).toHaveTextContent("Qui audite l’auditeur ? Bien vu.");
    expect(argosApi.createAudit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(argosApi.createAudit).toHaveBeenCalledExactlyOnceWith({ url: "https://argos.lelouet.fr", sourceRoute: "/", lang: "fr" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/report/mirror-token"));
  });

  it("localizes domain surprises and clears them when the hostname no longer matches", () => {
    render(<LangProvider initialLang="en"><AuditForm /></LangProvider>);
    const input = screen.getByRole("textbox");
    for (const [url, message] of [
      ["google.fr", "Today, we’re the ones looking at Google."],
      ["en.wikipedia.org", "We’ll check. They taught us that."],
      ["github.com", "Let’s see what’s behind all those commits."],
      ["amazon.com", "Your recommendations are out for delivery."],
    ]) {
      fireEvent.change(input, { target: { value: url } });
      expect(screen.getByRole("status")).toHaveTextContent(message);
    }
    fireEvent.change(input, { target: { value: "https://google.com.evil.test" } });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(argosApi.createAudit).not.toHaveBeenCalled();
  });

  it("crée par défaut un audit public puis ouvre le rapport dans le même onglet", async () => {
    vi.mocked(argosApi.createAudit).mockResolvedValue({
      auditId: 1,
      runId: 2,
      reportToken: "tok123",
      status: "QUEUED",
      normalizedUrl: "https://example.com",
    } as never);

    render(<AuditForm />);
    // Le schéma manquant est complété par le hook (example.com -> https://example.com).
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "example.com" } });
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(argosApi.createAudit).toHaveBeenCalledWith({ url: "https://example.com", sourceRoute: "/", lang: "fr" })
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/report/tok123")
    );
    expect(window.open).not.toHaveBeenCalled();
  });

  it("n'appelle pas l'API quand l'URL est vide", () => {
    render(<AuditForm />);
    fireEvent.click(screen.getByRole("button"));
    expect(argosApi.createAudit).not.toHaveBeenCalled();
  });

  it("refuse une URL publique invalide avec un message accessible", () => {
    render(<AuditForm mode="public" sourceRoute="/ressources/audit-site-pme" />);
    const input = screen.getByRole("textbox", { name: "Adresse de la page publique à auditer" });
    fireEvent.change(input, { target: { value: "ftp://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Lancer un audit gratuit" }));

    expect(screen.getByRole("alert").textContent).toContain("URL HTTP ou HTTPS valide");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(argosApi.createAudit).not.toHaveBeenCalled();
  });

  it("soumet l'audit public puis ouvre sa progression dans le même onglet", async () => {
    vi.mocked(argosApi.createAudit).mockResolvedValue({
      auditId: 1, runId: 2, reportToken: "public-token", status: "QUEUED",
    } as never);
    render(<AuditForm mode="public" sourceRoute="/ressources/audit-site-ecommerce" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "shop.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Lancer un audit gratuit" }));

    await waitFor(() => expect(argosApi.createAudit).toHaveBeenCalledWith({ url: "https://shop.example.com", sourceRoute: "/ressources/audit-site-ecommerce", lang: "fr" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/report/public-token"));
    expect(window.open).not.toHaveBeenCalled();
  });

  it("attribue un audit lancé depuis la checklist", async () => {
    vi.mocked(argosApi.createAudit).mockResolvedValue({
      auditId: 1, runId: 2, reportToken: "checklist-token", status: "QUEUED",
    } as never);
    render(<AuditForm mode="public" sourceRoute="/guides/checklist-audit-site-web" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Lancer un audit gratuit" }));

    await waitFor(() => expect(argosApi.createAudit).toHaveBeenCalledWith({
      url: "https://example.com",
      sourceRoute: "/guides/checklist-audit-site-web", lang: "fr",
    }));
  });

  it("annonce en anglais une erreur de création sans exposer le message serveur", async () => {
    vi.mocked(argosApi.createAudit).mockRejectedValue(new Error("Service temporarily unavailable"));
    render(<LangProvider initialLang="en"><AuditForm mode="public" sourceRoute="/ressources/audit-site-pme" /></LangProvider>);
    await screen.findByRole("button", { name: "Run a free audit" });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Run a free audit" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The audit could not start");
    expect(alert.textContent).not.toContain("Service temporarily unavailable");
  });
});

vi.mock("@/components/security/useAntiBot",()=>({useAntiBot:()=>({verify:async()=>undefined,element:null})}));

it("explains backend verification outages and preserves the audit URL",async()=>{
 vi.mocked(argosApi.createAudit).mockRejectedValue(Object.assign(new Error("antibot_unavailable"),{code:"antibot_unavailable"}));
 render(<AuditForm/>);fireEvent.change(screen.getByRole("textbox"),{target:{value:"https://example.com/"}});fireEvent.click(screen.getByRole("button"));
 expect(await screen.findByRole("alert")).toHaveTextContent("La vérification anti-robot est indisponible");expect(screen.getByRole("textbox")).toHaveValue("https://example.com/");
});
