import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReportPageScope from "./ReportPageScope";
import PrintableReport from "./PrintableReport";
import { demoReport } from "@/components/marketing/reportDemoFixture";

describe("page identity in reader and exports", () => {
  for (const lang of ["fr", "en"] as const) for (const path of ["/", "/demo/atelier/avant.html", "/account"]) {
    it(`${lang} preserves ${path} and explains redirects and redaction`, () => {
      const report = demoReport(lang);
      report.url = "https://example.com" + path;
      report.pageIdentity = { requested: report.url, destination: "https://example.com/destination", redirected: true, redacted: true };
      for (const markup of [
        renderToStaticMarkup(<ReportPageScope report={report} lang={lang} />),
        ...(["summary", "full"] as const).map(format => renderToStaticMarkup(<PrintableReport report={report} lang={lang} format={format} />)),
      ]) {
        expect(markup).toContain(report.url);
        expect(markup).toContain("https://example.com/destination");
        expect(markup).toContain(lang === "fr" ? "Destination après redirection" : "Destination after redirect");
        expect(markup).toContain(lang === "fr" ? "assainie" : "Sanitized");
      }
    });
  }
  it("does not claim a historical origin is the measured URL", () => {
    const html = renderToStaticMarkup(<ReportPageScope report={{ ...demoReport("en"), pageIdentity: undefined }} lang="en" />);
    expect(html).toContain("Measured destination was not retained");
    expect(html).toContain("Sanitized display address");
  });
});
