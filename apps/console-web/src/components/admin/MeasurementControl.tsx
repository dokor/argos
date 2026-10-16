"use client";
import { useEffect, useState } from "react";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useLang } from "@/lib/i18n/LangContext";
import Link from "@/components/LocalizedLink";
import s from "./AnalyticsView.module.scss";

export type MeasurementState = { enabled: boolean; requestedEnabled: boolean; deploymentAllowed: boolean; bffAllowed: boolean; version: number; lastCollectedAt: string | null };
export default function MeasurementControl({ onChanged, onDenied }: { onChanged: () => void; onDenied: () => void }) {
  const { lang } = useLang(), fr = lang === "fr";
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
        setData(null); setError(fr ? "État de collecte indisponible. Réessayez." : "Collection state unavailable. Try again.");
      });
    return () => controller.abort();
  }, [revision, onDenied, fr]);
  const blocked = data && (!data.deploymentAllowed || !data.bffAllowed);
  async function change() {
    if (!data || busy || (!data.requestedEnabled && (blocked || !confirmed))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await accountFetch<MeasurementState>("admin/analytics/settings", "PATCH", { enabled: !data.requestedEnabled, expectedVersion: data.version, confirmation: true });
      setData(result); setConfirmed(false);
      setNotice(fr ? "Réglage enregistré et journalisé." : "Setting saved and logged."); onChanged();
    } catch (reason) {
      if (reason instanceof AccountClientError && [401, 403].includes(reason.status)) onDenied();
      setError(reason instanceof AccountClientError && reason.code === "version_conflict"
        ? (fr ? "Le réglage a changé. Actualisez son état avant de réessayer." : "The setting changed. Refresh its state before trying again.")
        : (fr ? "Modification refusée ou service indisponible. Aucun succès confirmé ; actualisez l’état." : "Change refused or service unavailable. Success was not confirmed; refresh the state."));
    } finally { setBusy(false); }
  }
  return <section className={s.measurement} aria-label={fr ? "Réglage de collecte" : "Collection setting"}>
    <h2>{fr ? "Collecte de mesure produit" : "Product measurement collection"}</h2>
    {!data ? <p role={error ? "alert" : undefined}>{error || (fr ? "Chargement de l’état…" : "Loading state…")}</p> : <>
      <p><strong>{blocked ? (fr ? "Indisponible · bloquée par la configuration" : "Unavailable · blocked by configuration") : data.enabled ? (fr ? "Activée" : "Enabled") : (fr ? "Désactivée" : "Disabled")}</strong></p>
      {blocked && <p>{fr ? "L’opérateur doit autoriser product-analytics.enabled côté Java et PRODUCT_ANALYTICS_ENABLED avec ADMIN_API_TOKEN côté serveur web, puis redémarrer les services concernés. Ce contrôle ne contourne pas ces garde-fous." : "The operator must allow product-analytics.enabled in Java and PRODUCT_ANALYTICS_ENABLED with ADMIN_API_TOKEN on the web server, then restart the affected services. This control cannot bypass these safeguards."}</p>}
      <p>{fr ? "Dernière collecte : " : "Last collection: "}{data.lastCollectedAt ? new Date(data.lastCollectedAt).toLocaleString(lang, { timeZone: "UTC" }) + " UTC" : (fr ? "Aucune collecte enregistrée depuis la mise en service de ce réglage" : "No collection recorded since this setting was introduced")}</p>
      <p>{fr ? "Les statistiques conservées restent consultables à l’arrêt. L’activation concerne les nouveaux événements consentis, sans collecte rétroactive. Conservation : 90 jours." : "Retained statistics remain available while disabled. Enabling applies to new consented events, without retrospective collection. Retention: 90 days."} <Link href="/confidentialite">{fr ? "Information de confidentialité" : "Privacy information"}</Link></p>
      {!data.requestedEnabled && !blocked && <label className={s.confirm}><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />{fr ? "J’ai vérifié l’information de confidentialité et je confirme l’activation ; le consentement individuel reste obligatoire." : "I reviewed the privacy information and confirm enabling collection; individual consent remains required."}</label>}
      <div className={s.controls}><button type="button" role="switch" aria-checked={data.enabled && !blocked} disabled={busy || (!data.requestedEnabled && (!!blocked || !confirmed))} onClick={() => void change()}>
        {data.requestedEnabled ? (fr ? "Désactiver la mesure produit" : "Disable product measurement") : (fr ? "Activer la mesure produit" : "Enable product measurement")}
      </button></div>
    </>}
    {error && data && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className={s.controls}><button type="button" disabled={busy} onClick={() => { setNotice(""); setRevision(v => v + 1); }}>{fr ? "Actualiser l’état de collecte" : "Refresh collection state"}</button></div>
  </section>;
}
