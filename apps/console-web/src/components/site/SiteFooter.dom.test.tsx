// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/test/render";
import { LangProvider } from "@/lib/i18n/LangProvider";
import SiteFooter from "./SiteFooter";

describe("shared footer (#317)", () => {
  it("provides crawlable, descriptive links to existing public content", () => {
    render(<SiteFooter />);
    const footer = screen.getByRole("contentinfo");
    const links = within(footer).getAllByRole("link");
    const hrefs = links.map((link) => link.getAttribute("href"));

    expect(hrefs).toEqual(expect.arrayContaining([
      "/#audit",
      "/ressources",
      "/faq",
      "/ressources/audit-technique-gratuit",
      "/guides/checklist-audit-site-web",
      "/ressources/accessibilite-numerique",
      "/conditions-utilisation",
      "/confidentialite",
      "/informations-legales",
      "/a-propos",
      "/methodologie-score#resume",
      "mailto:a.lelouet.freelance@gmail.com",
      "/faq#limits",
    ]));
    expect(links.every((link) => Boolean(link.textContent?.trim()))).toBe(true);
    expect(hrefs.every((href) => Boolean(href) && href !== "#")).toBe(true);
  });
  it("links guides and legal information in English", () => {
    render(<LangProvider initialLang="en"><SiteFooter /></LangProvider>);
    expect(screen.getByRole("link", { name: "Website audit checklist" })).toHaveAttribute("href", "/en/guides/website-audit-checklist");
    expect(screen.getByRole("link", { name: "Terms of use" })).toHaveAttribute("href", "/en/terms-of-use");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/en/privacy");
    expect(screen.getByRole("link", { name: "Service information" })).toHaveAttribute("href", "/en/legal-information");
    expect(screen.getByRole("link", { name: "About Argos" })).toHaveAttribute("href", "/en/about");
  });
});
