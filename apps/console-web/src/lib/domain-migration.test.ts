import { afterEach, describe, expect, it, vi } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../next.config";
import { locales } from "./i18n/locales";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("permanent domain migration", () => {
  for (const host of ["argos.lelouet.fr", "www.argos-audit.com"]) {
    for (const protocol of ["http", "https"]) {
      it.each([
        "/",
        "/faq?utm_source=legacy&tag=one",
        "/en/resources/digital-accessibility",
        "/de/faq",
        "/es/resources/digital-accessibility",
        "/report/synthetic-token?view=summary",
        "/api/audits?scope=page",
        "/api/account/auth/oauth/google/callback?code=synthetic&state=synthetic",
        "/og.png",
        "/robots.txt",
        "/sitemap.xml",
        "/guides/caf%C3%A9?next=%2Ffaq%3Fx%3D1",
      ])(`${protocol}://${host}%s keeps its path and query`, async path => {
        const response = await unstable_getResponseFromNextConfig({
          url: `${protocol}://${host}${path}`, nextConfig,
        });
        // Unlike 301/302, 308 also preserves non-GET methods and bodies.
        expect(response.status).toBe(308);
        expect(response.headers.get("location")).toBe(`https://argos-audit.com${path}`);
      });
    }

    it.each(["accessibilite-numerique", "audit-technique-gratuit", "audit-site-pme", "audit-site-ecommerce"])(
      `${host}/%s goes directly to the final resource`, async slug => {
        const response = await unstable_getResponseFromNextConfig({
          url: `https://${host}/${slug}?source=old`, nextConfig,
        });
        expect(response.status).toBe(308);
        expect(response.headers.get("location")).toBe(`https://argos-audit.com/ressources/${slug}?source=old`);
      },
    );
  }

  it.each(["argos-audit.com", "localhost:3000", "preview.example", "argos.lelouet.fr.attacker.example", "argosXlelouetXfr"])(
    "does not migrate unrelated or canonical host %s", async host => {
      const response = await unstable_getResponseFromNextConfig({ url: `https://${host}/faq`, nextConfig });
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    },
  );

  it("keeps report and account responses out of the index", async () => {
    for (const path of ["/report/synthetic-token", "/en/report/synthetic-token", "/account/sign-in", "/en/account/sign-in", "/de/report/synthetic-token", "/es/account/sign-in", "/de/share/synthetic-token"]) {
      const response = await unstable_getResponseFromNextConfig({ url: `https://argos-audit.com${path}`, nextConfig });
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    }
  });
});

describe("public SEO origin", () => {
  it.each([
    [undefined, "https://argos-audit.com"],
    ["https://preview.example/", "https://preview.example"],
  ])("uses the same origin across metadata, language links, sitemap and robots (%s)", async (configured, expected) => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", configured);
    vi.resetModules();
    const { localizedMetadata } = await import("./i18n/metadata");
    const { default: sitemap } = await import("@/app/sitemap");
    const { default: robots } = await import("@/app/robots");
    const metadata = localizedMetadata("/faq", "en", "FAQ", "FAQ");
    expect(metadata.alternates?.canonical).toBe(expected + "/en/faq");
    expect(metadata.alternates?.languages).toMatchObject({ fr: expected + "/faq", en: expected + "/en/faq", de: expected + "/de/faq", "x-default": expected + "/faq" });
    expect(Object.keys(metadata.alternates?.languages ?? {})).toHaveLength(locales.length + 1);
    expect(metadata.openGraph?.url).toBe(expected + "/en/faq");
    for (const entry of sitemap()) {
      expect(new URL(entry.url).origin).toBe(expected);
      for (const alternate of Object.values(entry.alternates?.languages ?? {})) {
        expect(new URL(String(alternate)).origin).toBe(expected);
      }
      expect(entry.url).not.toMatch(/\/(account|report)(\/|$)/);
    }
    expect(robots().sitemap).toBe(expected + "/sitemap.xml");
  });
});
