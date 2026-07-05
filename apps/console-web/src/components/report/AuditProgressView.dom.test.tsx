// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/ArgosApi", () => ({
  argosApi: { getReportStatus: vi.fn(), getReport: vi.fn() },
}));

import AuditProgressView from "./AuditProgressView";
import { argosApi } from "@/lib/ArgosApi";

describe("AuditProgressView (polling de progression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rafraîchit la page quand le run est COMPLETED et le rapport publié", async () => {
    vi.mocked(argosApi.getReportStatus).mockResolvedValue({
      status: "COMPLETED",
      runId: 1,
      moduleStatuses: "[]",
    } as never);
    vi.mocked(argosApi.getReport).mockResolvedValue({} as never);

    render(<AuditProgressView token="tok" />);

    await waitFor(() => expect(argosApi.getReport).toHaveBeenCalledWith("tok"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("affiche les modules en cours pendant l'analyse (RUNNING)", async () => {
    vi.mocked(argosApi.getReportStatus).mockResolvedValue({
      status: "RUNNING",
      runId: 1,
      moduleStatuses: JSON.stringify([{ id: "http", label: "HTTP", status: "RUNNING" }]),
    } as never);

    const { findByText } = render(<AuditProgressView token="tok" />);
    expect(await findByText("HTTP")).toBeInTheDocument();
    // Un run non terminé ne déclenche pas de refresh.
    expect(refresh).not.toHaveBeenCalled();
  });
});
