// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import LangToggle from "./LangToggle";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

it("keeps unavailable English on the current page instead of linking to guides", () => {
  navigation.pathname = "/test-vitesse-site-web";
  render(<LangProvider><LangToggle /></LangProvider>);
  const english = screen.getByRole("button", { name: "Version anglaise indisponible pour cette page" });
  expect(english).toBeDisabled();
  expect(english).toHaveAttribute("title", "Version anglaise indisponible pour cette page");
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.queryByText("guides")).not.toBeInTheDocument();
});

it.each([
  ["/faq", "fr", "/faq", "/en/faq"],
  ["/en/faq", "en", "/faq", "/en/faq"],
  ["/report/example", "fr", "/report/example", "/en/report/example"],
] as const)("keeps translated language links on %s", (pathname, lang, fr, en) => {
  navigation.pathname = pathname;
  render(<LangProvider initialLang={lang}><LangToggle /></LangProvider>);
  expect(screen.getByRole("link", { name: "Français" })).toHaveAttribute("href", fr);
  expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", en);
  expect(screen.getByRole("link", { name: lang === "fr" ? "Français" : "English" })).toHaveAttribute("aria-current", "page");
});

it("still changes the legacy dashboard language without navigation", () => {
  navigation.pathname = "/dashboard";
  render(<LangProvider><LangToggle /></LangProvider>);
  fireEvent.click(screen.getByRole("button", { name: "English" }));
  expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
});
