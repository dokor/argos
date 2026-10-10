"use client";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { editorialPages } from "@/lib/editorial";
import s from "./EditorialMeta.module.scss";
export default function EditorialMeta({ route, fixedFrench = false }: { route: string; fixedFrench?: boolean }) {
  const { lang } = useLang(); const language = fixedFrench ? "fr" : lang; const fr = language === "fr"; const record = editorialPages[route];
  if (!record) return null;
  const date = (value: string) => new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }).format(new Date(value + "T00:00:00Z"));
  return <div className={s.meta}><p>{fr ? "Par" : "By"} <Link href="/a-propos">Antoine Le Louët</Link> · {fr ? "Lecture estimée" : "Estimated reading"} : {record.minutes} min</p><p>{fr ? "Première version du texte" : "First source version"} : <time dateTime={record.firstVersion}>{date(record.firstVersion)}</time> · {fr ? "Révision du contenu" : "Content revision"} : <time dateTime={record.revised}>{date(record.revised)}</time> · <a href={record.sourcesAnchor}>{fr ? "Références" : "References"}</a></p>{!fr && record.translatedAt && <p>English version: <time dateTime={record.translatedAt}>{date(record.translatedAt)}</time></p>}</div>;
}
