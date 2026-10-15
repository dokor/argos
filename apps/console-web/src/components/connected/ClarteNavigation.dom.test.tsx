// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import KnownUrls from "./KnownUrls";
import UsageStrip from "./UsageStrip";
import DomainCommonMetric from "./domains/DomainCommonMetric";
const state=vi.hoisted(()=>({data:null as unknown,error:"",usage:null as unknown,usageError:false,paths:[] as (string|null)[]}));
vi.mock("next/navigation",()=>({usePathname:()=>"/account/analyses/new"}));
vi.mock("./domains/useDomainResource",()=>({activeStatus:(value:{status:string})=>["QUEUED","RUNNING"].includes(value.status),useDomainResource:(path:string|null)=>{state.paths.push(path);return {data:path?state.data:null,error:state.error,reload:vi.fn()};}}));
vi.mock("@/components/account/AccountSession",()=>({useAccountSession:()=>({usage:state.usage,usageError:state.usageError,refreshUsage:vi.fn()})}));
beforeEach(()=>{
  Object.assign(state,{data:null,error:"",usage:null,usageError:false,paths:[]});
  vi.stubGlobal("IntersectionObserver",class { constructor(private cb:(entries:{isIntersecting:boolean}[])=>void){} observe(){this.cb([{isIntersecting:true}]);} disconnect(){} });
});
it("prefills exact recent URLs without submitting and links their own history, deduplicating runs",()=>{
  const url="https://atelier.example/produit?taille=M&couleur=bleu#details";
  state.data={recentRuns:[{pageId:"7",normalizedUrl:url},{pageId:"7",normalizedUrl:url},{pageId:"8",normalizedUrl:"https://atelier.example/contact"}]};
  render(<KnownUrls/>);
  expect(screen.getAllByRole("link",{name:"Utiliser cette URL"})).toHaveLength(2);
  expect(screen.getAllByRole("link",{name:"Utiliser cette URL"})[0]).toHaveAttribute("href",`/account/analyses/new?url=${encodeURIComponent(url)}#analysis-url`);
  expect(screen.getAllByRole("link",{name:"Historique de cette URL"})[0]).toHaveAttribute("href","/account/urls/7/history");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("distinguishes empty recent history from unavailable history and localizes it",()=>{
  state.data={recentRuns:[]};const view=render(<LangProvider initialLang="en"><KnownUrls/></LangProvider>);
  expect(screen.getByText(/No saved URLs/)).toBeInTheDocument();
  state.error="unavailable";view.rerender(<LangProvider initialLang="en"><KnownUrls/></LangProvider>);
  expect(screen.getByText(/temporarily unavailable/)).toBeInTheDocument();
  expect(screen.queryByText(/No saved URLs/)).not.toBeInTheDocument();
});
it("uses only the canonical common rules count and marks partial scope",async()=>{
  state.data={status:"PARTIAL",commonFindings:[{},{},{}],counts:{completePages:5,partialPages:1,selectedPages:6},profileSnapshot:{profileId:"server-default-v1"}};
  render(<dl><DomainCommonMetric domainId="101" batchId="201"/></dl>);
  await waitFor(()=>expect(screen.getByText("3")).toBeInTheDocument());
  expect(screen.getByText("Sur les pages évaluées")).toBeInTheDocument();
  expect(state.paths).toContain("domains/101/batches/201");
});
it("never presents absent or unmeasured summaries as zero findings",async()=>{
  const view=render(<dl><DomainCommonMetric domainId="101" batchId={null}/></dl>);
  expect(screen.getByText("—")).toBeInTheDocument();expect(state.paths.every(p=>p===null)).toBe(true);
  state.data={status:"FAILED",commonFindings:[],counts:{completePages:0,partialPages:0,selectedPages:6},profileSnapshot:{profileId:"server-default-v1"}};
  view.rerender(<dl><DomainCommonMetric domainId="101" batchId="201"/></dl>);
  await waitFor(()=>expect(screen.getByText("Synthèse indisponible")).toBeInTheDocument());
  expect(screen.queryByText("0")).not.toBeInTheDocument();
});
it("keeps real zero/unlimited quota distinct from loading and failure",()=>{
  const view=render(<UsageStrip/>);expect(screen.getByRole("status")).toHaveTextContent(/quota/i);
  state.usageError=true;view.rerender(<UsageStrip/>);expect(screen.getByText("Quota indisponible")).toBeInTheDocument();
  state.usage={offer:"STANDARD",available:0};view.rerender(<UsageStrip/>);expect(screen.getByText(/0 crédits/)).toBeInTheDocument();
  state.usage={offer:"STANDARD",available:null};view.rerender(<UsageStrip/>);expect(screen.getByText(/illimités/)).toBeInTheDocument();
  expect(screen.getByRole("link",{name:"Ouvrir mes quotas"})).toHaveAttribute("href","/account/usage");
});

it("marks a running summary as provisional and hides a stale count on read failure",async()=>{
  state.data={status:"RUNNING",commonFindings:[{}],counts:{completePages:1,partialPages:0,selectedPages:6},profileSnapshot:{profileId:"server-default-v1"}};
  const view=render(<dl><DomainCommonMetric domainId="101" batchId="201"/></dl>);
  await waitFor(()=>expect(screen.getByText("1")).toBeInTheDocument());
  expect(screen.getByText("Synthèse en cours")).toBeInTheDocument();
  state.error="account_unavailable";view.rerender(<dl><DomainCommonMetric domainId="101" batchId="201"/></dl>);
  expect(screen.getByText("—")).toBeInTheDocument();expect(screen.queryByText("1")).not.toBeInTheDocument();
});
