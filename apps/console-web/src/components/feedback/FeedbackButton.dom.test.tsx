// @vitest-environment jsdom
import {beforeEach,it,expect,vi} from "vitest";
import {render,screen,fireEvent,waitFor,within} from "@testing-library/react";
import {LangProvider} from "@/lib/i18n/LangContext";
import FeedbackButton from "./FeedbackButton";
vi.mock("@/lib/account-client",()=>({accountAuditHeaders:async()=>({})}));
vi.mock("@/components/security/useAntiBot",()=>({useAntiBot:()=>({verify:async()=>undefined,element:null})}));
beforeEach(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};});
it.each(["fr","en"] as const)("gives the icon an accessible action and opens the same dialog in %s",lang=>{
 render(<LangProvider initialLang={lang}><FeedbackButton variant="icon"/></LangProvider>);
 const label=lang==="fr" ? "Faire un retour" : "Send feedback";
 const trigger=screen.getByRole("button",{name:label});
 expect(trigger).toHaveAttribute("title",label);expect(trigger).toHaveAttribute("aria-haspopup","dialog");
 trigger.focus();fireEvent.click(trigger);expect(screen.getByRole("dialog",{name:label})).toBeInTheDocument();
 fireEvent(screen.getByRole("dialog"),new Event("cancel",{bubbles:true,cancelable:true}));expect(trigger).toHaveFocus();
});
it.each(["fr","en"] as const)("opens the common modal with the selected type and restores focus in %s",lang=>{
 render(<LangProvider initialLang={lang}><FeedbackButton type="BUG">Open</FeedbackButton></LangProvider>);
 const trigger=screen.getByRole("button",{name:"Open"});trigger.focus();fireEvent.click(trigger);
 const dialog=screen.getByRole("dialog");expect(within(dialog).getByRole("combobox",{name:lang==="fr"?"Type de retour":"Feedback type"})).toHaveValue("BUG");
 fireEvent(dialog,new Event("cancel",{bubbles:true,cancelable:true}));expect(screen.queryByRole("dialog")).toBeNull();expect(trigger).toHaveFocus();
});
it("requires a deliberate report opt-in, preserves drafts, prevents duplicate sends and confirms discard",async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response('{"accepted":true}'));vi.stubGlobal("fetch",fetch);
 render(<FeedbackButton reference={{reportToken:"t".repeat(43)}}>Open</FeedbackButton>);fireEvent.click(screen.getByText("Open"));
 expect(screen.getByRole("checkbox")).not.toBeChecked();fireEvent.change(screen.getByLabelText("Description"),{target:{value:"A careful report"}});
 fireEvent.change(screen.getByLabelText("URL concernées (facultatif)"),{target:{value:"https://example.com/"}});
 fireEvent(screen.getByRole("dialog"),new Event("cancel",{bubbles:true,cancelable:true}));expect(screen.getByRole("alert")).toHaveTextContent("Votre message n’a pas été envoyé");
 expect(screen.getByText("Continuer la rédaction")).toHaveFocus();
 fireEvent.click(screen.getByText("Continuer la rédaction"));expect(screen.getByLabelText("Description")).toHaveFocus();expect(screen.getByLabelText("Description")).toHaveValue("A careful report");
 const submit=screen.getByRole("button",{name:"Envoyer le retour"});fireEvent.click(submit);fireEvent.click(submit);
 await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("Votre retour a été reçu"));expect(fetch).toHaveBeenCalledTimes(1);
 const body=JSON.parse(fetch.mock.calls[0][1].body);expect(body).toMatchObject({type:"SUGGESTION",urls:"https://example.com/"});expect(body.reportToken).toBeUndefined();expect(body.runId).toBeUndefined();vi.unstubAllGlobals();
});
