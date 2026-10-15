import {expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {LangProvider} from "@/lib/i18n/LangContext";
import type {Coverage} from "@/components/report/types";
import CollectorDiagnostics from "./CollectorDiagnostics";
for(const lang of ["fr","en"] as const) {
 it(`explains stored policy failures without guessing historical causes in ${lang}`,()=>{
 const coverage={checks:[{module:"ssl",state:"UNAVAILABLE",reason:"POLICY_DISABLED"},{module:"ssl",state:"UNAVAILABLE",reason:"POLICY_DISABLED"},{module:"observatory",state:"UNAVAILABLE",reason:"secret upstream text"}]} as Coverage;
 const html=renderToStaticMarkup(<LangProvider initialLang={lang}><CollectorDiagnostics modules={{ssl:"FAILED",observatory:"FAILED",http:"COMPLETED"}} coverage={coverage}/></LangProvider>);
 expect(html).toContain(lang==="fr"?"Collecte désactivée par la politique Argos":"Collection disabled by Argos policy");
 expect(html).toContain(lang==="fr"?"Motif non enregistré":"Reason not recorded"); expect(html).not.toContain("secret upstream text"); expect(html).not.toContain("<strong>http</strong>");
 });
}
