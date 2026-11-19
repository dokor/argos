"use client";
import { intlLocale } from "@/lib/i18n/locales";
import { localizeValue } from "@/lib/i18n/messages";
import { useEffect, useState } from "react";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useLang } from "@/lib/i18n/LangContext";
import Link from "@/components/LocalizedLink";
import s from "./AnalyticsView.module.scss";

export type MeasurementState = { enabled: boolean; requestedEnabled: boolean; deploymentAllowed: boolean; bffAllowed: boolean; version: number; lastCollectedAt: string | null };
export default function MeasurementControl({ onChanged, onDenied }: { onChanged: () => void; onDenied: () => void }) {
  const { lang } = useLang();
  const [data, setData] = useState<MeasurementState | null>(null), [revision, setRevision] = useState(0);
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void accountFetch<MeasurementState>("admin/analytics/settings", "GET", undefined, controller.signal)
      .then(value => { if (!controller.signal.aborted) { setData(value); setError(""); } })
      .catch(reason => {
        if (controller.signal.aborted) return;
        if (reason instanceof AccountClientError && [401, 403].includes(reason.status)) onDenied();
        setData(null); setError((lang === "fr" ? "État de collecte indisponible. Réessayez." : localizeValue("Collection state unavailable. Try again.", lang)));
      });
    return () => controller.abort();
  }, [revision, onDenied, lang]);
  const blocked = data && (!data.deploymentAllowed || !data.bffAllowed);
  async function change() {
    if (!data || busy || (!data.requestedEnabled && (blocked || !confirmed))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await accountFetch<MeasurementState>("admin/analytics/settings", "PATCH", { enabled: !data.requestedEnabled, expectedVersion: data.version, confirmation: true });
      setData(result); setConfirmed(false);
      setNotice((lang === "fr" ? "Réglage enregistré et journalisé." : localizeValue("Setting saved and logged.", lang))); onChanged();
    } catch (reason) {
      if (reason instanceof AccountClientError && [401, 403].includes(reason.status)) onDenied();
      setError(reason instanceof AccountClientError && reason.code === "version_conflict"
        ? ((lang === "fr" ? "Le réglage a changé. Actualisez son état avant de réessayer." : localizeValue("The setting changed. Refresh its state before trying again.", lang)))
        : ((lang === "fr" ? "Modification refusée ou service indisponible. Aucun succès confirmé ; actualisez l’état." : localizeValue("Change refused or service unavailable. Success was not confirmed; refresh the state.", lang))));
    } finally { setBusy(false); }
  }
  return <section className={s.measurement} aria-label={(lang === "fr" ? "Réglage de collecte" : localizeValue("Collection setting", lang))}>
    <h2>{(lang === "fr" ? "Collecte de mesure produit" : localizeValue("Product measurement collection", lang))}</h2>
    {!data ? <p role={error ? "alert" : undefined}>{error || ((lang === "fr" ? "Chargement de l’état…" : localizeValue("Loading state…", lang)))}</p> : <>
      <p><strong>{blocked ? ((lang === "fr" ? "Indisponible · bloquée par la configuration" : localizeValue("Unavailable · blocked by configuration", lang))) : data.enabled ? ((lang === "fr" ? "Activée" : localizeValue("Enabled", lang))) : ((lang === "fr" ? "Désactivée" : localizeValue("Disabled", lang)))}</strong></p>
      {blocked && <p>{(lang === "fr" ? "L’opérateur doit autoriser product-analytics.enabled côté Java et PRODUCT_ANALYTICS_ENABLED avec ADMIN_API_TOKEN côté serveur web, puis redémarrer les services concernés. Ce contrôle ne contourne pas ces garde-fous." : localizeValue("The operator must allow product-analytics.enabled in Java and PRODUCT_ANALYTICS_ENABLED with ADMIN_API_TOKEN on the web server, then restart the affected services. This control cannot bypass these safeguards.", lang))}</p>}
      <p>{(lang === "fr" ? "Dernière collecte : " : localizeValue("Last collection: ", lang))}{data.lastCollectedAt ? new Date(data.lastCollectedAt).toLocaleString(intlLocale(lang), { timeZone: "UTC" }) + " UTC" : ((lang === "fr" ? "Aucune collecte enregistrée depuis la mise en service de ce réglage" : localizeValue("No collection recorded since this setting was introduced", lang)))}</p>
      <p>{(lang === "fr" ? "Les statistiques conservées restent consultables à l’arrêt. L’activation concerne les nouveaux événements consentis, sans collecte rétroactive. Conservation : 90 jours." : localizeValue("Retained statistics remain available while disabled. Enabling applies to new consented events, without retrospective collection. Retention: 90 days.", lang))} <Link href="/confidentialite">{(lang === "fr" ? "Information de confidentialité" : localizeValue("Privacy information", lang))}</Link></p>
      {!data.requestedEnabled && !blocked && <label className={s.confirm}><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />{(lang === "fr" ? "J’ai vérifié l’information de confidentialité et je confirme l’activation ; le consentement individuel reste obligatoire." : localizeValue("I reviewed the privacy information and confirm enabling collection; individual consent remains required.", lang))}</label>}
      <div className={s.controls}><button type="button" role="switch" aria-checked={data.enabled && !blocked} disabled={busy || (!data.requestedEnabled && (!!blocked || !confirmed))} onClick={() => void change()}>
        {data.requestedEnabled ? ((lang === "fr" ? "Désactiver la mesure produit" : localizeValue("Disable product measurement", lang))) : ((lang === "fr" ? "Activer la mesure produit" : localizeValue("Enable product measurement", lang)))}
      </button></div>
    </>}
    {error && data && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className={s.controls}><button type="button" disabled={busy} onClick={() => { setNotice(""); setRevision(v => v + 1); }}>{(lang === "fr" ? "Actualiser l’état de collecte" : localizeValue("Refresh collection state", lang))}</button></div>
  </section>;
}
