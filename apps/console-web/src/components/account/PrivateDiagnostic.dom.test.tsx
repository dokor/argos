// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import PrivateDiagnostic from "./PrivateDiagnostic";
import type { Report } from "@/components/report/types";
vi.mock("@/components/report/ReportExport", () => ({ default: () => null }));
vi.mock("@/components/report/ScopedRelaunch", () => ({ default: () => null }));
vi.mock("@/components/feedback/ReportFeedback", async () => { const { createContext } = await import("react"); return { default: () => null, FeedbackReportContext: createContext(undefined) }; });
const report: Report = { generatedAt: "2026-10-13T10:00:00Z", url: "https://example.test/", domain: "example.test", measurements: {lcpMs:4900}, site: {}, scores: { global: 80, globalAvailable: false, byCategory: [], completeness: 60 }, summary: { oneLiner: "fair", priorities: [] }, issues: [
  { id: "lighthouse.audit.largest-contentful-paint", categoryKey: "performance", severity: "critical", title: "LCP", impact: "Slow", recommendation: "Check", structuredEvidence: { source: "lighthouse", measurement: { value: 4900, unit: "ms" } } },
  { id: "html.meta.description", categoryKey: "seo", severity: "info", title: "Description", impact: "", recommendation: "Describe" },
] };
beforeEach(() => window.history.replaceState(null, "", "/account/runs/42?returnTo=%2Faccount%3Fattention%3Dpriority"));
it.each(["fr", "en"] as const)("keeps scope, missing score, canonical findings and deep links in %s", lang => {
  const { container } = render(<LangProvider initialLang={lang}><PrivateDiagnostic report={report} run={{ status: "COMPLETED", siteId: "1", historyContext: { siteId: "1", siteUrlId: "2", normalizedUrl: "https://example.test/collections" } }} runId="42" actions={<a href="/account?attention=priority">Back</a>}/></LangProvider>);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("example.test");
  const breadcrumb = screen.getByRole("navigation", {name: lang === "fr" ? "Fil d’Ariane" : "Breadcrumb"});
  expect(within(breadcrumb).getByRole("link", {name: lang === "fr" ? "Mes sites" : "My sites"})).toHaveAttribute("href", lang === "fr" ? "/account/sites" : "/en/account/sites");
  expect(breadcrumb.querySelector('[aria-current="page"]')).toHaveTextContent(lang === "fr" ? "Rapport enregistré" : "Saved report");
  expect(within(breadcrumb).getAllByRole("link")).toHaveLength(1);
  expect(screen.getAllByText(/https:\/\/example.test\/collections/).length).toBeGreaterThan(0);
  expect(screen.getByText(lang === "fr" ? /4,9/ : /4.9/)).toBeInTheDocument();
  expect(screen.queryByText("80")).not.toBeInTheDocument();
  expect(container.querySelectorAll("details[id^='finding-']")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: lang === "fr" ? "Constats techniques" : "Technical findings" }));
  expect(window.location.search).toContain("returnTo=");
  fireEvent.change(screen.getByRole("combobox",{name:lang === "fr" ? "Domaine" : "Domain"}), { target: { value: "seo" } });
  expect(container.querySelectorAll("details[id^='finding-']")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: lang === "fr" ? "Vue d’ensemble" : "Overview" }));
  expect(container.querySelectorAll("details[id^='finding-']")).toHaveLength(0);
  expect(screen.getByRole("heading", {name:lang === "fr" ? "Mesures observées" : "Observed measurements"})).toBeInTheDocument();
});
