// @vitest-environment jsdom
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  delete window.turnstile;
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => Response.json(url.includes("/api/antibot")
    ? { enabled: false } : { checkKeys: ["http.security.csp", "html.title"] })));
  vi.mocked(argosApi.createAudit).mockResolvedValue({ runId: 42, auditId: 7, status: "QUEUED", reportToken: "synthetic-new-token" });
});
afterEach(() => { vi.unstubAllGlobals(); delete window.turnstile; });
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
it("waits for a fresh CAPTCHA proof without losing the selected category", async () => {
  vi.mocked(fetch).mockImplementation(async () => Response.json({ enabled: true, siteKey: "synthetic-public-key" }));
  let options: Record<string, unknown> = {};
  const renderWidget = vi.fn((_element: HTMLElement, config: Record<string, unknown>) => { options = config; return "synthetic-widget"; });
  window.turnstile = { render: renderWidget, execute: vi.fn(), remove: vi.fn() };
  render(<ScopedRelaunch report={demoReport("fr")}/>);
  fireEvent.click(screen.getByText("Relancer une mesure"));
  fireEvent.change(screen.getByLabelText("Périmètre de la relance"), { target: { value: "category:seo" } });
  fireEvent.click(screen.getByRole("button", { name: /relancer/i }));
  await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
  expect(options).toMatchObject({ action: "audit" });
  expect(screen.getByLabelText("Périmètre de la relance")).toBeDisabled();
  expect(screen.getByRole("button")).toBeDisabled();
  expect(argosApi.createAudit).not.toHaveBeenCalled();
  await act(async () => { (options.callback as (proof: string) => void)("synthetic-captcha-proof"); });
  await waitFor(() => expect(argosApi.createAudit).toHaveBeenCalledWith(expect.objectContaining({ scope: { kind: "category", target: "seo" } }), "synthetic-captcha-proof"));
  expect(screen.getByLabelText("Périmètre de la relance")).toHaveValue("category:seo");
});
it("rejects a failed verification before creation and lets the user retry the same scope", async () => {
  vi.mocked(fetch).mockImplementation(async (input) => {
    if (String(input).includes("/api/antibot")) throw new Error("configuration unavailable");
    return Response.json({ checkKeys: [] });
  });
  render(<ScopedRelaunch report={demoReport("fr")}/>);
  fireEvent.click(screen.getByText("Relancer une mesure"));
  fireEvent.change(screen.getByLabelText("Périmètre de la relance"), { target: { value: "category:seo" } });
  fireEvent.click(screen.getByRole("button", { name: /relancer/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/vérification anti-robot/);
  expect(argosApi.createAudit).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Périmètre de la relance")).toHaveValue("category:seo");
  expect(screen.getByRole("button")).toBeEnabled();
  vi.mocked(fetch).mockImplementation(async () => Response.json({ enabled: false }));
  fireEvent.click(screen.getByRole("button", { name: /relancer/i }));
  await waitFor(() => expect(argosApi.createAudit).toHaveBeenCalled());
  expect(argosApi.createAudit).toHaveBeenCalledWith(expect.objectContaining({ scope: { kind: "category", target: "seo" } }));
});
it("keeps the hidden host and network unknown when only a CDN is observed", () => {
  const report = demoReport("fr");
  report.tech = { hosting: { method: "HTTP_HEADERS_V1", observedAt: report.generatedAt, applicationHost: null, networkProvider: null, cdnProxies: [{ name: "Cloudflare", confidence: "MEDIUM", evidence: ["cf-ray present"] }], originStatus: "UNKNOWN" } };
  render(<HostingSummary report={report}/>);
  expect(screen.getAllByText("Inconnu")).toHaveLength(2);
  expect(screen.getByText(/Cloudflare/)).toBeInTheDocument();
  expect(screen.getByText(/cf-ray présent/)).toBeInTheDocument();
});
