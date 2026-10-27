// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ClientLangProvider, useLang } from "./LangContext";
import { LangProvider } from "./LangProvider";
import fr from "./fr.json";
import en from "./en.json";

function NavigationLabel() {
  const { lang, t } = useLang();
  return <nav lang={lang} aria-label={t.nav.primary}>{t.nav.freeAudit}</nav>;
}

it("renders the resolved route's dictionary before client effects", () => {
  const html = renderToStaticMarkup(<LangProvider initialLang="en"><NavigationLabel /></LangProvider>);
  expect(html).toContain('lang="en"');
  expect(html).toContain(en.nav.primary);
  expect(html).toContain(en.nav.freeAudit);
});

it("keeps consumers and document language in sync with resolved route props", () => {
  const view = render(<ClientLangProvider initialLang="en" translations={en}><NavigationLabel /></ClientLangProvider>);
  expect(screen.getByRole("navigation", { name: en.nav.primary })).toHaveTextContent(en.nav.freeAudit);
  expect(document.documentElement.lang).toBe("en");
  view.rerender(<ClientLangProvider initialLang="fr" translations={fr}><NavigationLabel /></ClientLangProvider>);
  expect(screen.getByRole("navigation", { name: fr.nav.primary })).toHaveTextContent(fr.nav.freeAudit);
  expect(document.documentElement.lang).toBe("fr");
});
