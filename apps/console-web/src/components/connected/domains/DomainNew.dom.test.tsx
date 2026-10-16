// @vitest-environment jsdom
import { beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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
                status: "COMPLETED",
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
  state.replace.mockReset();
  state.push.mockReset();
  vi.mocked(accountFetch).mockReset();
  vi.mocked(accountFetch).mockResolvedValue({ id: "601", domainId: "7" });
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
