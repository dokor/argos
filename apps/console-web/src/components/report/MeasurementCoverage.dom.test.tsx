// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import MeasurementCoverage from "./MeasurementCoverage";
import type { Coverage } from "./types";
import fr from "@/lib/i18n/fr.json";
import en from "@/lib/i18n/en.json";

const aggregate={key:"global",measuredWeight:40,expectedWeight:100,ratio:.4,available:true,sufficient:false};
const coverage:Coverage={version:"weighted-coverage-v1",threshold:.8,provisional:true,global:aggregate,domains:[{...aggregate,key:"security"},{...aggregate,key:"seo",measuredWeight:0,available:false}],checks:[{key:"ssl.grade",domain:"security",module:"ssl",weight:10,state:"UNAVAILABLE",reason:"CHECK_MISSING",confidence:"UNKNOWN"}]};
describe("measurement coverage",()=>{
  it("qualifies partial measurement and unavailable domains",()=>{
    render(<MeasurementCoverage coverage={coverage}/>);
    expect(screen.getByText("40 % — Score provisoire")).toBeInTheDocument();
    expect(screen.getByText(/Indisponible: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Mesure indisponible/)).toBeInTheDocument();
  });
  it("does not invent coverage for historical reports",()=>{
    const {container}=render(<MeasurementCoverage/>);expect(container).toBeEmptyDOMElement();
  });
  it("provides all state labels and provisional explanations in FR/EN",()=>{
    for(const translation of [fr,en]) {expect(translation.report.measurementCoverage.explanation).toContain("80");expect(Object.keys(translation.report.measurementCoverage.states)).toHaveLength(4);expect(translation.report.measurementCoverage.provisional).toBeTruthy();}
  });
});
