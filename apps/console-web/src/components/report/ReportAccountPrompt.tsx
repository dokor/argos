"use client";
import {usePathname} from "next/navigation";
import Link from "@/components/LocalizedLink";
import {useLang} from "@/lib/i18n/LangContext";
import s from "./ReportActions.module.scss";
export default function ReportAccountPrompt({shared=false}:{shared?:boolean}) {
 const {lang}=useLang(),fr=lang==="fr",path=usePathname(),destination=encodeURIComponent(path||"/account");
 return <aside className={s.invitation} aria-label={fr?"Accéder au rapport détaillé":"Access the detailed report"}><div><h2>{shared?(fr?"Ce rapport vous a été partagé.":"This report was shared with you."):(fr?"Passez du diagnostic aux corrections.":"Move from diagnosis to corrections.")}</h2><p>{fr?"Créez un compte pour accéder à l’analyse détaillée, sauvegarder vos rapports et suivre vos prochains audits.":"Create an account to access detailed analysis, save your reports and track future audits."}</p>{shared&&<p>{fr?"Les détails sont en lecture seule. L’historique du propriétaire reste privé.":"Details are read-only. The owner's history stays private."}</p>}</div><div className={s.links}><Link className={s.primary} href={"/account/register?returnTo="+destination}>{fr?"Créer mon compte":"Create my account"}</Link><Link href={"/account/sign-in?returnTo="+destination}>{fr?"J’ai déjà un compte →":"I already have an account →"}</Link></div></aside>;
}
