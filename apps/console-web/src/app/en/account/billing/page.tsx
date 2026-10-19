import {Suspense} from "react";
import BillingView from "@/components/connected/billing/BillingView";
export const metadata={title:"Premium subscription"};
export default function Page(){return <Suspense><BillingView/></Suspense>;}
