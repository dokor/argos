"use client";
import { useSearchParams } from "next/navigation";
import { useLang } from "@/lib/i18n/LangContext";
import Link from "@/components/LocalizedLink";
import { useAccountSession } from "@/components/account/AccountSession";
import { PageHeading, Surface } from "./Primitives";
import KnownUrls from "./KnownUrls";
import AnalysisForm from "./AnalysisForm";
import AnalysisNavigation from "./AnalysisNavigation";
import { analysisCopy } from "./analysisCopy";
import s from "./Analysis.module.scss";
import ui from "./Connected.module.scss";
export default function NewAnalysis() {
  const {t,lang}=useLang(),c=analysisCopy[lang],session=useAccountSession(),params=useSearchParams();
  const initialUrl=(params.get("url")??"").slice(0,2048);
  return <main className={ui.page}><PageHeading title={c.title} description={c.intro}/><AnalysisNavigation active="new"/>
    {!session.ready ? <p role="status">{t.account.working}</p> : !session.profile?.verified || session.denied ? <p role="alert">{session.profile ? t.account.pending : t.account.errors.session_invalid}</p> : <>
      <div className={s.columns}><Surface title={c.formTitle}><AnalysisForm key={initialUrl} initialUrl={initialUrl}/></Surface><Surface title={c.discover}><ul className={s.discovery}>{c.categories.map((category,index)=><li key={category}><strong>{category}</strong><p>{c.descriptions[index]}</p></li>)}</ul></Surface></div>
      <div id="known-urls" className={s.knownSection}><Surface title={c.known} action={<Link href="/account/sites">{c.sites}</Link>}><p className={s.muted}>{c.knownHint}</p><KnownUrls/></Surface></div>
    </>}
  </main>;
}
