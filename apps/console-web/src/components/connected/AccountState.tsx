"use client";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { EmptyState, PageHeading } from "./Primitives";
import s from "./Connected.module.scss";
export default function AccountState({ kind, retry }: { kind: "loading" | "error" | "missing"; retry?: () => void }) {
  const { t } = useLang(), c = t.connected;
  return <main className={s.page}><PageHeading title={c.workspace}/><EmptyState
    title={kind === "loading" ? c.loading : kind === "missing" ? t.account.sites.unavailable : c.errorTitle}
    description={kind === "error" ? t.account.errors.account_unavailable : undefined}
    kind={kind === "loading" ? "loading" : kind === "error" ? "error" : "empty"}>
    {retry && <button className={s.secondary} onClick={retry}>{c.retry}</button>}
    {kind === "missing" && <Link className={s.secondary} href="/account/sites">{c.explore}</Link>}
  </EmptyState></main>;
}
