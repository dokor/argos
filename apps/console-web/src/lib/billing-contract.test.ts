import {expect,it} from "vitest";
import {billingSnapshot,stripeDestination} from "./billing-contract";
import {disabled,variants} from "@/components/connected/billing/fixtures/billing.mjs";
import {safeAccountReturn} from "./account-return";
it("accepts known owner-only states and requires prices before offering a payment",()=>{
  for(const data of Object.values(variants))expect(billingSnapshot(data)).toBe(true);
  expect(billingSnapshot({...disabled,enabled:true,paymentsEnabled:true,canCheckout:true})).toBe(false);
  expect(billingSnapshot({...disabled,customerId:"cus_private"})).toBe(false);
  expect(billingSnapshot({...disabled,schemaVersion:2})).toBe(false);
});
it("does not admit new currencies, inconsistent gates, unknown states or arbitrary destinations",()=>{
  for(const change of [{ciEnabled:"true"},{status:"ASSUMED_PAID"},{enabled:false,canCheckout:true},{portalAvailable:true}]){
    expect(billingSnapshot({...disabled,...change})).toBe(false);
  }
  expect(stripeDestination({url:"http://checkout.stripe.com/c/pay/fake"},false)).toBe(false);
  expect(stripeDestination({url:"https://checkout.stripe.com/c/pay/fixture"},false)).toBe(true);
  expect(stripeDestination({url:"https://billing.stripe.com/p/session?secret=fixture"},true)).toBe(true);
  expect(stripeDestination({url:"https://billing.stripe.com/p/session?secret=fixture"},false)).toBe(false);
});
it("allows a fixed localized reauthentication return without admitting payment queries or external redirects",()=>{
  expect(safeAccountReturn("/account/billing")).toBe("/account/billing");expect(safeAccountReturn("/en/account/billing")).toBe("/en/account/billing");
  expect(safeAccountReturn("//attacker.invalid/account/billing")).toBe("/account/sites");
  expect(safeAccountReturn("/account/billing?payment=return")).toBe("/account/sites");
});
