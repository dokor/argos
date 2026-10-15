// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { connectedFixture } from "../../../../../.agents/skills/argos-visual-review/scripts/connected-fixtures.mjs";
import OverviewView from "./OverviewView";
import DomainBatch from "./domains/DomainBatch";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search), usePathname: () => window.location.pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/account/AccountSession", () => ({ useAccountSession: () => ({ invalidate: vi.fn(), refreshUsage: vi.fn() }) }));
vi.mock("./domains/useDomainResource", () => ({ activeStatus: () => false, followPages: () => false, useDomainResource: (path: string | null) => {
  const url = new URL("http://fixture/api/account/" + path);
  return { allowed: true, loading: false, error: null, reload: vi.fn(), data: path ? connectedFixture(url.pathname, url.searchParams, () => ({}), { available: 36, reserved: 2, resetsAt: "2026-11-01T00:00:00Z", canLaunch: true }) : null };
} }));
beforeEach(() => window.history.replaceState(null, "", "/account"));
it("keeps actionable KPI links, exact relaunch URLs and measurement details while bounding recent runs", () => {
  const { container } = render(<OverviewView/>);
  expect(screen.getByRole("link", { name: /Voir les corrections/ })).toHaveAttribute("href", "/account?attention=priority");
  const recent = screen.getByRole("heading", { name: "Dernier diagnostic" }).closest("section")!;
  expect(within(recent).getAllByRole("listitem")).toHaveLength(1);
  expect(within(recent).getByRole("link", { name: "Tous mes sites et historiques" })).toHaveAttribute("href", "/account/sites");
  expect(screen.getByRole("link", { name: "Relancer https://atelier.example/collections" })).toHaveAttribute("href", "/account/analyses/new?url=https%3A%2F%2Fatelier.example%2Fcollections");
  expect(container.querySelectorAll("details")).toHaveLength(6);
});
it("exposes reach on closed rules and limits examples without losing the affected-page or return context", () => {
  window.history.replaceState(null, "", "/account/domains/101/batches/201");
  const { container } = render(<DomainBatch domainId="101" batchId="201"/>);
  const summary = screen.getByText("Image principale trop lourde").closest("summary")!;
  expect(summary).toHaveTextContent("5 / 6");
  expect(summary.closest("details")).not.toHaveAttribute("open");
  const first = screen.getByText("Script de navigation introuvable").closest("details")!;
  expect(within(first).getAllByRole("listitem")).toHaveLength(3);
  expect(within(first).getByRole("link", { name: "Voir les pages concernées (6)" })).toHaveAttribute("href", expect.stringContaining("rule=runtime.network.failed_requests&definitionVersion=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"));
  expect(within(first).getByRole("link", { name: "/collections — Voir le diagnostic" })).toHaveAttribute("href", "/account/runs/401?returnTo=%2Faccount%2Fdomains%2F101%2Fbatches%2F201");
  expect(container.querySelectorAll("h1")).toHaveLength(1);
});
