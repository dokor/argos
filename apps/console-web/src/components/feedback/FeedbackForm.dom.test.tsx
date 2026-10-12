// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import FeedbackForm from "./FeedbackForm";
import ReportFeedback, { FeedbackReportContext } from "./ReportFeedback";
vi.mock("@/lib/account-client",()=>({accountAuditHeaders:async()=>({"X-Argos-CSRF":"c".repeat(43)})}));
const fetchMock=vi.fn();
beforeEach(()=>{fetchMock.mockReset();vi.stubGlobal("fetch",fetchMock);});
afterEach(()=>vi.unstubAllGlobals());
it.each(["fr","en"] as const)("sends a suggestion without automatically attaching a report in %s",async lang=>{
  fetchMock.mockResolvedValue(new Response('{"accepted":true}'));
  render(<LangProvider initialLang={lang}><FeedbackForm reference={{reportToken:"t".repeat(43)}}/></LangProvider>);
  fireEvent.change(screen.getByLabelText(lang==="fr"?"Description":"Description"),{target:{value:"Useful fixture idea"}});
  fireEvent.click(screen.getByRole("button",{name:lang==="fr"?"Envoyer le retour":"Send feedback"}));
  await screen.findByRole("status");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({type:"SUGGESTION",description:"Useful fixture idea",website:""});
});
it("preserves bug text after failure and sends optional context only on explicit consent",async()=>{
  fetchMock.mockResolvedValueOnce(new Response('{}',{status:503})).mockResolvedValueOnce(new Response('{"accepted":true}'));
  render(<LangProvider><FeedbackForm reference={{runId:"42"}}/></LangProvider>);
  fireEvent.change(screen.getByLabelText("Type de retour"),{target:{value:"BUG"}});
  const description=screen.getByLabelText("Description");fireEvent.change(description,{target:{value:"Fixture button fails"}});
  fireEvent.change(screen.getByLabelText("Étapes pour reproduire (facultatif)"),{target:{value:"Click the button"}});
  fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"Envoyer le retour"}));
  await screen.findByRole("alert");expect(description).toHaveValue("Fixture button fails");
  fireEvent.click(screen.getByRole("button",{name:"Envoyer le retour"}));await screen.findByRole("status");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({type:"BUG",runId:"42",steps:"Click the button"});
});
it("does not confirm a successful HTTP response without a server receipt acknowledgement",async()=>{
  fetchMock.mockResolvedValue(new Response('{}'));
  render(<LangProvider><FeedbackForm/></LangProvider>);
  fireEvent.change(screen.getByLabelText("Description"),{target:{value:"Fixture idea"}});
  fireEvent.click(screen.getByRole("button",{name:"Envoyer le retour"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("L’envoi a échoué");
  expect(screen.queryByRole("status")).toBeNull();
});
it("requires a real report context for false positives and communicates rate-limit errors",async()=>{
  const view=render(<LangProvider><ReportFeedback findingKey="http.hsts"/></LangProvider>);expect(screen.queryByRole("button")).toBeNull();
  view.rerender(<LangProvider><FeedbackReportContext.Provider value={{reportToken:"t".repeat(43)}}><ReportFeedback findingKey="http.hsts"/></FeedbackReportContext.Provider></LangProvider>);
  fireEvent.click(screen.getByRole("button",{name:"Signaler un faux positif"}));expect(screen.getByText(/Le score et les preuves restent inchangés/)).toBeInTheDocument();
  fetchMock.mockResolvedValue(new Response('{}',{status:429,headers:{"Retry-After":"30"}}));
  fireEvent.change(screen.getByLabelText("Description"),{target:{value:"Incorrect on fixture"}});fireEvent.click(screen.getByRole("button",{name:"Envoyer le retour"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("30");
  await waitFor(()=>expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({type:"FALSE_POSITIVE",findingKey:"http.hsts",reportToken:"t".repeat(43)}));
});
