"use client";

import Link from "./PageLink";
import type { ComponentProps } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";

export default function LocalizedLink({ href, ...props }: ComponentProps<typeof Link>) {
  const { lang } = useLang();
  const target = typeof href === "string" && href.startsWith("/") ? localizedPath(href, lang) : href;
  const pathname = typeof target === "string" ? target.split(/[?#]/)[0] : target.pathname ?? "";
  // Session-dependent destinations can change after hydration. Loading them only
  // on navigation avoids canceled speculative requests and unnecessary private reads.
  const accountRoute = /^\/(?:en\/)?account(?:\/|$)/.test(pathname);
  return <Link {...props} prefetch={accountRoute ? false : props.prefetch} href={target} />;
}
