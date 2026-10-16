"use client";
import { useEffect, useState } from "react";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useLang } from "@/lib/i18n/LangContext";
import { copy } from "./copy";
import s from "./AdminView.module.scss";

type Option = { state?: string; id: string; site?: string | null; displayName?: string | null; email?: string | null };
type Options = { items: Option[]; nextCursor: string | null };

/** Native select paired with a bounded server search; search text never becomes a filter. */
export default function RunFilterSelect({ kind, initial, onDenied }: {
  kind: "site" | "user"; initial: string; onDenied: () => void;
}) {
  const { lang } = useLang(), c = copy[lang];
  const [search, setSearch] = useState(""), [cursor, setCursor] = useState("");
  const [value, setValue] = useState(initial), [result, setResult] = useState<Options | null>(null);
  const [error, setError] = useState(false), [loading, setLoading] = useState(true);
  const [selectedLabel, setSelectedLabel] = useState(kind === "user" ? c.missingUser : initial);
  const label = (item: Option) => kind === "site" ? item.site ?? c.unavailableTarget : item.displayName?.trim() || item.email?.trim() || c.missingUser;
  useEffect(() => {
    if (kind !== "user" || !initial || initial === "anonymous") return;
    const controller = new AbortController();
    void accountFetch<Option>("admin/users/" + initial, "GET", undefined, controller.signal)
      .then(item => { if (!controller.signal.aborted) setSelectedLabel(item.state === "ARCHIVED" ? c.missingUser : item.displayName?.trim() || item.email?.trim() || c.missingUser); })
      .catch(() => { /* Preserve the selected ID even for an archived or missing account. */ });
    return () => controller.abort();
  }, [kind, initial, c.missingUser]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError(false);
      const query = new URLSearchParams({ kind, limit: "20", ...(search ? { q: search } : {}), ...(cursor ? { cursor } : {}) });
      void accountFetch<Options>("admin/run-options?" + query, "GET", undefined, controller.signal)
        .then(data => { if (!controller.signal.aborted) { setResult(data); setLoading(false); } })
        .catch(reason => {
          if (controller.signal.aborted) return;
          if (reason instanceof AccountClientError && [401, 403].includes(reason.status)) onDenied();
          setError(true); setLoading(false);
        });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [kind, search, cursor, onDenied]);
  const options = (result?.items ?? []).filter(item => kind === "user" || item.site);
  const optionValue = (item: Option) => kind === "user" ? item.id : item.site!;
  return <div className={s.lookup}>
    <label>{kind === "user" ? c.userSearch : c.siteSearch}
      <input type="search" maxLength={100} placeholder={kind === "user" ? c.userPlaceholder : c.sitePlaceholder}
        value={search} onChange={e => { setSearch(e.target.value); setCursor(""); setLoading(true); }} />
    </label>
    <label>{kind === "user" ? c.user : c.site}
      <select name={kind} value={value} onChange={e => { setValue(e.target.value); setSelectedLabel(e.target.selectedOptions[0].text); }}>
        <option value="">{c.all}</option>
        {kind === "user" && <option value="anonymous">{c.anonymous}</option>}
        {value && value !== "anonymous" && !options.some(item => optionValue(item) === value) && <option value={value}>{selectedLabel}</option>}
        {options.map(item => <option key={item.id} value={optionValue(item)}>{label(item)}</option>)}
      </select>
    </label>
    <span aria-live="polite">{error ? c.error : loading ? c.loading : !options.length ? c.empty : ""}</span>
    <div className={s.lookupPages}>
      {cursor && <button type="button" onClick={() => setCursor("")}>{c.first}</button>}
      {result?.nextCursor && <button type="button" disabled={loading} onClick={() => setCursor(result.nextCursor!)}>{c.moreOptions}</button>}
    </div>
  </div>;
}
