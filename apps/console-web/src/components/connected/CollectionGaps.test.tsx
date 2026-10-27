import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LangProvider } from "@/lib/i18n/LangProvider";
import CollectionGaps, { RepeatedCollectionGaps } from "./CollectionGaps";
import { PageList } from "./domains/DomainUi";
import type { PageResult } from "@/lib/connected/contracts";
const page: PageResult = {pageId:"1",runId:"9007199254740993",normalizedUrl:"https://example.com/",executionStatus:"COMPLETED",completeness:"PARTIAL",score:{value:80,provisional:true,reason:null},coverage:{ratio:.5,version:"v1"},criticalCount:0,importantCount:2,moduleStatuses:{ssl:"FAILED"},failureReason:null,reportAvailable:true,collectionGaps:[{ruleKey:"ssl.grade",module:"ssl",reason:"TIMEOUT"}]};
for(const lang of ["fr","en"] as const) {
  const render=(node:React.ReactNode)=>renderToStaticMarkup(<LangProvider initialLang={lang}>{node}</LangProvider>);
  it(`shows reasons before counters and preserves exact run context in ${lang}`,()=>{
    const html=render(<PageList pages={[page]} returnTo="/account?attention=incomplete" empty="Empty"/>);
    expect(html).toContain(lang==="fr"?"Collecte partielle":"Partial collection");
    expect(html).toContain("ssl"); expect(html).toContain("ssl.grade"); expect(html).toContain(lang==="fr"?"Délai de collecte dépassé":"Collection timed out");
    expect(html.indexOf(lang==="fr"?"Collecte partielle":"Partial collection")).toBeLessThan(html.indexOf(lang==="fr"?"Critiques":"Critical"));
    expect(html).toContain("/account/runs/9007199254740993?returnTo=%2Faccount%3Fattention%3Dincomplete");
  });
  it(`distinguishes execution failure, no measurement and unknown cause in ${lang}`,()=>{
    for(const [p,text] of [ [{...page,executionStatus:"FAILED",completeness:"NONE",collectionGaps:[]},lang==="fr"?"Échec de l’exécution":"Execution failed"], [{...page,completeness:"NONE"},lang==="fr"?"Aucune mesure disponible":"No measurements available"], [{...page,completeness:"UNKNOWN",moduleStatuses:{},collectionGaps:[]},lang==="fr"?"Cause de l’incomplétude non précisée":"Reason for incompleteness not specified"] ] as const) expect(render(<CollectionGaps page={p}/>)).toContain(text);
    expect(render(<CollectionGaps page={{...page,coverage:{ratio:0,version:"v1"}}}/>)).toContain(lang==="fr"?"Aucune mesure disponible":"No measurements available");
    expect(render(<CollectionGaps page={{...page,completeness:"FULL",score:{value:0,provisional:false,reason:null},moduleStatuses:{},collectionGaps:[]}}/>)).toBe("");
  });
  it(`labels repeated observations only within displayed pages in ${lang}`,()=>{
    const html=render(<RepeatedCollectionGaps pages={[page,{...page,pageId:"2"}]}/>);
    expect(html).toContain("ssl: 2 / 2"); expect(html).toContain(lang==="fr"?"cela ne prouve pas une cause commune":"this does not prove a common cause");
    expect(render(<RepeatedCollectionGaps pages={[page]}/>)).toBe("");
    const failed=render(<PageList pages={[{...page,executionStatus:"FAILED",reportAvailable:false}]} returnTo="/account?attention=incomplete" empty="Empty"/>);
    expect(failed).toContain("/account/runs/9007199254740993?returnTo=%2Faccount%3Fattention%3Dincomplete");
  });
}
