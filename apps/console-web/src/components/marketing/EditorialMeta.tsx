"use client";
import { localizeValue } from "@/lib/i18n/messages";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { editorialPages } from "@/lib/editorial";
import s from "./EditorialMeta.module.scss";
export default function EditorialMeta({ route, fixedFrench = false }: { route: string; fixedFrench?: boolean }) {
  const { lang } = useLang(); const language = fixedFrench ? "fr" : lang; const fr = language === "fr"; const record = editorialPages[route];
  if (!record) return null;
  return <div className={s.meta}><p>{fr ? "Par" : localizeValue("By", lang)} <Link href="/a-propos">Antoine Le Louët</Link> · {fr ? "Lecture estimée" : localizeValue("Estimated reading", lang)} : {record.minutes} min · <a href={record.sourcesAnchor}>{fr ? "Références" : localizeValue("References", lang)}</a></p></div>;
}
