import {Suspense} from "react";
import {redirect} from "next/navigation";
import {safeAccountReturn} from "@/lib/account-return";
import OverviewView from "@/components/connected/OverviewView";
export default async function Page({searchParams}:{searchParams:Promise<{returnTo?:string}>}){
 const {returnTo}=await searchParams;
 if(typeof returnTo==="string"&&safeAccountReturn(returnTo)===returnTo&&!/^\/(?:en\/)?account(?:\?|$)/.test(returnTo))redirect(returnTo);
 return <Suspense><OverviewView/></Suspense>;
}
