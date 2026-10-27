import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LangProvider } from "@/lib/i18n/LangProvider";
import { findingEditorial } from "@/components/report/findingCatalogue";
import type { CommonFinding } from "@/lib/connected/contracts";
import CommonFindingContent from "./CommonFindingContent";

for (const lang of ["fr", "en"] as const) for (const ruleKey of ["runtime.network.failed_requests", "runtime.console.errors", "html.link.canonical.present", "future.check"]) {
  it(`localizes ${ruleKey} in ${lang} while retaining source text separately`, () => {
    const finding = { ruleKey, title: "Titre source conservé", impact: "2 requête(s) en échec.", recommendation: "Vérifier les ressources bloquées." } as CommonFinding;
    const before = structuredClone(finding);
    const html = renderToStaticMarkup(<LangProvider initialLang={lang}><CommonFindingContent finding={finding} /></LangProvider>);
    const editorial = html.split("<details")[0];
    expect(editorial).toContain(findingEditorial(ruleKey, lang).impact);
    expect(editorial).not.toContain("requête(s)");
    expect(html).toContain("2 requête(s) en échec.");
    expect(html).toContain(ruleKey);
    expect(finding).toEqual(before);
  });
}
