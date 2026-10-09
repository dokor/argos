"use client";

import { Fragment, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { frenchPath, languageRoutes, localizedPath } from "@/lib/i18n/routes";
import { useLang, Lang } from "@/lib/i18n/LangContext";
import s from "./LangToggle.module.scss";
import { readingSnapshot, subscribeReading } from "./report/reportReading";

type Props = {
  className?: string;
  variant?: "light" | "dark";
};

export default function LangToggle({ className, variant = "light" }: Props) {
  const { lang, setLang } = useLang();
  const pathname = usePathname();
  const suffix = useSyncExternalStore(subscribeReading, readingSnapshot, () => "");
  const hasLanguageRoute = Boolean(languageRoutes[frenchPath(pathname)]) || /^\/(en\/)?report\//.test(pathname);

  return (
    <div
      className={`${s.toggle} ${s[variant]}${className ? " " + className : ""}`}
      role="group"
      aria-label="Language"
    >
      {(["fr", "en"] as Lang[]).map((l, i) => (
        <Fragment key={l}>
          {i === 1 && <span className={s.sep} aria-hidden="true" />}
          {hasLanguageRoute ? <Link
            href={localizedPath(pathname + suffix, l)}
            hrefLang={l}
            lang={l}
            className={`${s.option} ${lang === l ? s.active : ""}`}
            aria-current={lang === l ? "page" : undefined}
            aria-label={l === "fr" ? "Français" : "English"}
          >
            {l.toUpperCase()}
          </Link> : <button
            type="button"
            onClick={() => setLang(l)}
            className={`${s.option} ${lang === l ? s.active : ""}`}
            aria-pressed={lang === l}
            aria-label={l === "fr" ? "Français" : "English"}
          >
            {l.toUpperCase()}
          </button>}
        </Fragment>
      ))}
    </div>
  );
}
