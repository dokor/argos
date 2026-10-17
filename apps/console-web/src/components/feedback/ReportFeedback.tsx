"use client";
import { createContext, useContext } from "react";
import type { FeedbackReference } from "@/lib/feedback-request";
import FeedbackButton from "./FeedbackButton";
import s from "./FeedbackForm.module.scss";
export const FeedbackReportContext = createContext<FeedbackReference | undefined>(undefined);
export default function ReportFeedback({findingKey}:{findingKey?:string}) {
  const reference=useContext(FeedbackReportContext);
  if(findingKey && !reference)return null;
  return <FeedbackButton className={s.findingTrigger} reference={reference} findingKey={findingKey}/>;
}
