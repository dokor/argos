// @vitest-environment jsdom
import { useEffect } from "react";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPage from "@/app/(fr)/dashboard/page";
import type { AuditListItem } from "@/lib/ArgosApi";
import fr from "@/lib/i18n/fr.json";

vi.mock("@/lib/i18n/LangContext", () => ({ useLang: () => ({ t: fr, lang: "fr" }) }));
vi.mock("@/components/site/SiteNav", () => ({ default: () => null }));
vi.mock("@/components/site/SiteFooter", () => ({ default: () => null }));
vi.mock("@/components/AuditForm", () => ({ default: () => null }));
vi.mock("@/components/AuditList", () => ({ default: function List({ setItems }: { setItems: (items: AuditListItem[]) => void }) {
  useEffect(() => { setItems([
    { auditId: 1, runId: 1, inputUrl: "https://example.com", normalizedUrl: "https://example.com", status: "COMPLETED", globalScore: 64 },
    { auditId: 2, runId: 2, inputUrl: "https://example.org", normalizedUrl: "https://example.org", status: "FAILED", globalScore: null },
  ]); }, [setItems]);
  return null;
} }));
it("shows the cached average before technical details are loaded", () => {
  render(<DashboardPage />);
  expect(screen.getByRole("heading", { level: 1, name: fr.dashboard.title })).toBeInTheDocument();
  expect(screen.getByText("64%")).toBeInTheDocument();
});
