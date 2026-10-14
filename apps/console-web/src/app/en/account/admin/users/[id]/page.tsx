import {Suspense} from "react";
import {notFound} from "next/navigation";
import AdminAccounts from "@/components/admin/AdminAccounts";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!/^[1-9][0-9]{0,18}$/.test(id)||BigInt(id)>BigInt("9223372036854775807"))notFound();return <Suspense key={id}><AdminAccounts id={id}/></Suspense>;}
