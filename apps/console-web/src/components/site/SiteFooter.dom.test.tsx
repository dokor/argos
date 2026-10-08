// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
      "/faq#privacy",
      "/faq#limits",
    ]));
    expect(links.every((link) => Boolean(link.textContent?.trim()))).toBe(true);
    expect(hrefs.every((href) => Boolean(href) && href !== "#")).toBe(true);
  });
});
