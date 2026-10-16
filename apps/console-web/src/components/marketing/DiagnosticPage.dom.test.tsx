// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import { argosApi } from "@/lib/ArgosApi";
import DiagnosticPage from "./DiagnosticPage";
import { diagnosticPages, diagnosticRoutes, type DiagnosticTopic } from "./diagnosticPages";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/ressources" }));
vi.mock("@/lib/ArgosApi", () => ({ argosApi: { createAudit: vi.fn() } }));
vi.mock("@/components/site/SiteNav", () => ({ default: () => null }));
vi.mock("@/components/site/SiteFooter", () => ({ default: () => null }));
vi.mock("@/components/security/useAntiBot", () => ({ useAntiBot: () => ({ verify: async () => undefined, element: null }) }));

const cases = (Object.keys(diagnosticRoutes) as DiagnosticTopic[]).flatMap(topic =>
  (["fr", "en"] as const).map(lang => ({ topic, lang })));

describe("diagnostic audit forms", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(cases)("validates, announces loading and service failure on $topic in $lang", async ({ topic, lang }) => {
    let rejectRequest!: (error: Error) => void;
    vi.mocked(argosApi.createAudit).mockImplementation(() => new Promise((_, reject) => { rejectRequest = reject; }));
    render(<LangProvider initialLang={lang}><DiagnosticPage topic={topic} lang={lang} /></LangProvider>);
    const input = screen.getByRole("textbox", { name: lang === "fr" ? "Adresse de la page publique à auditer" : "Public page URL to audit" });
    const button = screen.getByRole("button", { name: diagnosticPages[topic][lang].cta });
    fireEvent.change(input, { target: { value: "ftp://example.com" } });
    fireEvent.click(button);
    expect(screen.getByRole("alert")).toHaveTextContent(lang === "fr" ? "URL HTTP ou HTTPS valide" : "valid HTTP or HTTPS URL");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(argosApi.createAudit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.click(button);
    await waitFor(() => expect(argosApi.createAudit).toHaveBeenCalledWith({ url: "https://example.com", sourceRoute: diagnosticRoutes[topic], lang }));
    expect(button).toBeDisabled();
    expect(screen.getByText(lang === "fr" ? "Envoi de la demande…" : "Submitting request…", { selector: '[role="status"]' })).toBeInTheDocument();
    rejectRequest(new Error("private backend details"));
    expect(await screen.findByRole("alert")).toHaveTextContent(lang === "fr" ? "L'audit n'a pas pu démarrer" : "The audit could not start");
    expect(screen.getByRole("alert")).not.toHaveTextContent("private backend details");
    expect(input).toHaveValue("https://example.com");
    expect(button).toBeEnabled();
  });

  it.each(cases)("opens the private localized report on $topic in $lang", async ({ topic, lang }) => {
    vi.mocked(argosApi.createAudit).mockResolvedValue({ auditId: 1, runId: 2, status: "QUEUED", reportToken: "synthetic-diagnostic-token" });
    render(<LangProvider initialLang={lang}><DiagnosticPage topic={topic} lang={lang} /></LangProvider>);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "example.com" } });
    fireEvent.click(screen.getByRole("button", { name: diagnosticPages[topic][lang].cta }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`${lang === "en" ? "/en" : ""}/report/synthetic-diagnostic-token`));
  });
});
