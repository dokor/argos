// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { LangProvider } from "@/lib/i18n/LangProvider";
import fr from "@/lib/i18n/fr.json";
import en from "@/lib/i18n/en.json";
import ReportAiPrompt from "./ReportAiPrompt";
import { buildReportAiPrompt } from "./buildAiCorrectionPrompt";
import historical from "./fixtures/historical-report.json";
import type { Report } from "./types";

const report = historical as Report;
vi.mock("@/lib/account-client", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/account-client")>(), accountFetch: vi.fn() }));
beforeEach(() => { vi.mocked(accountFetch).mockReset().mockResolvedValue({ prompt: buildReportAiPrompt(report, "fr") }); });
afterEach(() => vi.restoreAllMocks());

describe("report prompt copy", () => {
  it.each(["fr", "en"] as const)("copies the complete preview and announces success in %s", async lang => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const copy = (lang === "fr" ? fr : en).report.aiPrompt;
    vi.mocked(accountFetch).mockResolvedValue({ prompt: buildReportAiPrompt(report, lang) });
    render(<LangProvider initialLang={lang}><ReportAiPrompt kind="run" id="42" /></LangProvider>);
    await user.click(await screen.findByText(copy.preview));
    const field = screen.getByRole("textbox", { name: copy.label });
    expect(field).toHaveValue(buildReportAiPrompt(report, lang));
    await user.click(screen.getByRole("button", { name: copy.copy }));
    expect(write).toHaveBeenCalledWith((field as HTMLTextAreaElement).value);
    expect(screen.getByRole("status")).toHaveTextContent(copy.copied);
    expect(screen.getByRole("button", { name: copy.copy })).toBeEnabled();
  });

  it.each(["denied", "unavailable"])("opens and selects the preview for manual copy when clipboard is %s", async failure => {
    const user = userEvent.setup();
    if (failure === "denied") vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    else vi.spyOn(navigator, "clipboard", "get").mockReturnValue(undefined as unknown as Clipboard);
    render(<LangProvider><ReportAiPrompt kind="run" id="42" /></LangProvider>);
    const button = await screen.findByRole("button", { name: fr.report.aiPrompt.copy });
    button.focus(); await user.keyboard("{Enter}");
    const field = await screen.findByRole("textbox", { name: fr.report.aiPrompt.label }) as HTMLTextAreaElement;
    expect(field.closest("details")).toHaveAttribute("open");
    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(field.value.length);
    expect(screen.getByRole("status")).toHaveTextContent(fr.report.aiPrompt.failed);
  });

  it("prevents repeated copy requests while the clipboard is pending", async () => {
    const user = userEvent.setup();
    let complete!: () => void;
    const write = vi.spyOn(navigator.clipboard, "writeText").mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
    render(<LangProvider><ReportAiPrompt kind="run" id="42" /></LangProvider>);
    const button = await screen.findByRole("button", { name: fr.report.aiPrompt.copy });
    await user.click(button); await user.click(button);
    expect(button).toBeDisabled(); expect(write).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(fr.report.aiPrompt.copying);
    complete(); await waitFor(() => expect(button).toBeEnabled());
  });

  it("explains the Premium restriction without exposing a prompt", async () => {
    vi.mocked(accountFetch).mockRejectedValue(new AccountClientError("premium_required", 403));
    render(<LangProvider><ReportAiPrompt kind="run" id="42" /></LangProvider>);
    expect(await screen.findByText(fr.report.aiPrompt.locked)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: fr.report.aiPrompt.copy })).not.toBeInTheDocument();
    expect(screen.queryByText(fr.report.aiPrompt.preview)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: fr.report.aiPrompt.contact })).toHaveAttribute("href", expect.stringContaining("mailto:"));
  });

  it("allows retry after a service failure and clears exported data on sign-out", async () => {
    const user = userEvent.setup();
    vi.mocked(accountFetch).mockRejectedValueOnce(new AccountClientError("account_unavailable", 503));
    render(<LangProvider><ReportAiPrompt kind="run" id="42" /></LangProvider>);
    await user.click(await screen.findByRole("button", { name: fr.report.aiPrompt.retry }));
    expect(await screen.findByRole("button", { name: fr.report.aiPrompt.copy })).toBeEnabled();
    act(() => { window.dispatchEvent(new Event("argos-account-invalid")); });
    expect(screen.queryByRole("button", { name: fr.report.aiPrompt.copy })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { hidden: true })).not.toBeInTheDocument();
  });
});
