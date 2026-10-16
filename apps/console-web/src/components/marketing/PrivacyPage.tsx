"use client";

import { useLang } from "@/lib/i18n/LangContext";
import LegalDocument from "./LegalDocument";
import { privacyContent } from "./legalContent";

export default function PrivacyPage() {
  const { lang } = useLang();
  const copy = privacyContent[lang];
  return <LegalDocument content={copy} />;
}
