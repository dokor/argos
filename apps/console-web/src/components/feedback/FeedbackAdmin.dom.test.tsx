// @vitest-environment jsdom
import { beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangProvider";
import { AccountClientError } from "@/lib/account-client";
import FeedbackAdmin from "./FeedbackAdmin";
const {api,session}=vi.hoisted(()=>({api:vi.fn(),session:{profile:{admin:true},ready:true,denied:false}}));
vi.mock("@/lib/account-client",async original=>({...await original<typeof import("@/lib/account-client")>(),accountFetch:api}));
vi.mock("@/components/account/AccountSession",()=>({useAccountSession:()=>session,PersonalNavigation:()=>null}));
vi.mock("@/components/site/SiteNav",()=>({default:()=>null}));vi.mock("@/components/site/SiteFooter",()=>({default:()=>null}));
const row={id:"42",type:"FALSE_POSITIVE",status:"OPEN",createdAt:"2026-10-11T10:00:00Z",updatedAt:"2026-10-11T10:00:00Z"};
beforeEach(()=>{session.profile.admin=true;session.denied=false;api.mockReset();api.mockImplementation(async(path:string,method:string)=>method==="PATCH"?{changed:true}:path==="admin/feedback/42"?{...row,description:"<script>private fixture</script>",findingKey:"http.hsts",runId:"7",events:[]}:{items:[row],nextCursor:"42"});});
it.each(["fr","en"] as const)("filters, pages, opens escaped detail and treats feedback in %s",async lang=>{
  render(<LangProvider initialLang={lang}><FeedbackAdmin/></LangProvider>);
  fireEvent.click(await screen.findByRole("button",{name:lang==="fr"?"Détail 42":"Details 42"}));
  expect(await screen.findByText("<script>private fixture</script>")).toBeInTheDocument();expect(document.querySelector("script")).toBeNull();
  fireEvent.change(screen.getAllByLabelText(lang==="fr"?"Statut":"Status")[1],{target:{value:"CONFIRMED"}});
  fireEvent.click(screen.getByRole("button",{name:lang==="fr"?"Enregistrer le statut":"Save status"}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith("admin/feedback/42","PATCH",{status:"CONFIRMED",expectedStatus:"OPEN"}));
  fireEvent.click(screen.getByRole("button",{name:lang==="fr"?"Fermer":"Close"}));
  fireEvent.change(screen.getByLabelText(lang==="fr"?"Type de retour":"Feedback type"),{target:{value:"BUG"}});
  fireEvent.click(screen.getByRole("button",{name:lang==="fr"?"Filtrer":"Filter"}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith("admin/feedback?limit=20&type=BUG","GET",undefined,expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole("button",{name:lang==="fr"?"Page suivante":"Next page"}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith("admin/feedback?limit=20&type=BUG&cursor=42","GET",undefined,expect.any(AbortSignal)));
});
it("never loads data for non-admins and removes details after revocation",async()=>{
  session.profile.admin=false;const view=render(<LangProvider><FeedbackAdmin/></LangProvider>);expect(api).not.toHaveBeenCalled();
  session.profile.admin=true;view.rerender(<LangProvider><FeedbackAdmin/></LangProvider>);fireEvent.click(await screen.findByRole("button",{name:"Détail 42"}));await screen.findByText("<script>private fixture</script>");
  session.denied=true;view.rerender(<LangProvider><FeedbackAdmin/></LangProvider>);expect(screen.queryByText("<script>private fixture</script>")).toBeNull();
});
it("shows conflicts and does not erase user-selected treatment on failure",async()=>{
  render(<LangProvider><FeedbackAdmin/></LangProvider>);fireEvent.click(await screen.findByRole("button",{name:"Détail 42"}));await screen.findByText("<script>private fixture</script>");
  api.mockRejectedValueOnce(new AccountClientError("feedback_conflict",409));fireEvent.click(screen.getByRole("button",{name:"Enregistrer le statut"}));
  expect(await screen.findByText(/Le statut a été modifié entre-temps/)).toBeInTheDocument();
});
