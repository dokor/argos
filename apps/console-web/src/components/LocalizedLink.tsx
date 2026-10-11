"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";

export default function LocalizedLink({ href, ...props }: ComponentProps<typeof Link>) {
  const { lang } = useLang();
  return <Link {...props} href={typeof href === "string" && href.startsWith("/") ? localizedPath(href, lang) : href} />;
}
