import React from "react";
import { render as renderComponent, renderHook as renderComponentHook, type RenderOptions, type RenderHookOptions } from "@testing-library/react";
import { renderToStaticMarkup as renderMarkup } from "react-dom/server";
import { LangContext } from "@/lib/i18n/LangContext";
import fr from "@/lib/i18n/fr.json";

export * from "@testing-library/react";

// Isolated consumers receive an explicit fixture instead of shipping a default dictionary in client JS.
function FrenchFixture({ children }: { children: React.ReactNode }) {
  return <LangContext.Provider value={{ lang: "fr", t: fr }}>{children}</LangContext.Provider>;
}

export function render(ui: React.ReactNode, options: RenderOptions = {}) {
  const { wrapper: Wrapper, ...rest } = options;
  return renderComponent(ui, { ...rest, wrapper: ({ children }) => <FrenchFixture>{Wrapper ? <Wrapper>{children}</Wrapper> : children}</FrenchFixture> });
}

export function renderHook<Result, Props>(callback: (props: Props) => Result, options: RenderHookOptions<Props> = {}) {
  const { wrapper: Wrapper, ...rest } = options;
  return renderComponentHook(callback, { ...rest, wrapper: ({ children }) => <FrenchFixture>{Wrapper ? <Wrapper>{children}</Wrapper> : children}</FrenchFixture> });
}

export function renderToStaticMarkup(ui: React.ReactNode) {
  return renderMarkup(<FrenchFixture>{ui}</FrenchFixture>);
}
