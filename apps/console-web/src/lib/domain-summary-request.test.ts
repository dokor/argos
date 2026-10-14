import { describe, expect, it } from "vitest";
import { domainSummaryPath, domainSummaryQuery } from "./domain-summary-request";
describe("domain summaries private request", () => {
  it.each(["domains", "domains/9007199254740993/batches", "domains/1/batches/2", "domains/1/batches/2/pages"])("allows %s", path => expect(domainSummaryPath(path)).toBe(true));
  it.each(["domains/0/batches", "domains/9223372036854775808/batches", "domains/1/batches/2/delete"])("rejects %s", path => expect(domainSummaryPath(path)).toBe(false));
  it.each(["limit=0", "offset=9007199254740992", "limit=1&limit=2", "ownerId=2", "severity=high", "scope=unknown", "definitionVersion="+"a".repeat(64), "query=%00", "ruleKey=", "completeness=all", "status=PARTIAL"])("rejects ambiguous or invalid filter %s", query => expect(domainSummaryQuery("domains/1/batches/2/pages", new URLSearchParams(query))).toBeNull());
  it("preserves all filters and supplies bounded pagination", () => {
    const params = new URLSearchParams({ruleKey:"http.csp", definitionVersion:"a".repeat(64), severity:"INFO", status:"COMPLETED", query:"/blog", sort:"url", scope:"all", completeness:"PARTIAL"});
    const result = domainSummaryQuery("domains/1/batches/2/pages", params)!;
    expect(result.get("limit")).toBe("20"); expect(result.get("offset")).toBe("0");
    for (const [key,value] of params) expect(result.get(key)).toBe(value);
    expect(domainSummaryQuery("domains/1/batches/2",params)).toBeNull();
  });
  it("supports domain search only on the domain list", () => {
    expect(domainSummaryQuery("domains",new URLSearchParams("query=atelier"))?.get("query")).toBe("atelier");
    expect(domainSummaryQuery("domains/1/batches",new URLSearchParams("query=atelier"))).toBeNull();
  });
});
