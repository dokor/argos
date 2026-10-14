// @vitest-environment jsdom
import {beforeEach,it,expect,vi} from "vitest";
import {render,screen,fireEvent,waitFor,within,act} from "@testing-library/react";
import AccountSettings from "./AccountSettings";
import {accountFetch,AccountClientError} from "@/lib/account-client";
const state=vi.hoisted(()=>({section:"profile",push:vi.fn(),denied:false,invalidate:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:state.push}),useSearchParams:()=>new URLSearchParams("section="+state.section),usePathname:()=>"/account/settings"}));
vi.mock("./AccountSession",()=>({useAccountSession:()=>({denied:state.denied,invalidate:state.invalidate})}));
vi.mock("@/lib/account-client",()=>({accountFetch:vi.fn(),AccountClientError:class extends Error{constructor(public code:string,public status:number){super(code);}}}));
let methods:{id:string;provider:string}[],providers:string[],calls:string[];
beforeEach(()=>{
 state.section="security";state.denied=false;state.push.mockReset();calls=[];
 methods=[{id:"1",provider:"password"},{id:"2",provider:"github"}];providers=["github","google"];
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
 vi.mocked(accountFetch).mockReset();vi.mocked(accountFetch).mockImplementation(async(path,method)=>{
  if(method&&method!=="GET"){calls.push(path);return {};}
  if(path==="me")return {displayName:"Camille",email:"fixture@example.com",verified:true};
  if(path==="methods")return methods;if(path==="auth/providers")return {providers};
  if(path==="sessions")return [{id:"3",createdAt:"2026-10-14T08:00:00Z",current:true},{id:"4",createdAt:"2026-10-13T08:00:00Z",current:false}];return {};
 });
});
async function openPassword(){await screen.findByLabelText("Nouveau mot de passe");fireEvent.change(screen.getByLabelText("Nouveau mot de passe"),{target:{value:"a synthetic long passphrase"}});fireEvent.submit(screen.getByRole("button",{name:"Enregistrer le mot de passe"}).closest("form")!);return screen.getByRole("dialog");}
it("requires identity confirmation before a password mutation and refreshes only after success",async()=>{
 render(<AccountSettings/>);const dialog=await openPassword();expect(calls).toEqual([]);
 fireEvent.change(within(dialog).getByLabelText("Mot de passe actuel"),{target:{value:"current synthetic password"}});
 fireEvent.submit(within(dialog).getByRole("button",{name:"Confirmer et continuer"}).closest("form")!);
 await waitFor(()=>expect(calls).toEqual(["auth/reauth","methods/password"]));await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
 expect(accountFetch).toHaveBeenCalledWith("methods/password","POST",{password:"a synthetic long passphrase"});expect(screen.getByLabelText("Nouveau mot de passe")).toHaveValue("");
});
it("uses email reauthentication for an OAuth-only account and never submits a password",async()=>{
 methods=[{id:"2",provider:"github"}];render(<AccountSettings/>);const dialog=await openPassword();
 expect(within(dialog).queryByLabelText("Mot de passe actuel")).not.toBeInTheDocument();
 fireEvent.click(within(dialog).getByRole("button",{name:"Recevoir un code"}));await within(dialog).findByRole("status");
 fireEvent.change(within(dialog).getByLabelText("Code reçu par email"),{target:{value:"fixture-code"}});
 fireEvent.submit(within(dialog).getByRole("button",{name:"Confirmer et continuer"}).closest("form")!);
 await waitFor(()=>expect(accountFetch).toHaveBeenCalledWith("auth/reauth","POST",{code:"fixture-code"}));
 await waitFor(()=>expect(calls).toEqual(["auth/reauth","auth/reauth","methods/password"]));
});
it("does not mutate or navigate when an identity check fails",async()=>{
 const base=vi.mocked(accountFetch).getMockImplementation()!;vi.mocked(accountFetch).mockImplementation(async(...args)=>{if(args[0]==="auth/reauth")throw new AccountClientError("token_invalid",400);return base(...args);});
 render(<AccountSettings/>);const dialog=await openPassword();fireEvent.change(within(dialog).getByLabelText("Mot de passe actuel"),{target:{value:"invalid"}});fireEvent.submit(within(dialog).getByRole("button",{name:"Confirmer et continuer"}).closest("form")!);
 expect(await within(dialog).findByRole("alert")).toHaveTextContent("invalide");expect(calls).toEqual([]);expect(state.push).not.toHaveBeenCalled();
});
it("cancels a sensitive action without a network write and restores its trigger focus",async()=>{
 render(<AccountSettings/>);const button=await screen.findByRole("button",{name:"Fermer mon compte"});button.focus();fireEvent.click(button);
 fireEvent.click(screen.getByRole("button",{name:"Annuler"}));expect(screen.queryByRole("dialog")).not.toBeInTheDocument();expect(button).toHaveFocus();expect(calls).toEqual([]);
});
it("requires explicit archive confirmation, explains retained reports and signs out only after success",async()=>{
 render(<AccountSettings/>);fireEvent.click(await screen.findByRole("button",{name:"Fermer mon compte"}));const dialog=screen.getByRole("dialog");
 expect(dialog).toHaveTextContent("resteront lisibles");expect(dialog).toHaveTextContent("effacement physique");
 fireEvent.change(within(dialog).getByLabelText("Mot de passe actuel"),{target:{value:"synthetic password"}});
 const submit=within(dialog).getByRole("button",{name:"Confirmer et continuer"});expect(submit).toBeDisabled();fireEvent.click(within(dialog).getByRole("checkbox"));fireEvent.submit(submit.closest("form")!);
 await waitFor(()=>expect(accountFetch).toHaveBeenCalledWith("me/archive","POST",{confirmed:true}));expect(state.push).toHaveBeenCalledWith("/account/sign-in");
});
it("does not count an unconfigured linked provider as a usable alternative",async()=>{
 providers=[];render(<AccountSettings/>);expect(await screen.findByRole("button",{name:"Retirer le mot de passe"})).toBeDisabled();
});
it("offers only configured providers, keeps unavailable linked methods visible and protects the final access",async()=>{
 state.section="connections";methods=[{id:"2",provider:"github"},{id:"3",provider:"linkedin"}];providers=["github","google"];
 render(<AccountSettings/>);expect(await screen.findByRole("button",{name:"Associer Google"})).toBeEnabled();expect(screen.queryByRole("button",{name:"Associer LinkedIn"})).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Retirer GitHub"})).toBeDisabled();expect(screen.getByRole("button",{name:"Retirer LinkedIn"})).toBeEnabled();expect(screen.getByText(/temporairement indisponible/)).toBeInTheDocument();
});
it("stops before the protected mutation if reauthentication finishes after unmount",async()=>{
 let resolve!:()=>void;const base=vi.mocked(accountFetch).getMockImplementation()!;
 vi.mocked(accountFetch).mockImplementation(async(...args)=>args[0]==="auth/reauth" ? new Promise<void>(r=>{resolve=r;}):base(...args));
 const view=render(<AccountSettings/>);const dialog=await openPassword();fireEvent.change(within(dialog).getByLabelText("Mot de passe actuel"),{target:{value:"synthetic"}});fireEvent.submit(within(dialog).getByRole("button",{name:"Confirmer et continuer"}).closest("form")!);
 await waitFor(()=>expect(resolve).toBeDefined());view.unmount();await act(async()=>resolve());expect(calls).toEqual([]);expect(state.push).not.toHaveBeenCalled();
});
it("keeps changes unsaved when profile update fails and reports an error",async()=>{
 state.section="profile";const base=vi.mocked(accountFetch).getMockImplementation()!;vi.mocked(accountFetch).mockImplementation(async(...args)=>{if(args[1]==="PATCH")throw new AccountClientError("account_unavailable",503);return base(...args);});
 render(<AccountSettings/>);fireEvent.change(await screen.findByLabelText("Nom d’affichage"),{target:{value:"Camille edited"}});fireEvent.submit(screen.getByRole("button",{name:"Enregistrer"}).closest("form")!);
 expect(await screen.findByRole("alert")).toHaveTextContent("indisponible");expect(screen.getByLabelText("Nom d’affichage")).toHaveValue("Camille edited");expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("preserves the report destination while confirming an unverified email",async()=>{
  const report="/report/"+"r".repeat(43);state.section="profile&returnTo="+encodeURIComponent(report);
  const base=vi.mocked(accountFetch).getMockImplementation()!;vi.mocked(accountFetch).mockImplementation(async(...args)=>args[0]==="me" ? {displayName:"Camille",email:null,verified:false}:base(...args));
  render(<AccountSettings/>);
  fireEvent.change(await screen.findByLabelText("Adresse email",{selector:"input[type=email]"}),{target:{value:"fixture@example.com"}});
  expect(screen.getAllByLabelText("Adresse email")).toHaveLength(1);
  expect(screen.queryByText("L’adresse de connexion est en lecture seule.")).not.toBeInTheDocument();
  fireEvent.submit(screen.getByRole("button",{name:"Envoyer l’email de vérification"}).closest("form")!);
  await waitFor(()=>expect(accountFetch).toHaveBeenCalledWith("auth/confirm-email","POST",{email:"fixture@example.com",returnTo:report}));
});

it.each([false,true])("lets an email-less social account close using recent sign-in, or request sign-in again (expired=%s)",async expired=>{
  const base=vi.mocked(accountFetch).getMockImplementation()!;
  vi.mocked(accountFetch).mockImplementation(async(...args)=>{
    if(args[0]==="me")return {displayName:"Camille",email:null,verified:false};
    if(expired&&args[0]==="me/archive")throw new AccountClientError("reauth_required",403);
    return base(...args);
  });
  render(<AccountSettings/>);fireEvent.click(await screen.findByRole("button",{name:"Fermer mon compte"}));
  const dialog=screen.getByRole("dialog");expect(within(dialog).queryByLabelText("Mot de passe actuel")).not.toBeInTheDocument();expect(within(dialog).queryByLabelText("Code reçu par email")).not.toBeInTheDocument();
  const submit=within(dialog).getByRole("button",{name:"Confirmer et continuer"});expect(submit).toBeDisabled();fireEvent.click(within(dialog).getByRole("checkbox"));expect(submit).toBeEnabled();fireEvent.submit(submit.closest("form")!);
  if(expired){expect(await within(dialog).findByRole("alert")).toHaveTextContent("Confirmez votre identité");expect(within(dialog).getByRole("link",{name:"Se connecter"})).toHaveAttribute("href","/account/sign-in?returnTo=%2Faccount%2Fsettings%3Fsection%3Dsecurity");expect(state.push).not.toHaveBeenCalled();}
  else await waitFor(()=>expect(accountFetch).toHaveBeenCalledWith("me/archive","POST",{confirmed:true}));
  expect(vi.mocked(accountFetch).mock.calls.some(call=>call[0]==="auth/reauth")).toBe(false);
});
