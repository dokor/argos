"use client";
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {usePathname} from 'next/navigation';
import {useLang} from '@/lib/i18n/LangContext';
import PrintableReport,{type ExportFormat} from './PrintableReport';
import {loadExportReport,exportTitle} from './reportExportData';
import {exportCopy} from './exportCopy';
import s from './ReportExport.module.scss';
import printStyle from './PrintableReport.module.scss';
export default function ReportExport() {
 const {lang}=useLang();const e=exportCopy[lang];const path=usePathname();const token=path?.match(/^\/(?:en\/)?report\/([A-Za-z0-9_-]+)$/)?.[1];
 const [format,setFormat]=useState<ExportFormat>('summary');const [state,setState]=useState<'idle'|'busy'|'ready'|'failed'>('idle');
 async function prepare() {
  setState('busy');const preview=window.open('about:blank','_blank');
  if(!preview){setState('failed');return;} preview.opener=null; preview.document.title='Argos';preview.document.body.textContent=e.busy;
  try {
   const report=await loadExportReport(token!);if(preview.closed)throw new Error('Closed');
   preview.document.documentElement.lang=lang;preview.document.title=exportTitle(format,report.generatedAt);
   const base=preview.document.createElement('base');base.href=window.location.origin+'/';preview.document.head.append(base);
   const robots=preview.document.createElement('meta');robots.name='robots';robots.content='noindex, nofollow';preview.document.head.append(robots);
   const loading:Promise<void>[]=[];
   document.querySelectorAll('style,link[rel="stylesheet"]').forEach(node=>{
    const clone=node.cloneNode(true) as HTMLElement;
    if(clone instanceof HTMLLinkElement){loading.push(new Promise((resolve,reject)=>{clone.onload=()=>resolve();clone.onerror=()=>reject(new Error('Styles unavailable'));}));}
    preview.document.head.append(clone);
   });
   const host=preview.document.createElement('div');preview.document.body.replaceChildren(host);
   const root=createRoot(host);flushSync(()=>root.render(<><div className={printStyle.toolbar}><button onClick={()=>preview.print()}>{e.print}</button><button onClick={()=>preview.close()}>{e.close}</button><p>{e.ready}</p></div><PrintableReport report={report} lang={lang} format={format}/></>));
   await Promise.all(loading);await preview.document.fonts.ready;setState('ready');preview.focus();
  } catch {preview.close();setState('failed');}
 }
 if(!token)return null;
 return <section className={s.export} aria-label={e.export}><label>{e.format}<select value={format} onChange={event=>setFormat(event.target.value as ExportFormat)}><option value="summary">{e.summary}</option><option value="full">{e.full}</option></select></label>
 <button type="button" onClick={prepare} disabled={state==='busy'}>{state==='busy'?e.busy:e.export}</button><p role="status" aria-live="polite">{state==='ready'?e.ready:state==='failed'?e.failed:''}</p></section>;
}
