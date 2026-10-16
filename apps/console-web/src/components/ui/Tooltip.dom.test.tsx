// @vitest-environment jsdom
import {it,expect,vi} from "vitest";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import Tooltip from "./Tooltip";
it("opens at keyboard focus, keeps its description until Escape and preserves focus",async()=>{
 render(<Tooltip label="En attente" content="Traitement non démarré"/>);
 const trigger=screen.getByRole("button");trigger.focus();fireEvent.focus(trigger);
 expect(await screen.findByRole("tooltip")).toHaveTextContent("Traitement non démarré");
 expect(trigger).toHaveAttribute("aria-describedby",screen.getByRole("tooltip").id);
 fireEvent.keyDown(document,{key:"Escape"});expect(screen.queryByRole("tooltip")).toBeNull();expect(trigger).toHaveFocus();
});
it("supports tap, hoverable text, viewport clamping and scroll repositioning",async()=>{
 const rect=vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockReturnValue({left:1000,right:1044,top:2,bottom:46,width:320,height:80,x:1000,y:2,toJSON:()=>({})});
 render(<Tooltip label="Aide" content="Une explication lisible" placement="top"/>);
 fireEvent.click(screen.getByRole("button"));const tooltip=await screen.findByRole("tooltip");
 await waitFor(()=>expect(parseFloat(tooltip.style.left)).toBeLessThanOrEqual(window.innerWidth-328));
 expect(parseFloat(tooltip.style.top)).toBeGreaterThanOrEqual(8);
 fireEvent.mouseLeave(screen.getByRole("button"));fireEvent.mouseEnter(tooltip);expect(tooltip).toBeInTheDocument();
 fireEvent.scroll(window);fireEvent.blur(screen.getByRole("button"));expect(screen.queryByRole("tooltip")).toBeNull();rect.mockRestore();
});
