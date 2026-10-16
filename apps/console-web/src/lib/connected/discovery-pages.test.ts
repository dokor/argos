import { it, expect, vi } from "vitest";
import { allDiscoveryPages } from "./discovery-pages";
import { accountFetch } from "@/lib/account-client";
vi.mock("@/lib/account-client", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/account-client")>(), accountFetch: vi.fn() }));
it("loads every bounded page beyond the first hundred", async () => {
  const fetch=vi.mocked(accountFetch);fetch.mockReset();
  fetch.mockResolvedValueOnce({total:201,items:Array.from({length:100},(_,i)=>({pageId:String(i)}))})
    .mockResolvedValueOnce({items:Array.from({length:100},(_,i)=>({pageId:String(i+100)}))})
    .mockResolvedValueOnce({items:[{pageId:"200"}]});
  const controller=new AbortController();
  const result=await allDiscoveryPages("domain-discoveries/1/pages?inclusion=all&limit=100","GET",undefined,controller.signal);
  expect(result.items).toHaveLength(201);
  expect(fetch.mock.calls[2][0]).toContain("offset=200");
  expect(fetch.mock.calls[2][3]).toBe(controller.signal);
});
it("fails rather than returning a partial selection when a later page fails", async () => {
  vi.mocked(accountFetch).mockReset().mockResolvedValueOnce({total:200,items:[]}).mockRejectedValueOnce(new Error("offline"));
  await expect(allDiscoveryPages("domain-discoveries/1/pages?limit=100")).rejects.toThrow("offline");
});
