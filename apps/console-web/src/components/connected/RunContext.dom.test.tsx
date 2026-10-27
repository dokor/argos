// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen } from "@/test/render";
import RunContext from "./RunContext";
it("renders the backend module array without treating completed execution as measured coverage",()=>{
  render(<RunContext runId="42" run={{status:"RUNNING",siteId:"7",moduleStatuses:JSON.stringify([{id:"http",status:"COMPLETED"},{id:"runtime",status:"RUNNING"}]),profileSnapshot:null}}/>);
  expect(screen.getByText("HTTP")).toBeInTheDocument();expect(screen.getByText("Terminé")).toBeInTheDocument();
  expect(screen.getByText("Runtime")).toBeInTheDocument();expect(screen.getByText("En cours")).toBeInTheDocument();
  expect(screen.getByText(/Un module terminé ne garantit pas/)).toBeInTheDocument();expect(screen.queryByText("100 %")).not.toBeInTheDocument();
});

it("keeps canceled running modules neutral with an explicit label",()=>{
 render(<RunContext runId="42" run={{status:"CANCELED",siteId:"7",moduleStatuses:[{id:"http",status:"COMPLETED"},{id:"runtime",status:"RUNNING"}]}}/>);
 expect(screen.getByText("Annulé")).toHaveAttribute("data-tone","neutral");
 expect(screen.getByText("Terminé")).toHaveAttribute("data-tone","success");
});
