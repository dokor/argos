import {Suspense} from "react";
import DomainBatch from "@/components/connected/domains/DomainBatch";
export default async function Page({params}:{params:Promise<{domainId:string;batchId:string}>}){return <Suspense><DomainBatch {...await params}/></Suspense>;}
