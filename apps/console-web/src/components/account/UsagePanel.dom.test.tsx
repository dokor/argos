// @vitest-environment jsdom
import { beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import UsagePanel from "./UsagePanel";
const {session}=vi.hoisted(()=>({session:{profile:{verified:true},denied:false,usageError:false,refreshUsage:vi.fn(),usage:{offer:"FREE",used:5,reserved:2,limit:null as number|null,canLaunch:true,resetsAt:"2026-11-01T00:00:00Z",timezone:"UTC"}}}));
vi.mock("./AccountSession",()=>({useAccountSession:()=>session}));
beforeEach(()=>{session.denied=false;session.usage.limit=null;session.usage.canLaunch=true;session.refreshUsage.mockReset();});
it.each(["fr","en"] as const)("shows unlimited counting and reference timezone in %s",lang=>{
  render(<LangProvider initialLang={lang}><UsagePanel/></LangProvider>);
  expect(screen.getByRole("heading",{name:lang==="fr" ? "Consommation mensuelle" : "Monthly usage"})).toBeInTheDocument();
  expect(screen.getByText(lang==="fr" ? "Sans plafond" : "No limit")).toBeInTheDocument();
  expect(screen.getByText("5")).toBeInTheDocument();expect(screen.getByText("2")).toBeInTheDocument();expect(screen.getByText("UTC")).toBeInTheDocument();
  expect(document.querySelector("time")).toHaveAttribute("datetime","2026-11-01T00:00:00Z");
  fireEvent.click(screen.getByRole("button"));expect(session.refreshUsage).toHaveBeenCalledTimes(1);
});
it("explains capacity exhaustion while retaining reading access, and hides on revocation",()=>{
  session.usage.limit=7;session.usage.canLaunch=false;const view=render(<UsagePanel/>);
  expect(screen.getByRole("status")).toHaveTextContent("Vos sites et rapports restent accessibles");
  session.denied=true;view.rerender(<UsagePanel/>);expect(screen.queryByText("FREE")).not.toBeInTheDocument();
});
