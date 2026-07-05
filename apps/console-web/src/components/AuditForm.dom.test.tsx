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
      expect(argosApi.createAudit).toHaveBeenCalledWith({ url: "https://example.com" })
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
});
