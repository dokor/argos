// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DomainTasks from "./DomainTasks";
vi.mock("./useDomainResource",()=>({followPages:()=>true,useDomainResource:(path:string)=>({
 data:path==="domain-discoveries"?[
  {id:"1",domainId:"11",hostname:"first.example",status:"QUEUED",eligibleCount:0,excludedCount:0},
  {id:"2",domainId:"12",hostname:"second.example",status:"COMPLETED",eligibleCount:60,excludedCount:3},
 ]:[{id:"3",domainId:"11",hostname:"first.example",status:"RUNNING"}], error:"",reload:vi.fn()
})}));
it("keeps queued discoveries, ready selections and active batches separately resumable",()=>{
 render(<DomainTasks/>);
 expect(screen.getByText("À sélectionner",{exact:false})).toBeInTheDocument();
 expect(screen.getByRole("link",{name:"Reprendre le lot en cours"})).toHaveAttribute("href","/account/domains/11/batches/3");
 expect(screen.getAllByRole("link",{name:"Reprendre la découverte"})).toHaveLength(2);
});
it("shows only the current domain in its detail",()=>{
 render(<DomainTasks domainId="12"/>);
 expect(screen.queryByText(/first.example/)).toBeNull();
 expect(screen.getByRole("link",{name:"Reprendre la découverte"})).toHaveAttribute("href","/account/domains/new?discovery=2");
 expect(screen.queryByRole("link",{name:"Reprendre le lot en cours"})).toBeNull();
});
