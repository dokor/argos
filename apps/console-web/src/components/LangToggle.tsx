"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { localizedPath } from "@/lib/i18n/routes";
import { locales } from "@/lib/i18n/locales";
import { localizeValue } from "@/lib/i18n/messages";
import { useLang } from "@/lib/i18n/LangContext";
import { readingSnapshot, subscribeReading } from "./report/reportReading";
import { authLanguagePath, type AuthLanguageContext } from "@/lib/account-navigation";
import s from "./LangToggle.module.scss";
type Props = { className?: string; variant?: "light" | "dark"; authContext?: AuthLanguageContext };
export default function LangToggle({ className, variant = "light", authContext }: Props) {
  const { lang } = useLang();
  const pathname = usePathname();
  const suffix = useSyncExternalStore(subscribeReading, readingSnapshot, () => "");
  const details = useRef<HTMLDetailsElement>(null);
  const menu = useRef<HTMLElement>(null);
  const positionMenu = () => {
    if (!details.current?.open || !menu.current) return;
    const anchor = details.current.getBoundingClientRect();
    const width = menu.current.getBoundingClientRect().width;
    const top = Math.max(8, Math.min(anchor.bottom + 8, window.innerHeight - 116));
    menu.current.style.right = "auto";
    menu.current.style.left = `${Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8))}px`;
    menu.current.style.top = `${top}px`;
    menu.current.style.maxHeight = `${Math.max(100, Math.min(480, window.innerHeight - top - 16))}px`;
  };
  const label = lang === "fr" ? "Langue" : localizeValue("Language", lang);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !details.current?.contains(event.target)) details.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", close);
    const closeOnResize = () => details.current?.removeAttribute("open");
    window.addEventListener("resize", closeOnResize);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("resize", closeOnResize); };
  }, []);
  return <details ref={details} onToggle={positionMenu} className={`${s.toggle} ${s[variant]}${className ? ` ${className}` : ""}`} onKeyDown={event => {
    if (event.key === "Escape" && details.current?.open) {
      details.current.open = false;
      details.current.querySelector("summary")?.focus();
      event.stopPropagation();
    }
  }}>
    <summary className={s.trigger} aria-label={`${label} — ${locales.find(locale => locale.code === lang)!.name}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg>
      <span>{lang.toUpperCase()}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>
    </summary>
    <nav ref={menu} className={s.menu} aria-label={label}>
      {locales.map(locale => <a key={locale.code}
        href={authContext ? authLanguagePath(pathname + suffix, locale.code, authContext) : localizedPath(pathname + suffix, locale.code)}
        hrefLang={locale.code} lang={locale.code} className={s.option}
        aria-current={lang === locale.code ? "page" : undefined}
        onClick={() => details.current?.removeAttribute("open")}>
        <span>{locale.name}</span><span aria-hidden="true" className={s.code}>{locale.code.toUpperCase()}</span>
      </a>)}
    </nav>
  </details>;
}
