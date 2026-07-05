// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mocks des dépendances externes (routing + client API).
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/ArgosApi", () => ({ argosApi: { createAudit: vi.fn() } }));

import RelaunchButton from "./RelaunchButton";
import { argosApi } from "@/lib/ArgosApi";

describe("RelaunchButton (relance d'analyse #9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // La relance ouvre le nouveau rapport dans un nouvel onglet : on simule un
    // window.open réussi (jsdom ne l'implémente pas nativement).
    vi.spyOn(window, "open").mockReturnValue({} as Window);
  });

  it("re-soumet la même URL au clic", async () => {
    (argosApi.createAudit as ReturnType<typeof vi.fn>).mockResolvedValue({
      runId: 42,
      auditId: 7,
      status: "QUEUED",
      reportToken: "tok-new",
    });

    render(<RelaunchButton url="https://example.com" />);

    const btn = screen.getByRole("button", { name: /nouvelle analyse|re-run/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(argosApi.createAudit).toHaveBeenCalledWith({ url: "https://example.com" });
    });
  });

  it("est désactivé sans URL", () => {
    render(<RelaunchButton url="" />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
