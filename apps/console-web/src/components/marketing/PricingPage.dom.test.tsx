// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { LangProvider } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";
import sitemap from "@/app/sitemap";
import { metadata as frenchMetadata } from "@/app/(fr)/tarifs/page";
import { metadata as englishMetadata } from "@/app/en/pricing/page";
import PricingPage from "./PricingPage";
import { pricingCopy, subscriptionStatuses } from "./pricingCopy";

vi.mock("next/navigation", () => ({ usePathname: () => "/tarifs" }));
vi.mock("@/components/site/SiteNav", () => ({ default: () => null }));
vi.mock("@/components/site/SiteFooter", () => ({ default: () => null }));

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

it.each(["fr", "en"] as const)("explains public plans without reading billing or proposing a paid checkout in %s", lang => {
  const c = pricingCopy[lang];
  render(<LangProvider initialLang={lang}><PricingPage /></LangProvider>);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  const premium = screen.getByRole("article", { name: "Premium" });
  expect(within(premium).getByText(c.futurePrice)).toBeInTheDocument();
  expect(within(premium).getByText(c.coming)).toBeInTheDocument();
  expect(screen.getByText(c.notice)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: c.plans[2].action })).toHaveAttribute("href", "#premium");
  expect(screen.getByRole("link", { name: c.plans[1].action })).toHaveAttribute("href", localizedPath("/account/register", lang));
  expect(document.querySelectorAll('a[href*="stripe.com"],a[href*="checkout"],form[action*="checkout"]')).toHaveLength(0);
  expect(fetch).not.toHaveBeenCalled();
  const consent = screen.getByRole("checkbox");
  expect(consent).not.toBeChecked();
  expect(consent).toBeRequired();
  expect(screen.getByRole("textbox", { name: lang === "fr" ? "Votre adresse email" : "Your email address" })).toHaveAttribute("type", "email");
});

it.each(["fr", "en"] as const)("keeps account access separate from all seven subscription explanations in %s", lang => {
  render(<LangProvider initialLang={lang}><PricingPage /></LangProvider>);
  const statuses = document.querySelector("#subscription-statuses")!;
  expect(statuses.querySelectorAll("dt")).toHaveLength(7);
  for (const status of Object.values(subscriptionStatuses)) expect(within(statuses as HTMLElement).getByText(status[lang][0])).toBeInTheDocument();
  expect(screen.getByRole("link", { name: pricingCopy[lang].manage })).toHaveAttribute("href", localizedPath("/account/billing", lang));
  expect(document.querySelectorAll("details")).toHaveLength(7);
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
  expect(within(table).getAllByRole("rowheader")).toHaveLength(9);
});

it("server-renders both languages and declares reciprocal public canonical and sitemap entries", () => {
  for (const lang of ["fr", "en"] as const) {
    const html = renderToStaticMarkup(<LangProvider initialLang={lang}><PricingPage /></LangProvider>);
    expect(html).toContain(pricingCopy[lang].eyebrow);
    expect(html).toContain(pricingCopy[lang].futurePrice);
    const metadata = lang === "fr" ? frenchMetadata : englishMetadata;
    expect(metadata.alternates?.canonical).toBe("https://argos.lelouet.fr" + localizedPath("/tarifs", lang));
    expect(metadata.alternates?.languages).toMatchObject({ fr: "https://argos.lelouet.fr/tarifs", en: "https://argos.lelouet.fr/en/pricing" });
    expect(sitemap().filter(item => item.url === "https://argos.lelouet.fr" + localizedPath("/tarifs", lang))).toHaveLength(1);
  }
});
