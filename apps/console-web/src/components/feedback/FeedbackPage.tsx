"use client";
import { useLang } from "@/lib/i18n/LangContext";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import FeedbackForm from "./FeedbackForm";
import { feedbackCopy } from "./copy";
import s from "./FeedbackForm.module.scss";
export default function FeedbackPage() {
  const {lang}=useLang(),c=feedbackCopy[lang];
  return <><SiteNav/><main className={s.page}><h1>{c.title}</h1><p>{c.intro}</p><FeedbackForm/></main><SiteFooter/></>;
}
