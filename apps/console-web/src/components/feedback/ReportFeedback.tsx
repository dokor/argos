"use client";
import { createContext, useContext, useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import type { FeedbackReference } from "@/lib/feedback-request";
import FeedbackForm from "./FeedbackForm";
import { feedbackCopy } from "./copy";
import s from "./FeedbackForm.module.scss";

export const FeedbackReportContext = createContext<FeedbackReference | undefined>(undefined);
export default function ReportFeedback({ findingKey }: { findingKey?: string }) {
  const reference = useContext(FeedbackReportContext), { lang } = useLang(), c = feedbackCopy[lang];
  const [open, setOpen] = useState(false);
  if (findingKey && !reference) return null;
  return <div className={s.panel}>
    <button className={s.trigger} type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? c.cancel : findingKey ? c.falsePositive : c.title}</button>
    {open && <FeedbackForm reference={reference} findingKey={findingKey} />}
  </div>;
}
