// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LangToggle from "@/components/LangToggle";
import { LangProvider } from "@/lib/i18n/LangContext";

const route = vi.hoisted(() => ({ pathname: "" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

it.each(["overview", "problems", "traffic"])("offers reciprocal language links on statistics/%s", section => {
  const french = "/account/admin/analytics/" + section, english = "/en" + french;
  route.pathname = english;
  render(<LangProvider initialLang="en"><LangToggle /></LangProvider>);
  expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", english);
  expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Français" })).toHaveAttribute("href", french);
  expect(screen.queryByText("guides")).not.toBeInTheDocument();
});
