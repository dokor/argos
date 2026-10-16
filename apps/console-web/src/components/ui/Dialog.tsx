"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import s from "./Help.module.scss";
export default function Dialog({title,closeLabel,onClose,children}:{title:string;closeLabel:string;onClose:()=>void;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null), id=useId(), close=useRef(onClose);
  useEffect(()=>{close.current=onClose;},[onClose]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement | null, element=dialog.current!;
    element.showModal();
    const first=element.querySelector<HTMLElement>("select,textarea,input") ?? element.querySelector<HTMLElement>("button"); first?.focus();
    return ()=>{element.close();if(previous?.isConnected)previous.focus();};
  },[]);
  return <dialog ref={dialog} className={s.dialog} aria-labelledby={id} onCancel={event=>{event.preventDefault();close.current();}} onKeyDown={event=>{
    if(event.key!=="Tab")return;
    const items=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(item=>item.tabIndex>=0 && !item.closest('[aria-hidden="true"], [hidden]'));
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
  }}>
    <div className={s.dialogHead}><h2 id={id}>{title}</h2><button type="button" onClick={onClose} aria-label={closeLabel}>×</button></div>
    {children}
  </dialog>;
}
