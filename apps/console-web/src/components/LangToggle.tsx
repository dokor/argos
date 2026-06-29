"use client";

import { useLang, Lang } from "@/lib/i18n/LangContext";
import s from "./LangToggle.module.scss";

type Props = {
  className?: string;
  variant?: "light" | "dark";
};

export default function LangToggle({ className, variant = "light" }: Props) {
  const { lang, setLang } = useLang();

  return (
    <div
      className={`${s.toggle} ${s[variant]}${className ? " " + className : ""}`}
      role="group"
      aria-label="Language"
    >
      {(["fr", "en"] as Lang[]).map((l, i) => (
        <>
          {i === 1 && <span key="sep" className={s.sep} aria-hidden="true" />}
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`${s.option} ${lang === l ? s.active : ""}`}
            aria-pressed={lang === l}
          >
            {l.toUpperCase()}
          </button>
        </>
      ))}
    </div>
  );
}
