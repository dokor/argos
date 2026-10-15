import type {Metadata} from "next";
import {http} from "@/lib/ArgosApi";
import type {Report} from "@/components/report/types";
import ReportPage from "@/app/(fr)/report/[token]/ReportPage";
import ReportErrorView from "@/components/report/ReportErrorView";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Rapport partagé | Argos",robots:{index:false,follow:false},alternates:{canonical:null,languages:{}}};
export default async function SharedReport({params}:{params:Promise<{token:string}>}) {
 const {token}=await params;
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))return <ReportErrorView kind="notFound"/>;
 let report:Report;
 try{report=await http<Report>("/api/reports/shared/"+token,{cache:"no-store"});}
 catch{return <ReportErrorView kind="notFound"/>;}
 return <ReportPage params={{report}} shared/>;
}
