// @vitest-environment jsdom
import {expect,it,vi} from "vitest";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import {CiCode} from "./CiUi";
it("copies only the selected value and clears a stale copied status when the configuration changes",async()=>{
  const writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText}});
  const view=render(<CiCode value="synthetic-preview-json" label="Configuration"/>);fireEvent.click(screen.getByRole("button",{name:"Copier"}));await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("Copié."));expect(writeText).toHaveBeenCalledWith("synthetic-preview-json");
  view.rerender(<CiCode value="changed-preview-json" label="Configuration"/>);expect(screen.getByRole("status")).toBeEmptyDOMElement();
});
it("offers a safe manual copy fallback without exposing a clipboard exception",async()=>{
  Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error("synthetic-private-detail"))}});
  render(<CiCode value="node argos-ci.mjs doctor" label="Précontrôle"/>);fireEvent.click(screen.getByRole("button",{name:"Copier"}));await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("Copie indisponible"));expect(screen.queryByText("synthetic-private-detail")).not.toBeInTheDocument();
});
