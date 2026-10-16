// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/ArgosApi", () => ({ argosApi: { createAudit: vi.fn() } }));
import { argosApi } from "@/lib/ArgosApi";
import ScopedRelaunch from "./ScopedRelaunch";
import HostingSummary from "./HostingSummary";
import { demoReport } from "@/components/marketing/reportDemoFixture";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "open").mockReturnValue({} as Window);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ checkKeys: ["http.security.csp", "html.title"] })));
  vi.mocked(argosApi.createAudit).mockResolvedValue({ runId: 42, auditId: 7, status: "QUEUED", reportToken: "synthetic-new-token" });
});
afterEach(() => vi.unstubAllGlobals());
it.each(["full", "category:seo", "check:http.security.csp"])("creates an independent run with scope %s", async value => {
  const report = demoReport("fr");
  report.issues = [{ id: "http.security.csp", categoryKey: "security", module: "http", title: "CSP", severity: "important", impact: "Protection", recommendation: "Définir une politique" }];
  render(<ScopedRelaunch report={report}/>);
  fireEvent.click(screen.getByText("Relancer une mesure"));
  await screen.findByRole("option", { name: "http.security.csp" });
  fireEvent.change(screen.getByLabelText("Périmètre de la relance"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /relancer/i }));
  const [kind, target] = value.split(":");
  await waitFor(() => expect(argosApi.createAudit).toHaveBeenCalledWith(expect.objectContaining({ url: report.url, scope: kind === "full" ? { kind } : { kind, target } })));
});
it("retains an accessible retry after a quota rejection", async () => {
  vi.mocked(argosApi.createAudit).mockRejectedValue(new Error("quota_exceeded"));
  render(<ScopedRelaunch report={demoReport("fr")}/>);
  fireEvent.click(screen.getByText("Relancer une mesure"));
  fireEvent.click(screen.getByRole("button", { name: /relancer/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Échec/);
  expect(screen.getByRole("button", { name: /relancer/i })).toBeEnabled();
});
it("keeps the hidden host and network unknown when only a CDN is observed", () => {
  const report = demoReport("fr");
  report.tech = { hosting: { method: "HTTP_HEADERS_V1", observedAt: report.generatedAt, applicationHost: null, networkProvider: null, cdnProxies: [{ name: "Cloudflare", confidence: "MEDIUM", evidence: ["cf-ray present"] }], originStatus: "UNKNOWN" } };
  render(<HostingSummary report={report}/>);
  expect(screen.getAllByText("Inconnu")).toHaveLength(2);
  expect(screen.getByText(/Cloudflare/)).toBeInTheDocument();
  expect(screen.getByText(/cf-ray présent/)).toBeInTheDocument();
});
