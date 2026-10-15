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
      onPointerDown={event => {
        // Pointer users can keep typing; keyboard users keep focus on the toggle.
        if (event.button === 0 && document.activeElement === input.current) event.preventDefault();
      }}
      onClick={() => {
        const field = input.current;
        if (field) selection.current = { start: field.selectionStart ?? 0, end: field.selectionEnd ?? 0, direction: field.selectionDirection ?? "none" };
        setVisible(previous => !previous);
      }}>
      {visible ? t.account.hidePasswordShort : t.account.showPasswordShort}
    </button>
  </div>;
}
