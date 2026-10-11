import { Suspense } from "react";
import SitesView from "@/components/account/SitesView";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Suspense><SitesView key={id} siteId={id}/></Suspense>;}
