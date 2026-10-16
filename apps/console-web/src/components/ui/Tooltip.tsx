"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import s from "./Help.module.scss";
export default function Tooltip({label,content,children,placement="top",className}:{label:string;content:string;children?:ReactNode;className?:string;placement?:"top"|"bottom"}) {
  const id=useId(),trigger=useRef<HTMLButtonElement>(null),tip=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open,setOpen]=useState(false),[position,setPosition]=useState({left:8,top:8,maxWidth:"min(320px, calc(100vw - 16px))"});
  const show=()=>{if(timer.current)clearTimeout(timer.current);setOpen(true);};
  const hide=()=>{timer.current=setTimeout(()=>setOpen(false),160);};
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  useEffect(()=>{
    if(!open)return;
    const position=()=>{
      const rect=trigger.current?.getBoundingClientRect(),box=tip.current?.getBoundingClientRect();if(!rect||!box)return;
      const viewportWidth=document.documentElement.clientWidth || window.innerWidth;
      const below=placement==="bottom" ? rect.bottom+8+box.height<=window.innerHeight-8 : rect.top<box.height+16;
      setPosition({maxWidth:Math.min(320,viewportWidth-16)+"px",left:Math.max(8,Math.min(rect.left+rect.width/2-box.width/2,viewportWidth-box.width-8)),top:Math.max(8,Math.min(below?rect.bottom+8:rect.top-box.height-8,window.innerHeight-box.height-8))});
    };
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);if(timer.current)clearTimeout(timer.current);}};
    position();window.addEventListener("resize",position);window.addEventListener("scroll",position,true);document.addEventListener("keydown",escape);
    return ()=>{window.removeEventListener("resize",position);window.removeEventListener("scroll",position,true);document.removeEventListener("keydown",escape);};
  },[open,placement]);
  return <><button ref={trigger} type="button" className={`${s.trigger} ${className??""}`} aria-label={label} aria-describedby={open?id:undefined} onFocus={show} onBlur={()=>setOpen(false)} onMouseEnter={show} onMouseLeave={hide} onClick={show}>{children??<span aria-hidden="true">ⓘ</span>}</button>
    {open&&createPortal(<div ref={tip} id={id} role="tooltip" className={s.tooltip} style={position} onMouseEnter={show} onMouseLeave={hide}>{content}</div>,document.body)}
  </>;
}
