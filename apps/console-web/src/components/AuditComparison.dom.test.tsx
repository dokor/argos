// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
import AuditComparison from "./AuditComparison";
import type { AuditHistoryItem } from "@/lib/ArgosApi";
import { argosApi } from "@/lib/ArgosApi";
import fr from "@/lib/i18n/fr.json";
import en from "@/lib/i18n/en.json";
const base:AuditHistoryItem={runId:1,status:"COMPLETED",globalScore:80,calculation:{scoringVersion:11,scoringFingerprint:"frozen-method",domains:[]}};
describe("frozen audit comparisons",()=>{
  it("shows a valid delta with its domain and contributors",()=>{
    render(<AuditComparison item={{...base,comparison:{reason:"COMPARABLE",globalDelta:5,coverageChanged:false,domains:[{domain:"security",points:20}],contributions:[{key:"ssl.grade",module:"ssl",domain:"security",domainPoints:20,globalPoints:5}]}}} url="https://example.com"/>);
    expect(screen.getByText(/Évolution depuis le rapport précédent: \+5/)).toBeInTheDocument();expect(screen.getByText(/ssl.grade/)).toBeInTheDocument();expect(screen.getByText(/frozen-method/)).toBeInTheDocument();
  });
  it("separates coverage changes and offers a relaunch without fabricating a delta",()=>{
    render(<AuditComparison item={{...base,comparison:{reason:"COVERAGE_CHANGED",globalDelta:null,coverageChanged:true,domains:[],contributions:[]}}} url="https://example.com"/>);
    expect(screen.getByText(/La couverture de mesure a changé/)).toBeInTheDocument();expect(screen.queryByText(/Évolution depuis/)).not.toBeInTheDocument();expect(screen.getByRole("button")).toBeInTheDocument();
  });
  it("keeps every reason understandable in FR/EN",()=>{
    for(const t of [fr,en]) expect(Object.keys(t.auditList.comparison.reasons)).toHaveLength(8);
  });
  it("requests evidence only when the comparison is opened", async()=>{
    const request=vi.spyOn(argosApi,"getComparisonDetail").mockResolvedValue({
      calculation:base.calculation,
      comparison:{reason:"NO_PREVIOUS_REPORT",globalDelta:null,coverageChanged:false,domains:[],contributions:[]},
    });
    render(<AuditComparison item={{...base,comparison:null}} auditId={7} url="https://example.com"/>);
    expect(request).not.toHaveBeenCalled();
    const summary=screen.getByText("Voir la comparaison");
    const details=summary.closest("details")!;
    details.open=true;
    fireEvent(details,new Event("toggle"));
    await waitFor(()=>expect(request).toHaveBeenCalledWith(7,1));
    await screen.findByText(/Aucun rapport précédent/);
    request.mockRestore();
  });
});
