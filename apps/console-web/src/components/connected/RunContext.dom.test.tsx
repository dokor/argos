// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import RunContext from "./RunContext";
it("renders the backend module array without treating completed execution as measured coverage",()=>{
  render(<RunContext runId="42" run={{status:"RUNNING",siteId:"7",moduleStatuses:JSON.stringify([{id:"http",status:"COMPLETED"},{id:"runtime",status:"RUNNING"}]),profileSnapshot:null}}/>);
  expect(screen.getByText("HTTP")).toBeInTheDocument();expect(screen.getByText("Terminé")).toBeInTheDocument();
  expect(screen.getByText("Runtime")).toBeInTheDocument();expect(screen.getByText("En cours")).toBeInTheDocument();
  expect(screen.getByText(/Un module terminé ne garantit pas/)).toBeInTheDocument();expect(screen.queryByText("100 %")).not.toBeInTheDocument();
});
