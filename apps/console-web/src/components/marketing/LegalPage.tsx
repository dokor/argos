"use client";

import { useLang } from "@/lib/i18n/LangContext";
import LegalDocument from "./LegalDocument";
import { serviceContent } from "./legalContent";

export default function LegalPage() {
  const { lang } = useLang();
  const copy = serviceContent[lang];
  return <LegalDocument content={copy} />;
}
