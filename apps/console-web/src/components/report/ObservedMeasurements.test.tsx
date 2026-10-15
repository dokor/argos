// @vitest-environment jsdom
import {render,screen,within} from "@testing-library/react";
import {describe,it,expect} from "vitest";
import ObservedMeasurements,{measurementLevel} from "./ObservedMeasurements";
import {demoReport} from "@/components/marketing/reportDemoFixture";
describe("Observed measurements",()=>{
 it("distinguishes missing measurements, zero and poor values",()=>{
  render(<ObservedMeasurements report={demoReport("fr")} lang="fr"/>);
  expect(screen.getAllByRole("term")).toHaveLength(13);
  expect(screen.getAllByText("Non mesuré")).toHaveLength(2);
  expect(within(screen.getByRole("region",{name:"Erreurs"})).getByText("0")).toBeInTheDocument();
  expect(screen.getAllByText("Mauvais")).toHaveLength(2);
  expect(screen.queryByText(/TTI/)).not.toBeInTheDocument();
 });
 it("renders historical and invalid data as not measured",()=>{
  render(<ObservedMeasurements report={{...demoReport("en"),measurements:{lcpMs:NaN,requests:-1}}} lang="en"/>);
  expect(screen.getAllByText("Not measured")).toHaveLength(13);
 });
 it("uses inclusive Web Vitals thresholds",()=>{
  expect([2500,2501,4000,4001].map(n=>measurementLevel(n,[2500,4000]))).toEqual([0,1,1,2]);
  expect([1800,1801,3000,3001].map(n=>measurementLevel(n,[1800,3000]))).toEqual([0,1,1,2]);
 });
});
