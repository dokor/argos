// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mocks des dépendances externes (routing + client API).
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/ArgosApi", () => ({ argosApi: { createAudit: vi.fn() } }));

import AuditForm from "./AuditForm";
import { argosApi } from "@/lib/ArgosApi";
import { LangProvider } from "@/lib/i18n/LangContext";

describe("AuditForm (soumission d'audit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Le dashboard ouvre le rapport dans un nouvel onglet (#169) : on simule un
    // window.open réussi (jsdom ne l'implémente pas nativement).
    vi.spyOn(window, "open").mockReturnValue({} as Window);
  });

  it("crée un audit avec l'URL normalisée puis ouvre le rapport dans un nouvel onglet", async () => {
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
      expect(window.open).toHaveBeenCalledWith("/report/tok123", "_blank")
    );
    // Nouvel onglet ouvert : pas de navigation dans l'onglet courant.
    expect(push).not.toHaveBeenCalled();
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
