// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
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
  it("links translated guides in English and labels French-only service information", () => {
    render(<LangProvider initialLang="en"><SiteFooter /></LangProvider>);
    expect(screen.getByRole("link", { name: "Website audit checklist" })).toHaveAttribute("href", "/en/guides/website-audit-checklist");
    expect(screen.getByRole("link", { name: "Privacy (French)" })).toHaveAttribute("href", "/confidentialite");
    expect(screen.getByRole("link", { name: "About Argos" })).toHaveAttribute("href", "/en/about");
  });
});
