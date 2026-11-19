"use client";
import { localizedCopy } from "@/lib/i18n/messages";

import { useLang } from "@/lib/i18n/LangContext";
import LegalDocument from "./LegalDocument";
import { privacyContent } from "./legalContent";

export default function PrivacyPage() {
  const { lang } = useLang();
  const copy = localizedCopy(privacyContent, lang);
  return <LegalDocument content={copy} />;
}
