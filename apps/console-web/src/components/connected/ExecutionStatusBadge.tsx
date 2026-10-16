"use client";
import Tooltip from "@/components/ui/Tooltip";
import { helpCopy } from "@/components/ui/ContextHelp";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./ExecutionStatusBadge.module.scss";

const labels = {
  fr: { COMPLETED: "Terminé", SUCCESS: "Succès", RUNNING: "En cours", PENDING: "En attente", QUEUED: "En attente", FAILED: "Échoué", ERROR: "Erreur", TIMEOUT: "Délai dépassé", PARTIAL: "Partiel", WARNING: "Avertissement", SKIPPED: "Non exécuté", CANCELED: "Annulé", CANCELLED: "Annulé", NOT_APPLICABLE: "Non applicable", UNKNOWN: "Non renseigné" },
  en: { COMPLETED: "Completed", SUCCESS: "Success", RUNNING: "Running", PENDING: "Pending", QUEUED: "Pending", FAILED: "Failed", ERROR: "Error", TIMEOUT: "Timed out", PARTIAL: "Partial", WARNING: "Warning", SKIPPED: "Skipped", CANCELED: "Canceled", CANCELLED: "Canceled", NOT_APPLICABLE: "Not applicable", UNKNOWN: "Unknown" },
};
export function executionTone(state: unknown) {
  switch (state) {
    case "COMPLETED": case "SUCCESS": return "success";
    case "RUNNING": return "info";
    case "FAILED": case "ERROR": case "TIMEOUT": return "danger";
    case "PARTIAL": case "WARNING": return "warning";
    default: return "neutral";
  }
}
export default function ExecutionStatusBadge({ state }: { state: unknown }) {
  const { lang } = useLang(), copy = labels[lang];
  const label = typeof state === "string" && Object.hasOwn(copy, state) ? copy[state as keyof typeof copy] : copy.UNKNOWN;
  const key=typeof state === "string" ? ({SUCCESS:"COMPLETED",ERROR:"FAILED",CANCELLED:"CANCELED",NOT_APPLICABLE:"SKIPPED",WARNING:"PARTIAL"} as Record<string,string>)[state] ?? state : "UNKNOWN";
  const descriptions=helpCopy[lang].statuses;
  return <Tooltip label={label} content={descriptions[key as keyof typeof descriptions] ?? descriptions.UNKNOWN}><span className={s.badge} data-tone={executionTone(state)}>{label}</span></Tooltip>;
}
