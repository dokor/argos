// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {LangProvider} from "@/lib/i18n/LangContext";
import {billingRead,billingSync,billingDestination,BillingClientError} from "@/lib/billing-client";
import {accountFetch} from "@/lib/account-client";
import type {BillingSnapshot} from "@/lib/billing-contract";
import {disabled,variants} from "./fixtures/billing.mjs";
import BillingView from "./BillingView";
const state=vi.hoisted(()=>({profile:{verified:true,email:"fixture@example.com"},search:""}));
vi.mock("next/navigation",()=>({useSearchParams:()=>new URLSearchParams(state.search),usePathname:()=>"/account/billing"}));
vi.mock("@/components/account/AccountSession",()=>({useAccountSession:()=>state}));
vi.mock("@/lib/billing-client",async original=>({...await original<typeof import("@/lib/billing-client")>(),billingRead:vi.fn(),billingSync:vi.fn(),billingDestination:vi.fn()}));
vi.mock("@/lib/account-client",async original=>({...await original<typeof import("@/lib/account-client")>(),accountFetch:vi.fn()}));
beforeEach(()=>{
  state.profile={verified:true,email:"fixture@example.com"};state.search="";vi.mocked(billingRead).mockReset();vi.mocked(billingSync).mockReset();vi.mocked(billingDestination).mockReset();
  vi.mocked(billingRead).mockResolvedValue(disabled as BillingSnapshot);vi.mocked(accountFetch).mockResolvedValue([{provider:"password",usable:true,id:"1"}]);
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it.each(["fr","en"] as const)("displays approved prices, illustrative VAT and both closed gates without starting any payment in %s",async lang=>{
  render(<LangProvider initialLang={lang}><BillingView/></LangProvider>);
  expect(await screen.findByRole("heading",{name:lang==="fr"?"Paiements désactivés":"Payments disabled"})).toBeInTheDocument();
  for(const amount of lang==="fr"?["19,00 €","199,00 €"]:["€19.00","€199.00"])expect(screen.getByText(amount)).toBeInTheDocument();
  expect(screen.getByText(/22[,.]80/)).toBeInTheDocument();expect(screen.getByText(/238[,.]80/)).toBeInTheDocument();
  expect(screen.getByText(/12[,.]7/)).toBeInTheDocument();
  expect(screen.getByText(/Les quotas restent mensuels|Quotas remain monthly/)).toBeInTheDocument();
  expect(screen.getByRole("button",{name:lang==="fr"?"Continuer avec Stripe Checkout":"Continue with Stripe Checkout"})).toBeDisabled();
  expect(billingDestination).not.toHaveBeenCalled();expect(billingSync).not.toHaveBeenCalled();
});
it("a browser success return only reads status and never grants, syncs or starts another Checkout",async()=>{
  state.search="payment=return&customer=cus_forged";render(<BillingView/>);
  expect(await screen.findByText(/Retour de Stripe/)).toBeInTheDocument();
  expect(await screen.findByText("Aucune souscription Stripe")).toBeInTheDocument();
  expect(billingDestination).not.toHaveBeenCalled();expect(billingSync).not.toHaveBeenCalled();
});
it.each(["ending","unpaid","refund","dispute","delayed","manual"] as const)("renders the controlled %s state without suggesting a second subscription",async name=>{
  vi.mocked(billingRead).mockResolvedValue(variants[name] as BillingSnapshot);render(<BillingView/>);
  await screen.findByRole("heading",{name:"Votre souscription"});
  expect(screen.getByRole("button",{name:"Continuer avec Stripe Checkout"})).toBeDisabled();expect(billingDestination).not.toHaveBeenCalled();
});
it("does not send a billing request for an unverified account",async()=>{
  state.profile.verified=false;render(<BillingView/>);await screen.findByRole("heading",{name:"Vérifiez votre email"});
  expect(billingRead).not.toHaveBeenCalled();expect(billingDestination).not.toHaveBeenCalled();
});
it("an ambiguous Checkout removes actionable data and requires a read before any new user action",async()=>{
  vi.mocked(billingRead).mockResolvedValue(variants.ready as BillingSnapshot);vi.mocked(billingDestination).mockRejectedValue(new BillingClientError("billing_sync_pending"));
  render(<BillingView/>);const start=await screen.findByRole("button",{name:"Continuer avec Stripe Checkout"});await waitFor(()=>expect(start).toBeEnabled());fireEvent.click(start);
  fireEvent.change(screen.getByLabelText("Mot de passe actuel"),{target:{value:"fixture password"}});fireEvent.submit(screen.getByLabelText("Mot de passe actuel").closest("form")!);
  expect(await screen.findByRole("heading",{name:"Action non confirmée"})).toBeInTheDocument();
  expect(billingDestination).toHaveBeenCalledTimes(1);expect(screen.queryByRole("button",{name:"Continuer avec Stripe Checkout"})).not.toBeInTheDocument();
  expect(billingSync).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Actualiser l’état"}));
  expect(await screen.findByRole("button",{name:"Continuer avec Stripe Checkout"})).toBeInTheDocument();expect(billingDestination).toHaveBeenCalledTimes(1);
});
