import { redirect } from "next/navigation";
import { safeAccountReturn } from "@/lib/account-return";
export default async function Page({searchParams}:{searchParams:Promise<{returnTo?:string}>}) {
  const {returnTo}=await searchParams;
  const suffix=typeof returnTo==="string"&&safeAccountReturn(returnTo)===returnTo ? "?returnTo="+encodeURIComponent(returnTo):"";
  redirect("/en/account/settings"+suffix);
}
