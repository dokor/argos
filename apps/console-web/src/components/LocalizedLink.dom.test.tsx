// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangProvider";
import LocalizedLink from "./LocalizedLink";

vi.mock("next/link", () => ({ default: ({ prefetch, ...props }: { prefetch?: boolean; href: string }) =>
  <a {...props} data-prefetch={String(prefetch)} /> }));

it.each(["fr", "en"] as const)("does not speculate on session-dependent links in %s", lang => {
  render(<LangProvider initialLang={lang}>
    <LocalizedLink href="/account">Account</LocalizedLink>
    <LocalizedLink href="/account/register?returnTo=%2Faccount" prefetch>Register</LocalizedLink>
    <LocalizedLink href="/faq" prefetch>FAQ</LocalizedLink>
    <LocalizedLink href="/ressources">Resources</LocalizedLink>
  </LangProvider>);
  expect(screen.getByText("Account")).toHaveAttribute("data-prefetch", "false");
  expect(screen.getByText("Account")).toHaveAttribute("href", lang === "fr" ? "/account" : "/en/account");
  expect(screen.getByText("Register")).toHaveAttribute("data-prefetch", "false");
  expect(screen.getByText("FAQ")).toHaveAttribute("data-prefetch", "true");
  expect(screen.getByText("Resources")).toHaveAttribute("data-prefetch", "false");
});
