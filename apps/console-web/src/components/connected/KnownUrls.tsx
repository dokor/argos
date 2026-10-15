"use client";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import type { Overview } from "@/lib/connected/contracts";
import { useDomainResource } from "./domains/useDomainResource";
import { clarteCopy } from "./clarteCopy";
import { compactUrl } from "./compactCopy";
import s from "./Analysis.module.scss";
import ui from "./Connected.module.scss";
export default function KnownUrls() {
  const {t,lang}=useLang(), c=clarteCopy[lang];
  const resource=useDomainResource<Overview>("overview?limit=3&offset=0");
  if(resource.error) return <div className={ui.actions}><p role="status">{c.recentError}</p><button className={ui.secondary} onClick={resource.reload}>{t.connected.retry}</button></div>;
  if(!resource.data) return <p role="status">{t.connected.loading}</p>;
  const recent=resource.data.recentRuns.filter((page,index,all)=>all.findIndex(other=>other.normalizedUrl===page.normalizedUrl)===index).slice(0,3);
  if(!recent.length) return <p className={s.muted}>{c.recentEmpty}</p>;
  return <ul className={s.knownUrls}>{recent.map(page=><li key={page.pageId}>
    <div><strong title={page.normalizedUrl}>{compactUrl(page.normalizedUrl)}</strong><Link className={ui.textLink} href={`/account/urls/${page.pageId}/history`}>{c.history}</Link></div>
    <Link className={ui.secondary} href={`/account/analyses/new?url=${encodeURIComponent(page.normalizedUrl)}#analysis-url`}>{c.useUrl}</Link>
  </li>)}</ul>;
}
