"use client";

import { Fragment } from "react";
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
        <Fragment key={l}>
          {i === 1 && <span className={s.sep} aria-hidden="true" />}
          <button
            type="button"
            onClick={() => setLang(l)}
            className={`${s.option} ${lang === l ? s.active : ""}`}
            aria-pressed={lang === l}
            aria-label={l === "fr" ? "Français" : "English"}
          >
            {l.toUpperCase()}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
