// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@/test/render";
import { LangProvider } from "@/lib/i18n/LangProvider";
import DomainCommonMetric from "./DomainCommonMetric";
const state = vi.hoisted(() => ({ data: null as unknown, error: "", paths: [] as (string | null)[], reload: vi.fn() }));
let visible: (entries: { isIntersecting: boolean }[]) => void;
vi.mock("./useDomainResource", () => ({
  activeStatus: (value: { status: string }) => ["QUEUED", "RUNNING"].includes(value.status),
  useDomainResource: (path: string | null) => { state.paths.push(path); return { data: path ? state.data : null, error: state.error, reload: state.reload }; },
}));
const summary = (status = "PARTIAL", completePages = 5, partialPages = 1, rules = 3) => ({
  status, commonFindings: Array.from({ length: rules }, () => ({})),
  counts: { completePages, partialPages, selectedPages: 6 },
  profileSnapshot: { profileId: "actual-profile", contractVersion: 2, scoringVersion: 17 },
});
const metric = (batchId: string | null = "201") => <dl><DomainCommonMetric domainId="101" batchId={batchId} /></dl>;
const reveal = async () => { await act(async () => visible([{ isIntersecting: true }])); };
beforeEach(() => {
  Object.assign(state, { data: null, error: "", paths: [] }); state.reload.mockReset();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(cb: typeof visible) { visible = cb; }
    observe() {} disconnect() {}
  });
});
it("loads only visible cards and uses the canonical rules count with the actual profile", async () => {
  state.data = summary(); render(metric());
  expect(state.paths.every(path => path === null)).toBe(true);
  await reveal();
  expect(screen.getByText("3")).toBeInTheDocument();
  expect(screen.getByText("Sur les pages évaluées")).toBeInTheDocument();
  expect(screen.getByText(/actual-profile · contrat v2 · score v17/)).toBeInTheDocument();
  expect(state.paths).toContain("domains/101/batches/201");
});
it("does not load an absent batch or present it as zero", async () => {
  render(metric(null)); await reveal();
  expect(screen.getByText("—")).toBeInTheDocument();
  expect(screen.getByText("Synthèse indisponible")).toBeInTheDocument();
  expect(state.paths.every(path => path === null)).toBe(true);
});
it.each(["QUEUED", "RUNNING"])("marks %s summaries as provisional", async status => {
  state.data = summary(status, 1, 0, 1); render(metric()); await reveal();
  expect(screen.getByText("1")).toBeInTheDocument();
  expect(screen.getByText("Synthèse en cours")).toBeInTheDocument();
});
it("keeps a measured zero distinct from a failed unmeasured summary", async () => {
  state.data = summary("COMPLETED", 6, 0, 0); const view = render(metric()); await reveal();
  expect(screen.getByText("0")).toBeInTheDocument();
  state.data = summary("FAILED", 0, 0, 0); view.rerender(metric());
  expect(screen.getByText("—")).toBeInTheDocument();
  expect(screen.queryByText("0")).not.toBeInTheDocument();
});
it("hides a stale count after a failure, offers retry and clears it when the batch changes", async () => {
  state.data = summary(); const view = render(metric()); await reveal();
  state.error = "account_unavailable"; view.rerender(metric());
  expect(screen.queryByText("3")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Réessayer la synthèse" }));
  expect(state.reload).toHaveBeenCalledOnce();
  state.error = ""; state.data = null; view.rerender(metric("202"));
  expect(state.paths).toContain("domains/101/batches/202");
  expect(screen.getByText("—")).toBeInTheDocument();
});
it("renders the unavailable state in English", async () => {
  render(<LangProvider initialLang="en">{metric(null)}</LangProvider>);
  await waitFor(() => expect(screen.getByText("Summary unavailable")).toBeInTheDocument());
});
