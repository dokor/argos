// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import { accountFetch } from "@/lib/account-client";
import { localizedAccountReturn } from "@/lib/account-navigation";
import fr from "@/lib/i18n/fr.json";
import en from "@/lib/i18n/en.json";
import AccountView from "./AccountView";
const {push} = vi.hoisted(() => ({push:vi.fn()}));
vi.mock("next/navigation", () => ({usePathname:()=>window.location.pathname,useRouter:()=>({push,refresh:vi.fn()})}));
vi.mock("@/lib/account-client", async original => ({...await original<typeof import("@/lib/account-client")>(),accountFetch:vi.fn()}));
beforeEach(() => {
  push.mockReset();
  vi.mocked(accountFetch).mockReset().mockImplementation(async path => path === "auth/providers" ? {providers:[],enabled:true} : {returnTo:"/account/sites"});
});

it.each(["fr","en"] as const)("explains registration and offers a non-revealing focused confirmation with correction in %s",async lang=>{
  const c=(lang === "fr" ? fr : en).account;
  const source="/en/account/settings?section=profile";
  window.history.replaceState(null,"","/account/register?returnTo="+encodeURIComponent(source));
  render(<LangProvider initialLang={lang}><AccountView mode="register"/></LangProvider>);
  expect(screen.getByText(c.registrationIntro)).toBeInTheDocument();
  expect(screen.getByText(c.registrationPolicyIntro,{exact:false})).toBeInTheDocument();
  expect(screen.queryByText(c.policyIntro,{exact:false})).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(c.name),{target:{value:"Fixture"}});
  fireEvent.change(screen.getByLabelText(c.email),{target:{value:"fixture@example.invalid"}});
  fireEvent.change(screen.getByLabelText(c.password),{target:{value:"synthetic long passphrase"}});
  await waitFor(()=>expect(accountFetch).toHaveBeenCalledWith("auth/providers"));
  fireEvent.submit(screen.getByRole("button",{name:c.register}).closest("form")!);
  const status=await screen.findByRole("status");
  expect(status).toHaveTextContent(c.registrationSent);
  await waitFor(()=>expect(status).toHaveFocus());
  expect(screen.queryByLabelText(c.password)).not.toBeInTheDocument();
  expect(accountFetch).toHaveBeenCalledWith("auth/register","POST",{email:"fixture@example.invalid",password:"synthetic long passphrase",displayName:"Fixture",returnTo:localizedAccountReturn(source,lang)});
  fireEvent.click(screen.getByRole("button",{name:c.correctEmail}));
  expect(screen.getByLabelText(c.email)).toHaveFocus();
  expect(screen.getByLabelText(c.email)).toHaveValue("fixture@example.invalid");
  expect(screen.getByLabelText(c.name)).toHaveValue("Fixture");
  expect(screen.getByLabelText(c.password)).toHaveValue("");
});

it.each(["fr","en"] as const)("uses the selected language for direct, cookie and unsafe login destinations in %s",async lang=>{
  const c=(lang === "fr" ? fr : en).account;
  const context="/account/runs/42?returnTo="+encodeURIComponent("/account?attention=priority&domainId=7");
  for(const source of [context,null,"https://evil.example"]) {
    window.history.replaceState(null,"","/account/sign-in"+(source === null ? "" : "?returnTo="+encodeURIComponent(source)));
    vi.mocked(accountFetch).mockImplementation(async path=>path === "auth/providers" ? {providers:[],enabled:true} : {returnTo:context});
    const view=render(<LangProvider initialLang={lang}><AccountView/></LangProvider>);
    const target=localizedAccountReturn(source ?? context,lang);
    await waitFor(()=>expect(screen.getByRole("link",{name:c.forgot})).toHaveAttribute("href",(lang === "en" ? "/en" : "")+"/account/forgot?returnTo="+encodeURIComponent(target)));
    fireEvent.change(screen.getByLabelText(c.email),{target:{value:"fixture@example.invalid"}});
    fireEvent.change(screen.getByLabelText(c.password),{target:{value:"synthetic passphrase"}});
    fireEvent.submit(screen.getByRole("button",{name:c.signIn}).closest("form")!);
    await waitFor(()=>expect(push).toHaveBeenLastCalledWith(target));
    view.unmount();
  }
});

it("keeps a scrubbed verification token and localizes context in language links until it is consumed",async()=>{
  window.history.replaceState(null,"","/account/verify?returnTo="+encodeURIComponent("/account/settings?section=profile")+"#token=synthetic-token");
  render(<AccountView mode="verify"/>);
  const verify=await screen.findByRole("button",{name:fr.account.verify});
  await waitFor(()=>expect(window.location.hash).toBe(""));
  const link=screen.getByRole("link",{name:"English"});
  const href=new URL(link.getAttribute("href")!,"https://fixture.invalid");
  expect(href.pathname).toBe("/en/account/verify");
  expect(href.searchParams.get("returnTo")).toBe("/en/account/settings?section=profile");
  expect(href.hash).toBe("#token=synthetic-token");
  fireEvent.click(verify);
  expect(await screen.findByRole("status")).toHaveTextContent(fr.account.verifiedDone);
  expect(link.getAttribute("href")).not.toContain("#token");
  expect(screen.getByRole("link",{name:fr.account.backToSignIn})).toHaveAttribute("href","/account/sign-in?returnTo="+encodeURIComponent("/account/settings?section=profile"));
});
