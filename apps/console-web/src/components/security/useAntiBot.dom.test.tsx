// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import {useAntiBot} from "./useAntiBot";
const done=vi.fn(),fetchMock=vi.fn();let options:Record<string,unknown>;
function Form(){const bot=useAntiBot("register");return <form onSubmit={async event=>{event.preventDefault();try{done(await bot.verify());}catch{}}}>{bot.element}<button disabled={bot.working}>Send</button></form>;}
beforeEach(()=>{done.mockReset();fetchMock.mockReset();vi.stubGlobal("fetch",fetchMock);delete window.turnstile;});
afterEach(()=>vi.unstubAllGlobals());
it("loads no provider when protection is explicitly disabled",async()=>{
 fetchMock.mockResolvedValue(new Response('{"enabled":false}'));render(<Form/>);fireEvent.click(screen.getByText("Send"));await waitFor(()=>expect(done).toHaveBeenCalledWith(undefined));expect(document.querySelector('script[src*="turnstile"]')).toBeNull();
});
it("gets a fresh proof per attempt, handles expiration and never stores the token",async()=>{
 fetchMock.mockImplementation(async()=>new Response('{"enabled":true,"siteKey":"public-key"}'));
 const renderWidget=vi.fn((_element,config)=>{options=config;return "widget";}),remove=vi.fn();window.turnstile={render:renderWidget,execute:vi.fn(),remove};
 render(<Form/>);fireEvent.click(screen.getByText("Send"));await waitFor(()=>expect(renderWidget).toHaveBeenCalledTimes(1));
 expect(options).toMatchObject({action:"register",appearance:"interaction-only",execution:"execute",size:"flexible"});
 (options.callback as (token:string)=>void)("fresh-proof");await waitFor(()=>expect(done).toHaveBeenCalledWith("fresh-proof"));expect(remove).toHaveBeenCalledWith("widget");
 fireEvent.click(screen.getByText("Send"));await waitFor(()=>expect(renderWidget).toHaveBeenCalledTimes(2));(options["expired-callback"] as ()=>void)();expect(await screen.findByRole("alert")).toHaveTextContent("a expiré");expect(done).toHaveBeenCalledTimes(1);
});
it("fails closed for configuration outage or script blocking and allows retry",async()=>{
 fetchMock.mockRejectedValueOnce(new Error()).mockResolvedValue(new Response('{"enabled":true,"siteKey":"key"}'));
 render(<Form/>);fireEvent.click(screen.getByText("Send"));expect(await screen.findByRole("alert")).toHaveTextContent("challenges.cloudflare.com");
 fireEvent.click(screen.getByText("Send"));await waitFor(()=>expect(document.querySelector('script[src*="turnstile"]')).not.toBeNull());fireEvent.error(document.querySelector('script[src*="turnstile"]')!);
 expect(await screen.findByRole("alert")).toHaveTextContent("vérification anti-robot");expect(done).not.toHaveBeenCalled();
});
