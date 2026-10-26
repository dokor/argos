import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { LangProvider } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";
import EcommerceAuditArticle, { ecommerceAuditMetadata } from "./EcommerceAuditArticle";

vi.mock("next/navigation", () => ({ useRouter: () => ({}), usePathname: () => "/" }));
vi.mock("@/components/site/SiteNav", () => ({ default: () => null }));
vi.mock("@/components/site/SiteFooter", () => ({ default: () => null }));
vi.mock("@/components/security/useAntiBot", () => ({ useAntiBot: () => ({ element: null }) }));
vi.mock("@/components/site/JsonLd", () => ({ default: () => null }));

describe("ecommerce guide discovery before hydration", () => {
  it.each(["fr", "en"] as const)("serves the scenario, worksheet and working section anchors in %s", lang => {
    const html = renderToStaticMarkup(<LangProvider initialLang={lang}><EcommerceAuditArticle lang={lang} /></LangProvider>);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const match of html.matchAll(/href="#([^"]+)"/g)) expect(ids).toContain(match[1]);
    for (const path of ["/guides/lcp-lent#diagnostic", "/guides/checklist-audit-site-web#indexabilite", "/ressources/audit-site-ecommerce"]) {
      expect(html).toContain(`href="${localizedPath(path, lang)}"`);
    }
    expect(html).toContain(`href="/downloads/ecommerce-audit-checklist-${lang}.csv"`);
    const csv = readFileSync(`public/downloads/ecommerce-audit-checklist-${lang}.csv`, "utf8").trim().split(/\r?\n/);
    expect(csv).toHaveLength(7);
    for (const line of csv) expect(line.split('","')).toHaveLength(10);
    const metadata = ecommerceAuditMetadata(lang);
    expect(metadata.alternates?.canonical).toBe("https://argos.lelouet.fr" + localizedPath("/guides/checklist-audit-ecommerce", lang));
    expect(metadata.openGraph).toMatchObject({ type: "article", modifiedTime: "2026-10-25" });
  });
});
