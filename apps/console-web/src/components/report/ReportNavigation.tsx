"use client";
import { useLang } from "@/lib/i18n/LangContext";
import { REPORT_VIEWS, type ReportView } from "./reportReading";
import { reportReadingCopy } from "./reportReadingCopy";
import s from "./ReportNavigation.module.scss";

export default function ReportNavigation({ view, onChange, locked=false }: { view: ReportView; onChange: (view: ReportView) => void; locked?:boolean }) {
  const { lang } = useLang(); const copy = reportReadingCopy[lang];
  return <nav className={s.navigation} aria-label={copy.navigation}>
    {REPORT_VIEWS.map(value => <button type="button" key={value} aria-pressed={value === view}
      onClick={() => onChange(value)}>{copy[value]}{locked&&value!=="overview"&&<span> · {lang==="fr"?"Connexion":"Sign in"}</span>}</button>)}
  </nav>;
}
