// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@/components/account/RunClaim", () => ({ default: () => null }));
import { act, cleanup, render, screen, waitFor } from "@/test/render";

const { refresh, router } = vi.hoisted(() => {
  const refresh = vi.fn();
  return { refresh, router: { refresh, push: vi.fn(), replace: vi.fn() } };
});
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));
vi.mock("@/lib/ArgosApi", () => ({
  argosApi: { getReportStatus: vi.fn(), getReport: vi.fn() },
}));

import AuditProgressView from "./AuditProgressView";
import { argosApi } from "@/lib/ArgosApi";

describe("AuditProgressView (polling de progression)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  const finishedModules = JSON.stringify([
    { id: "http", label: "HTTP", status: "COMPLETED" },
    { id: "runtime", label: "Runtime", status: "FAILED" },
    { id: "ssl", label: "TLS", status: "SKIPPED" },
  ]);

  it("explique la finalisation et ouvre le rapport au prochain poll rapide", async () => {
    vi.useFakeTimers();
    vi.mocked(argosApi.getReportStatus)
      .mockResolvedValueOnce({ status: "RUNNING", moduleStatuses: finishedModules } as never)
      .mockResolvedValue({ status: "COMPLETED", moduleStatuses: finishedModules } as never);
    vi.mocked(argosApi.getReport).mockResolvedValue({} as never);
    await act(async () => { render(<AuditProgressView token="tok" />); });
    expect(screen.getByRole("heading", { name: "Préparation du rapport…" })).toBeInTheDocument();
    expect(screen.getByText(/Argos calcule les scores/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Ouverture du rapport…" })).toBeInTheDocument();
  });

  it("attend la disponibilité réelle du rapport et retente après 500 ms", async () => {
    vi.useFakeTimers();
    vi.mocked(argosApi.getReportStatus).mockResolvedValue({ status: "COMPLETED", moduleStatuses: finishedModules } as never);
    vi.mocked(argosApi.getReport).mockRejectedValueOnce(new Error("Not published yet")).mockResolvedValue({} as never);
    await act(async () => { render(<AuditProgressView token="tok" />); });
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("conserve quatre minutes d'attente malgré le polling plus rapide et l'arrête au démontage", async () => {
    vi.useFakeTimers();
    vi.mocked(argosApi.getReportStatus).mockResolvedValue({ status: "RUNNING", moduleStatuses: finishedModules } as never);
    let view: ReturnType<typeof render>;
    await act(async () => { view = render(<AuditProgressView token="tok" />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(239500); });
    expect(screen.queryByText(/plus de temps que prévu/)).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.getByText(/plus de temps que prévu/)).toBeInTheDocument();
    view!.unmount();
    const calls = vi.mocked(argosApi.getReportStatus).mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(argosApi.getReportStatus).toHaveBeenCalledTimes(calls);
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
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    // Un run non terminé ne déclenche pas de refresh.
    expect(refresh).not.toHaveBeenCalled();
  });
});
