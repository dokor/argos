"use client";
import { localizeValue, localizedCopy } from "@/lib/i18n/messages";
import { useLang } from "@/lib/i18n/LangContext";
import { REPORT_VIEWS, type ReportView } from "./reportReading";
import { reportReadingCopy } from "./reportReadingCopy";
import s from "./ReportNavigation.module.scss";
import PublicIcon from "@/components/marketing/PublicIcon";

export default function ReportNavigation({ view, onChange, locked=false }: { view: ReportView; onChange: (view: ReportView) => void; locked?:boolean }) {
  const { lang } = useLang(); const copy = localizedCopy(reportReadingCopy, lang);
  return <nav className={s.navigation} aria-label={copy.navigation}>
    {REPORT_VIEWS.map(value => <button type="button" key={value} aria-pressed={value === view}
      onClick={() => onChange(value)}>{copy[value]}{locked&&value!=="overview"&&<span title={(lang === "fr" ? "Connexion requise" : localizeValue("Sign-in required", lang))}><PublicIcon index={1} size={14}/></span>}</button>)}
  </nav>;
}
