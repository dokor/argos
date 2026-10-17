// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import { AccountClientError } from "@/lib/account-client";
import StatisticsOverview, { type Statistics } from "./StatisticsOverview";

const { api, session } = vi.hoisted(() => ({
  api: vi.fn(), session: { ready: true, denied: false, profile: { verified: true, admin: true } },
}));
vi.mock("@/lib/account-client", async original => ({ ...await original<typeof import("@/lib/account-client")>(), accountFetch: api }));
vi.mock("@/components/account/AccountSession", () => ({ useAccountSession: () => session }));
const metrics: Statistics = {
  generatedAt: "2026-10-17T10:00:00Z", from: null, period: "all",
  accounts: { created: 1250, validated: 900, suspended: 12, archived: 48, validationUnknown: 48, google: 610, github: 300, linkedin: 120 },
  analyses: { total: 2430, completed: 2100, failed: 130, running: 20, queued: 80, canceled: 70, unknown: 30 },
  domains: { total: 810, averageUrls: 3 },
};
beforeEach(() => {
  session.ready = true; session.denied = false; session.profile = { verified: true, admin: true };
  api.mockReset().mockResolvedValue(metrics);
});
const view = (lang: "fr" | "en" = "fr") => render(<LangProvider initialLang={lang}><StatisticsOverview /></LangProvider>);

it.each(["fr", "en"] as const)("shows aggregates with definitions and separate product navigation in %s", async lang => {
  view(lang);
  await screen.findByText(lang === "fr" ? "1 250" : "1,250");
  expect(screen.getByRole("link", { name: lang === "fr" ? "Mesure produit" : "Product measurement" })).toHaveAttribute("href", lang === "fr" ? "/account/admin/analytics" : "/en/account/admin/analytics");
  expect(screen.getByRole("link", { name: lang === "fr" ? "Vue d’ensemble" : "Overview" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByText(lang === "fr" ? /Les indicateurs de validation/ : /Validation and suspension counts/)).toBeInTheDocument();
  expect(screen.getByText(lang === "fr" ? /le rapport peut rester partiel/ : /the report may still be partial/)).toBeInTheDocument();
  expect(screen.getByText(/17/,{selector:"time"})).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith("admin/statistics?period=all", "GET", undefined, expect.any(AbortSignal));
});

it("cancels stale requests, hides old data and recovers from API errors", async () => {
  view(); await screen.findByText("1 250");
  const signal=api.mock.calls[0][3];
  api.mockRejectedValue(new Error("offline"));
  fireEvent.change(screen.getByLabelText("Période de première activité"), { target: { value: "7" } });
  expect(signal.aborted).toBe(true); expect(screen.queryByText("1 250")).not.toBeInTheDocument();
  expect(await screen.findByRole("alert")).toHaveTextContent("indisponibles");
  api.mockResolvedValue(metrics); fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
  await screen.findByText("1 250");
  expect(api).toHaveBeenLastCalledWith("admin/statistics?period=7", "GET", undefined, expect.any(AbortSignal));
});

it("distinguishes unavailable values from a genuinely empty selection", async () => {
  const empty=structuredClone(metrics);
  empty.accounts={created:0,validated:0,suspended:0,archived:0,validationUnknown:0,google:0,github:0,linkedin:null};
  empty.analyses={total:0,completed:0,failed:0,running:0,queued:0,canceled:0,unknown:0};
  empty.domains={total:0,averageUrls:0};
  api.mockResolvedValue(empty); view();
  expect(await screen.findByText(/^Aucune création/)).toHaveAttribute("role", "status");
  const linkedin=screen.getByText("LinkedIn").parentElement!;
  expect(within(linkedin).getByLabelText("Indisponible")).toHaveTextContent("—");
  expect(screen.getAllByText("0").length).toBeGreaterThan(5);
});

it.each(["ordinary", "unverified", "pending"] as const)("never fetches statistics for %s sessions", state => {
  if (state==="ordinary") session.profile.admin=false;
  if (state==="unverified") session.profile.verified=false;
  if (state==="pending") session.ready=false;
  view(); expect(api).not.toHaveBeenCalled();
});

it("removes private counts on a live role refusal", async () => {
  api.mockRejectedValue(new AccountClientError("admin_required",403)); view();
  await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("administrateur"));
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});

it("ignores late responses after the session is revoked", async () => {
  let resolve!: (data: Statistics) => void;
  api.mockImplementation(()=>new Promise(done=>{resolve=done;}));
  const rendered=view(); const signal=api.mock.calls[0][3];
  session.denied=true; rendered.rerender(<StatisticsOverview />);
  await act(async()=>resolve(metrics));
  expect(signal.aborted).toBe(true); expect(screen.queryByText("1 250")).not.toBeInTheDocument();
});

