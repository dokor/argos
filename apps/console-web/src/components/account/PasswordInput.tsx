"use client";

import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./PasswordInput.module.scss";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { id: string };

/** A single native input preserves autofill, paste and selection when revealed. */
export default function PasswordInput(props: Props) {
  const { t } = useLang();
  const [visible, setVisible] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef<{ start: number; end: number; direction: "forward" | "backward" | "none" } | null>(null);
  useLayoutEffect(() => {
    if (selection.current) {
      const { start, end, direction } = selection.current;
      input.current?.setSelectionRange(start, end, direction);
      selection.current = null;
    }
  }, [visible]);
  return <div className={s.control}>
    <input {...props} ref={input} type={visible ? "text" : "password"}/>
    <button type="button" className={s.toggle} disabled={props.disabled}
      aria-controls={props.id} aria-pressed={visible}
      aria-label={visible ? t.account.hidePassword : t.account.showPassword}
      title={visible ? t.account.hidePassword : t.account.showPassword}
      onPointerDown={event => {
        // Pointer users can keep typing; keyboard users keep focus on the toggle.
        if (event.button === 0 && document.activeElement === input.current) event.preventDefault();
      }}
      onClick={() => {
        const field = input.current;
        if (field) selection.current = { start: field.selectionStart ?? 0, end: field.selectionEnd ?? 0, direction: field.selectionDirection ?? "none" };
        setVisible(previous => !previous);
      }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        {visible ? <>
          <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/>
          <path d="M9.9 5.2A10.5 10.5 0 0 1 12 5c5 0 9 7 9 7a18.7 18.7 0 0 1-2.5 3.3M6.5 6.5A24 24 0 0 0 3 12s4 7 9 7a10.2 10.2 0 0 0 5.5-1.5"/>
        </> : <>
          <path d="M3 12s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7Z"/>
          <circle cx="12" cy="12" r="3"/>
        </>}
      </svg>
    </button>
  </div>;
}
