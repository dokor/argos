"use client";
import { localizeValue } from "@/lib/i18n/messages";
import {usePathname} from "next/navigation";
import Link from "@/components/LocalizedLink";
import {useLang} from "@/lib/i18n/LangContext";
import s from "./ReportActions.module.scss";
export default function ReportAccountPrompt({shared=false}:{shared?:boolean}) {
 const {lang}=useLang(),path=usePathname(),destination=encodeURIComponent(path||"/account");
 return <aside className={s.invitation} aria-label={(lang === "fr" ? "Accéder au rapport détaillé" : localizeValue("Access the detailed report", lang))}><div><h2>{shared?((lang === "fr" ? "Ce rapport vous a été partagé." : localizeValue("This report was shared with you.", lang))):((lang === "fr" ? "Passez du diagnostic aux corrections." : localizeValue("Move from diagnosis to corrections.", lang)))}</h2><p>{(lang === "fr" ? "Créez un compte pour accéder à l’analyse détaillée, sauvegarder vos rapports et suivre vos prochains audits." : localizeValue("Create an account to access detailed analysis, save your reports and track future audits.", lang))}</p>{shared&&<p>{(lang === "fr" ? "Les détails sont en lecture seule. L’historique du propriétaire reste privé." : localizeValue("Details are read-only. The owner's history stays private.", lang))}</p>}</div><div className={s.links}><Link className={s.primary} href={"/account/register?returnTo="+destination}>{(lang === "fr" ? "Créer mon compte" : localizeValue("Create my account", lang))}</Link><Link href={"/account/sign-in?returnTo="+destination}>{(lang === "fr" ? "J’ai déjà un compte →" : localizeValue("I already have an account →", lang))}</Link></div></aside>;
}
