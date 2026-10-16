import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TechnicalGuidePage from "./TechnicalGuidePage";
import { technicalGuides } from "@/lib/technicalGuides";
import { localizedMetadata, siteUrl } from "@/lib/i18n/metadata";
import { localizedPath } from "@/lib/i18n/routes";
import sitemap from "@/app/sitemap";
vi.mock("@/components/site/SiteNav", () => ({ default: () => null }));
vi.mock("@/components/site/SiteFooter", () => ({ default: () => null }));
vi.mock("./EditorialMeta", () => ({ default: () => null }));
for (const guide of ["lcp", "csp", "hsts"] as const) for (const lang of ["fr", "en"] as const) {
  it(`server renders ${guide} in ${lang} with working anchors and self canonical`, () => {
    const data = technicalGuides[guide]; const copy = data[lang];
    const html = renderToStaticMarkup(<TechnicalGuidePage guide={guide} lang={lang} />);
    expect(html.match(/<h1/g)).toHaveLength(1); expect(html).toContain(copy.title);
    for (const section of copy.sections) expect(html).toContain(`id="${section.id}"`);
    for (const section of copy.sections) expect(html).toContain(`href="#${section.id}"`);
    expect(html).toContain(localizedPath("/#audit", lang));
    const canonical = siteUrl + localizedPath(data.route, lang);
    expect(localizedMetadata(data.route, lang, copy.title, copy.description).alternates?.canonical).toBe(canonical);
    expect(sitemap().some(entry => entry.url === canonical)).toBe(true);
    expect(html).not.toContain("/report/");
  });
}
