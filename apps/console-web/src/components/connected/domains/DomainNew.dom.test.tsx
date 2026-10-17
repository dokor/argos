// @vitest-environment jsdom
import { beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import DomainNew from "./DomainNew";
import fr from "@/lib/i18n/fr.json";
import { accountFetch } from "@/lib/account-client";
vi.mock("@/lib/account-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/account-client")>(),
  accountFetch: vi.fn(),
}));
const state = vi.hoisted(() => ({
  query: "discovery=600",
  maxUrls: 50, maxDepth: 3, active: false,
  discoveryStatus: "COMPLETED",
  replace: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(state.query),
  useRouter: () => ({ replace: state.replace, push: state.push }),
  usePathname: () => "/account/domains/new",
}));
vi.mock("@/components/account/AccountSession", () => ({
  useAccountSession: () => ({
    profile: { verified: true },
    denied: false,
    usage: { canLaunch: true, available: 20 },
    usageError: false,
    invalidate: vi.fn(),
    refreshUsage: vi.fn(),
  }),
}));
vi.mock("./useDomainResource", () => ({
  followPages: () => true,
  activeStatus: (value: { status: string }) => value.status === "RUNNING",
  useDomainResource: (path: string | null) => ({
    allowed: true,
    error: "",
    reload: vi.fn(),
    data: !path
      ? null
      : (path === "domain-batches" || path === "domain-discoveries")
        ? (state.active ? [{id:"700",domainId:"8",hostname:"other.example",status:"QUEUED"}] : [])
        : path === "domain-discoveries/limits" ? { maxUrls: state.maxUrls, maxDepth: state.maxDepth, defaultUrls: 20, defaultDepth: 2, durationSeconds: 60 }
        : path === "analysis-profiles"
          ? {
              defaultProfileId: "server-default-v1",
              items: [
                { id: "server-default-v1", snapshot: { scoringVersion: 12 } },
              ],
            }
          : path.includes("/pages?")
            ? {
                items: [
                  {
                    pageId: "101",
                    normalizedUrl: "https://example.com/one",
                    source: "LINK",
                    depth: 1,
                    eligible: true,
                  },
                  {
                    pageId: "102",
                    normalizedUrl: "https://example.com/two",
                    source: "LINK",
                    depth: 1,
                    eligible: true,
                  },
                ],
              }
            : {
                id: "600",
                domainId: "7",
                hostname: "example.com",
                status: state.discoveryStatus,
                expiresAt: "2030-01-01T00:00:00Z",
                effectiveLimits: {
                  maxUrls: 20,
                  maxDepth: 2,
                  durationSeconds: 90,
                  requestsPerHost: 40,
                },
                eligibleCount: 2,
                excludedCount: 0,
                truncated: false,
                cancelRequested: false,
                stopReason: null,
              },
  }),
}));
beforeEach(() => {
  state.query = "discovery=600";
  state.maxUrls = 50; state.maxDepth = 3; state.active = false;
  state.discoveryStatus = "COMPLETED";
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  state.replace.mockReset();
  state.push.mockReset();
  vi.mocked(accountFetch).mockReset();
  vi.mocked(accountFetch).mockResolvedValue({ id: "601", domainId: "7" });
});

const c = fr.domainPage;
function currentStep(root: HTMLElement = screen.getByRole("list", { name: c.newTitle })) {
  return root.querySelector('[aria-current="step"]');
}

it("follows scope, discovery, selection and navigation back without adding step shortcuts", async () => {
  state.query = "";
  const view = render(<DomainNew />);
  expect(currentStep()).toHaveTextContent(c.steps.scope);
  const progress = screen.getByRole("list", { name: c.newTitle });
  expect(within(progress).queryByRole("button")).toBeNull();
  expect(within(progress).queryByRole("link")).toBeNull();
  state.query = "discovery=600";
  state.discoveryStatus = "RUNNING";
  view.rerender(<DomainNew />);
  expect(currentStep()).toHaveTextContent(c.steps.selection);
  expect(screen.queryByRole("button", { name: c.confirm })).toBeNull();
  state.discoveryStatus = "COMPLETED";
  view.rerender(<DomainNew />);
  expect(currentStep()).toHaveTextContent(c.steps.selection);
  state.query = "";
  view.rerender(<DomainNew />);
  await act(async () => {});
  expect(currentStep()).toHaveTextContent(c.steps.scope);
});

it("shows confirmation in the modal and restores selection and focus when closed", async () => {
  vi.mocked(accountFetch).mockResolvedValue({ canLaunch: true, available: 20 });
  render(<DomainNew />);
  const trigger = screen.getByRole("button", { name: c.confirm });
  await act(async () => { fireEvent.click(trigger); });
  const dialog = screen.getByRole("dialog");
  expect(currentStep(dialog)).toHaveTextContent(c.steps.confirmation);
  expect(within(dialog).getAllByText(c.steps.status.completed)).toHaveLength(2);
  expect(dialog).toHaveTextContent(c.costText.replaceAll("{count}", "2"));
  expect(accountFetch).toHaveBeenCalledExactlyOnceWith("usage");
  fireEvent.click(within(dialog).getByRole("button", { name: c.cancel, exact: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(currentStep()).toHaveTextContent(c.steps.selection);
  expect(trigger).toHaveFocus();
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(2);
});

it("keeps selection active when the fresh quota prevents confirmation", async () => {
  vi.mocked(accountFetch).mockResolvedValue({ canLaunch: false, available: 0 });
  render(<DomainNew />);
  fireEvent.click(screen.getByRole("button", { name: c.confirm }));
  await act(async () => {});
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(currentStep()).toHaveTextContent(c.steps.selection);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(accountFetch).toHaveBeenCalledExactlyOnceWith("usage");
});

it("launches the confirmed selection with the existing profile and admission request", async () => {
  vi.mocked(accountFetch)
    .mockResolvedValueOnce({ canLaunch: true, available: 20 })
    .mockResolvedValueOnce({ id: "700", domainId: "7" });
  render(<DomainNew />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: c.confirm })); });
  const dialog = screen.getByRole("dialog");
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: c.launch, exact: true }));
  });
  expect(accountFetch).toHaveBeenCalledWith("domain-batches", "POST", {
    discoveryId: "600", selectedPageIds: ["101", "102"], profileId: "server-default-v1",
  }, undefined, expect.any(String));
  expect(state.push).toHaveBeenCalledWith("/account/domains/7/batches/700");
});

it("does not enter confirmation with an empty selection", async () => {
  render(<DomainNew />);
  fireEvent.click(screen.getByRole("button", { name: c.selectNone }));
  expect(screen.getByRole("button", { name: c.confirm })).toBeDisabled();
  expect(currentStep()).toHaveTextContent(c.steps.selection);
  expect(accountFetch).not.toHaveBeenCalled();
  await act(async () => {});
});

it("keeps discovery cancellation separate from the launch confirmation step", async () => {
  state.discoveryStatus = "RUNNING";
  render(<DomainNew />);
  fireEvent.click(screen.getByRole("button", { name: c.cancelDiscovery }));
  await screen.findByRole("dialog");
  expect(currentStep()).toHaveTextContent(c.steps.selection);
});

it("shows the confirmation step for a recoverable batch admission request", () => {
  state.query = "discovery=600&request=" + encodeURIComponent(JSON.stringify({
    key: "a1234567-1234-1234-1234-123456789012", kind: "batch",
    body: { discoveryId: "600", selectedPageIds: ["102"], profileId: "server-default-v1" },
  }));
  render(<DomainNew />);
  expect(currentStep()).toHaveTextContent(c.steps.confirmation);
  expect(screen.getByRole("button", { name: c.retryRequest })).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "https://example.com/two" })).toBeChecked();
});
it("updates a checkbox before delayed router state, then restores selection from URL/back", async () => {
  const view = render(<DomainNew />);
  const first = screen.getByRole("checkbox", {
    name: "https://example.com/one",
  });
  expect(first).toBeChecked();
  fireEvent.click(first);
  expect(first).not.toBeChecked();
  expect(
    new URL(
      state.replace.mock.lastCall![0],
      "http://localhost",
    ).searchParams.get("selected"),
  ).toBe("102");
  state.query = "discovery=600&selected=102";
  view.rerender(<DomainNew />);
  await act(async () => {});
  expect(first).not.toBeChecked();
  state.query = "discovery=600";
  state.maxUrls = 50; state.maxDepth = 3; state.active = false;
  view.rerender(<DomainNew />);
  await act(async () => {});
  expect(first).toBeChecked();
});
it("keeps successive selections while URL navigation is pending", async () => {
  render(<DomainNew />);
  fireEvent.click(
    screen.getByRole("button", { name: fr.domainPage.selectNone }),
  );
  const [first, second] = screen.getAllByRole("checkbox");
  expect(first).not.toBeChecked();
  expect(second).not.toBeChecked();
  fireEvent.click(first);
  expect(first).toBeChecked();
  fireEvent.click(second);
  expect(second).toBeChecked();
  expect(
    new URL(
      state.replace.mock.lastCall![0],
      "http://localhost",
    ).searchParams.get("selected"),
  ).toBe("101,102");
  await act(async () => {});
});

it("rejects a recovery intent for a different discovery", () => {
  state.query =
    "discovery=600&request=" +
    encodeURIComponent(
      JSON.stringify({
        key: "a1234567-1234-1234-1234-123456789012",
        kind: "batch",
        body: {
          discoveryId: "601",
          selectedPageIds: ["101"],
          profileId: "server-default-v1",
        },
      }),
    );
  render(<DomainNew />);
  expect(screen.getByRole("alert")).toHaveTextContent(
    fr.domainPage.filterInvalid,
  );
  expect(
    screen.queryByRole("button", { name: fr.domainPage.retryRequest }),
  ).toBeNull();
});

it("keeps scope inputs and their discovery validations beside the quota guide", () => {
  state.query = ""; render(<DomainNew />);
  expect(screen.getByRole("complementary", { name: "Avant l’analyse" })).toBeInTheDocument();
  expect(screen.getByLabelText(fr.domainPage.hostname)).toBeRequired();
  expect(screen.getByLabelText(fr.domainPage.maxUrls)).toHaveAttribute("max", "50");
  expect(screen.getByLabelText(fr.domainPage.maxDepth)).toHaveAttribute("min", "0");
  expect(screen.getByLabelText(fr.domainPage.maxDepth)).toHaveAttribute("max", "3");
});

it("accepts operator limits above 50/3 while another domain is pending", () => {
  state.query="";state.maxUrls=200;state.maxDepth=5;state.active=true;
  render(<DomainNew/>);
  expect(screen.getByLabelText(fr.domainPage.maxUrls)).toHaveAttribute("max","200");
  expect(screen.getByLabelText(fr.domainPage.maxDepth)).toHaveAttribute("max","5");
  expect(screen.getByRole("button",{name:fr.domainPage.discover})).toBeEnabled();
  expect(screen.getByRole("link",{name:fr.domainPage.resumeDiscovery})).toBeInTheDocument();
});

it.each(["www.exemple.fr", "https://www.exemple.fr", "https://www.redpoint.fr", "example.com", "http://example.com", "https://example.com", "https://example.com/", "http://example.com/", " HTTPS://EXAMPLE.COM/ ", "https://www.example.com/", "https://" + "a".repeat(63) + "." + "b".repeat(63) + "." + "c".repeat(63) + "." + "d".repeat(61) + "/"])("submits the canonical exact host from %s", async (input) => {
  state.query = "";
  render(<DomainNew />);
  const field = screen.getByLabelText(fr.domainPage.hostname);
  expect(field).toHaveAttribute("maxlength", "262");
  fireEvent.change(field, { target: { value: input } });
  fireEvent.submit(field.closest("form")!);
  await act(async () => {});
  const expected = input.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase();
  expect(accountFetch).toHaveBeenCalledWith("domain-discoveries", "POST", {
    hostname: expected, maxUrls: 20, maxDepth: 2, excludedPaths: [],
  }, undefined, expect.any(String));
  const pending = new URL(state.replace.mock.calls[0][0], "http://localhost").searchParams.get("request")!;
  expect(JSON.parse(pending).body.hostname).toBe(expected);
  expect(state.push).toHaveBeenCalledWith("/account/domains/new?discovery=601");
});

it.each(["ftp://example.com", "https://user@example.com", "https://example.com:443", "https://example.com/path", "https://example.com?query=1", "https://example.com/#fragment", "https://example.com\\path"])("preserves invalid scope %s for server rejection", async (input) => {
  state.query = "";
  render(<DomainNew />);
  const field = screen.getByLabelText(fr.domainPage.hostname);
  fireEvent.change(field, { target: { value: input } });
  fireEvent.submit(field.closest("form")!);
  await act(async () => {});
  expect(accountFetch).toHaveBeenCalledWith("domain-discoveries", "POST", expect.objectContaining({ hostname: input }), undefined, expect.any(String));
});
