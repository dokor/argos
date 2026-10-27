// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangProvider";
import { demoReport } from "@/components/marketing/reportDemoFixture";
import { accountFetch } from "@/lib/account-client";
import ReportExport from "./ReportExport";
import { exportCopy } from "./exportCopy";

vi.mock("next/navigation", () => ({ usePathname: () => "/report/review-complete-fixture" }));
vi.mock("@/lib/account-client", () => ({ accountFetch: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

it.each([["fr", "summary"], ["en", "full"]] as const)("prepares a styled %s %s preview after loading the PDF module", async (lang, format) => {
  const report = { ...demoReport(lang), access: null };
  vi.mocked(accountFetch).mockResolvedValue(report);
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const previewDocument = frame.contentDocument!;
  Object.defineProperty(previewDocument, "fonts", { value: { ready: Promise.resolve() } });
  const preview = { document: previewDocument, opener: window, closed: false, close: vi.fn(), focus: vi.fn(), print: vi.fn() };
  vi.spyOn(window, "open").mockReturnValue(preview as unknown as Window);
  const sourceStyle = document.createElement("style");
  sourceStyle.textContent = ".synthetic-export-proof { color: red; }";
  const sourceSheet = document.createElement("link");
  sourceSheet.rel = "stylesheet";
  sourceSheet.href = "/synthetic-export.css";
  document.head.append(sourceStyle, sourceSheet);
  try {
    render(<LangProvider initialLang={lang}><ReportExport report={report} /></LangProvider>);
    fireEvent.change(screen.getByLabelText(exportCopy[lang].format), { target: { value: format } });
    fireEvent.click(screen.getByRole("button", { name: exportCopy[lang].export }));
    await waitFor(() => expect(previewDocument.querySelector("h1")).not.toBeNull(), { timeout: 10000 });
    expect(preview.focus).not.toHaveBeenCalled();
    previewDocument.querySelectorAll('link[rel="stylesheet"]').forEach(link => fireEvent.load(link));
    await waitFor(() => expect(preview.focus).toHaveBeenCalledOnce());
    expect(preview.close).not.toHaveBeenCalled();
    expect(preview.opener).toBeNull();
    expect(previewDocument.documentElement.lang).toBe(lang);
    expect(previewDocument.head.textContent).toContain(sourceStyle.textContent);
    expect(within(previewDocument.body).getByRole("heading", { level: 1, name: report.domain })).toBeTruthy();
    fireEvent.click(within(previewDocument.body).getByRole("button", { name: exportCopy[lang].print }));
    expect(preview.print).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(exportCopy[lang].ready));
  } finally {
    sourceStyle.remove();
    sourceSheet.remove();
    frame.remove();
  }
});
