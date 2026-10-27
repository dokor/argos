"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import type { FeedbackReference } from "@/lib/feedback-request";
import Dialog from "@/components/ui/Dialog";
import FeedbackForm from "./FeedbackForm";
import { feedbackCopy } from "./copy";
import s from "./FeedbackForm.module.scss";

/** Loaded only after a feedback action; keeps its draft until deliberate dismissal. */
export default function FeedbackDialog({ type, reference, findingKey, onClose }: {
  type: string;
  reference?: FeedbackReference;
  findingKey?: string;
  onClose: () => void;
}) {
  const { lang } = useLang(), c = feedbackCopy[lang];
  const [dirty, setDirty] = useState(false), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  const keepButton = useRef<HTMLButtonElement>(null), formArea = useRef<HTMLDivElement>(null), wasConfirm = useRef(false);
  useEffect(() => {
    if (confirm) keepButton.current?.focus();
    else if (wasConfirm.current) formArea.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    wasConfirm.current = confirm;
  }, [confirm]);
  const close = () => { if (busy) return; if (dirty) setConfirm(true); else onClose(); };
  return <Dialog title={c.title} closeLabel={c.cancel} onClose={close}>
    <p>{c.intro}</p>
    {confirm ? <div className={s.form}><p role="alert">{c.discard}</p><div className={s.actions}><button ref={keepButton} type="button" onClick={() => setConfirm(false)}>{c.keep}</button><button type="button" onClick={onClose}>{c.discardAction}</button></div></div> : null}
    <div ref={formArea} hidden={confirm}><FeedbackForm reference={reference} findingKey={findingKey} initialType={findingKey ? "FALSE_POSITIVE" : type} onDirty={() => setDirty(true)} onSent={() => setDirty(false)} onBusy={setBusy} /></div>
    <button className={s.trigger} type="button" disabled={busy} onClick={close}>{c.cancel}</button>
  </Dialog>;
}
