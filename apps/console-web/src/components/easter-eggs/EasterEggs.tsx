"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./EasterEggs.module.scss";

const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
const positions = [
  [4, 15], [32, 5], [65, 8], [93, 18], [7, 39], [94, 42],
  [4, 67], [95, 65], [12, 88], [35, 93], [62, 90], [84, 85],
];
let inspectorShown = false;

/** Optional decoration; the keyboard listener never cancels a key or intercepts typing. */
export default function EasterEggs() {
  const { t } = useLang();
  const [active, setActive] = useState(false);
  const eyes = useRef<HTMLDivElement>(null);
  const toast = useRef<HTMLDivElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const dismiss = useCallback(() => {
    if (toast.current?.contains(document.activeElement)) origin.current?.focus();
    setActive(false);
  }, []);

  useEffect(() => {
    if (!inspectorShown) {
      inspectorShown = true;
      console.info(`${t.easterEggs.inspector}\nhttps://github.com/dokor/argos`);
    }
  }, [t]);

  useEffect(() => {
    let recentKeys: string[] = [], lastKeyAt = 0;
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
      if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey
        || (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="slider"], [role="spinbutton"]'))) {
        recentKeys = [];
        return;
      }
      const now = Date.now();
      if (now - lastKeyAt > 3000) recentKeys = [];
      lastKeyAt = now;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      recentKeys = [...recentKeys, key].slice(-code.length);
      if (recentKeys.length === code.length && code.every((expected, index) => recentKeys[index] === expected)) {
        recentKeys = [];
        if (!toast.current) origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setActive(true);
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [dismiss]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(dismiss, 5000);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pupils = Array.from(eyes.current?.querySelectorAll<SVGGElement>("g") ?? []);
    let frame = 0, pointerX = 0, pointerY = 0;
    function look() {
      frame = 0;
      if (motion.matches) return;
      for (const pupil of pupils) {
        const rect = pupil.ownerSVGElement!.getBoundingClientRect();
        const angle = Math.atan2(pointerY - rect.top - rect.height / 2, pointerX - rect.left - rect.width / 2);
        pupil.style.setProperty("--look-x", `${Math.cos(angle) * 3}px`);
        pupil.style.setProperty("--look-y", `${Math.sin(angle) * 3}px`);
      }
    }
    function pointermove(event: PointerEvent) {
      if (motion.matches) return;
      pointerX = event.clientX; pointerY = event.clientY;
      if (!frame) frame = requestAnimationFrame(look);
    }
    function reset() {
      for (const pupil of pupils) {
        pupil.style.removeProperty("--look-x"); pupil.style.removeProperty("--look-y");
      }
    }
    window.addEventListener("pointermove", pointermove, { passive: true });
    motion.addEventListener("change", reset);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", pointermove);
      motion.removeEventListener("change", reset);
    };
  }, [active, dismiss]);

  return <>
    <div className={s.announcement} role="status" aria-atomic="true">
      {active && <div className={s.toast} ref={toast}>
        <div><strong>{t.easterEggs.eyes.title}</strong><p>{t.easterEggs.eyes.message}</p></div>
        <button type="button" onClick={dismiss} aria-label={t.easterEggs.eyes.dismiss}>
          <span aria-hidden="true">×</span>
        </button>
      </div>}
    </div>
    {active && <div ref={eyes} className={s.eyes} aria-hidden="true">
      {positions.map(([x, y], index) => <svg key={index} viewBox="0 0 48 32" className={s.eye}
        style={{ left: `${x}%`, top: `${y}%`, "--delay": `${index * 25}ms` } as CSSProperties}>
        <path d="M2 16Q24-8 46 16Q24 40 2 16Z" />
        <g className={s.pupil}><circle cx="24" cy="16" r="7" /><circle cx="24" cy="16" r="2" /></g>
      </svg>)}
    </div>}
  </>;
}
