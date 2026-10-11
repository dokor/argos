import AdminView from "@/components/admin/AdminView";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <AdminView runId={id}/>;}
