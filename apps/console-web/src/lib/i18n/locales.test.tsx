import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { locales, languageFromHeader, languageFromPath } from "./locales";
import { frenchPath, languageRoutes, localizedPath } from "./routes";
import { languageAlternates, localizedMetadata } from "./metadata";
import { installMessages, localizeValue, localizedCopy, translateText } from "./messages";
import { safeAccountReturn } from "../account-return";
import { authLanguagePath } from "../account-navigation";
import { proxy } from "@/proxy";
import LangToggle from "@/components/LangToggle";
import { LangProvider } from "./LangContext";
import { findingPlaybook, rulePlaybooks } from "@/components/report/findingPlaybooks";
import { englishTopicAudits, localizedTopicAudit } from "@/components/marketing/englishTopicAudits";

vi.mock("next/navigation", () => ({ usePathname: () => "/account/reset" }));

describe("the 22 product languages", () => {
  it("keeps the requested languages and native names in order", () => {
    expect(locales.map(locale => locale.code)).toEqual(["fr", "en", "de", "es", "it", "nl", "pt", "pl", "sv", "da", "fi", "cs", "sk", "hu", "ro", "bg", "el", "hr", "sl", "lt", "lv", "et"]);
    expect(new Set(locales.map(locale => locale.name)).size).toBe(22);
  });

  it.each(locales)("preserves public and private navigation in $name", ({ code }) => {
    for (const path of [...Object.keys(languageRoutes), "/feedback", "/demonstrations/cls/avant", "/account", "/account/settings", "/account/domains/12/batches/34", "/account/admin/users/12", "/account/urls/12/history", "/report/" + "x".repeat(32), "/share/" + "x".repeat(32)]) {
      const translated = localizedPath(path, code);
      expect(languageFromPath(translated)).toBe(code);
      expect(frenchPath(translated)).toBe(path);
      expect(localizedPath(translated + "?domain=security#finding-61", "fr")).toBe(path + "?domain=security#finding-61");
    }
    const target = localizedPath("/account/domains/12/batches/34", code);
    expect(safeAccountReturn(target)).toBe(target);
    const reset = authLanguagePath("/account/reset", code, { returnTo: "/account/sites", token: "synthetic-token" });
    expect(reset).toBe(localizedPath("/account/reset", code) + "?returnTo=" + encodeURIComponent(localizedPath("/account/sites", code)) + "#token=synthetic-token");
    expect(localizedPath("/api/account/session", code)).toBe("/api/account/session");
  });

  it.each(locales)("renders crawlable native language links in the selector ($name)", ({ code, name }) => {
    const html = renderToStaticMarkup(<LangProvider><LangToggle /></LangProvider>);
    expect(html).toContain(`href="${localizedPath("/account/reset", code)}"`);
    expect(html).toContain(`hrefLang="${code}"`);
    expect(html).toContain(name);
  });

  it.each(locales)("keeps request language independent of forged headers ($name)", ({ code }) => {
    const path = localizedPath("/account/sites", code);
    const response = proxy(new NextRequest("https://argos.example" + path, { headers: { "x-argos-language": "zz" } }));
    expect(response.headers.get("x-middleware-request-x-argos-language")).toBe(code);
    if (code !== "fr" && code !== "en") expect(response.headers.get("x-middleware-rewrite")).toBe("https://argos.example/en/account/sites");
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("negotiates regional language headers without accepting arbitrary locales", () => {
    expect(languageFromHeader("de-AT,de;q=0.9,en;q=0.5")).toBe("de");
    expect(languageFromHeader("zz,pl;q=0.8,en;q=0.2")).toBe("pl");
    expect(languageFromHeader("de;q=0,en;q=1")).toBe("en");
    expect(languageFromHeader("zz;q=1,de;q=bogus")).toBe("fr");
    expect(safeAccountReturn("/zz/account/sites")).toBe("/account/sites");
    expect(safeAccountReturn("//evil.example/de/account/sites")).toBe("/account/sites");
  });

  it("publishes reciprocal alternatives and the current canonical", () => {
    const languages = languageAlternates("/faq");
    expect(Object.keys(languages)).toHaveLength(23);
    for (const { code } of locales) {
      const metadata = localizedMetadata("/faq", code, "Title", "Description");
      expect(metadata.alternates?.canonical).toBe(languages[code]);
      expect(metadata.alternates?.languages).toEqual(languages);
    }
  });
});

describe("local copy translation", () => {
  it("translates editorial explanations while preserving illustrative metric dumps", () => {
    const content = englishTopicAudits.speed;
    installMessages("pt", { [content.example.before]: "This must never replace metrics", [content.example.conditions]: "Condições fictícias" });
    const translated = localizedTopicAudit(content, "pt");
    expect(translated.example.before).toBe(content.example.before);
    expect(translated.example.conditions).toBe("Condições fictícias");
  });
  it("preserves the report's actual code example even if a catalogue contains matching text", () => {
    const [key, entry] = Object.entries(rulePlaybooks).find(([, entry]) => entry.en.example)!;
    installMessages("es", { [entry.en.example]: "This must never replace code" });
    expect(findingPlaybook(key, "es").example).toBe(entry.en.example);
  });
  it("isolates catalogues, preserves placeholders and leaves measured evidence untouched", () => {
    installMessages("de", { "Check {count}": "Prüfung {count}", "Hello": "Hallo", "Price": "$&" });
    installMessages("el", { "Hello": "Γεια" });
    expect(translateText(" Hello ", "de")).toBe(" Hallo ");
    expect(translateText("Hello", "el")).toBe("Γεια");
    expect(translateText(" Price ", "de")).toBe(" $& ");
    const copy = { fr: { title: "Contrôle {count}", code: "Hello", example: "Hello", route: "/faq" }, en: { title: "Check {count}", code: "Hello", example: "Hello", route: "/faq" } };
    expect(localizedCopy(copy, "de")).toEqual({ title: "Prüfung {count}", code: "Hello", example: "Hallo", route: "/faq" });
    expect(localizeValue({ example: { title: "Hello" }, reference: "Hello" }, "de")).toEqual({ example: { title: "Hallo" }, reference: "Hallo" });
    expect(copy.en.title).toBe("Check {count}");
    const html = renderToStaticMarkup(localizeValue(<p title="Hello">Hello <a href="/faq">Hello</a></p>, "de"));
    expect(html).toContain('title="Hallo"');
    expect(html).toContain('href="/de/faq"');
    expect(localizeValue(new URL("https://example.com/"), "de")).toBeInstanceOf(URL);
  });
});
