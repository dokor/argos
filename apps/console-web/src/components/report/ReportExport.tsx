"use client";
import ReportActionIcon from "./ReportActionIcon";
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
import type {Report} from './types';
import {accountFetch} from '@/lib/account-client';
export default function ReportExport({report:current,runId,shared=false,compact=false}:{report?:Report;runId?:string;shared?:boolean;compact?:boolean}={}) {
 const {lang}=useLang();const e=exportCopy[lang];const path=usePathname();const token=path?.match(/^\/(?:en\/)?(?:report|share)\/([A-Za-z0-9_-]+)$/)?.[1];
 const [format,setFormat]=useState<ExportFormat>('summary');const [state,setState]=useState<'idle'|'busy'|'ready'|'failed'>('idle');
 async function prepare() {
  setState('busy');const preview=window.open('about:blank','_blank');
  if(!preview){setState('failed');return;} preview.opener=null; preview.document.title='Argos';preview.document.body.textContent=e.busy;
  try {
   let report:Report;
   if(runId) report=await accountFetch<Report>(`runs/${runId}/report`);
   else if(current&&current.access!=='summary') report=await accountFetch<Report>((shared?'shared-reports/':'reports/')+token);
   else if(shared){const response=await fetch('/api/reports/shared/'+token,{cache:'no-store'});if(!response.ok)throw new Error('Unavailable');report=await response.json();}
   else report=await loadExportReport(token!);
   if(preview.closed)throw new Error('Closed');
   const allowedFormat=report.access==='summary'?'summary':format;
   preview.document.documentElement.lang=lang;preview.document.documentElement.dataset.theme='light';preview.document.title=exportTitle(allowedFormat,report.generatedAt);
   const base=preview.document.createElement('base');base.href=window.location.origin+'/';preview.document.head.append(base);
   const robots=preview.document.createElement('meta');robots.name='robots';robots.content='noindex, nofollow';preview.document.head.append(robots);
   const loading:Promise<void>[]=[];
   document.querySelectorAll('style,link[rel="stylesheet"]').forEach(node=>{
    const clone=node.cloneNode(true) as HTMLElement;
    if(clone instanceof HTMLLinkElement){loading.push(new Promise((resolve,reject)=>{clone.onload=()=>resolve();clone.onerror=()=>reject(new Error('Styles unavailable'));}));}
    preview.document.head.append(clone);
   });
   const host=preview.document.createElement('div');preview.document.body.replaceChildren(host);
   const root=createRoot(host);flushSync(()=>root.render(<><div className={printStyle.toolbar}><button onClick={()=>preview.print()}>{e.print}</button><button onClick={()=>preview.close()}>{e.close}</button><p>{e.ready}</p></div><PrintableReport report={report} lang={lang} format={allowedFormat}/></>));
   await Promise.all(loading);await preview.document.fonts.ready;setState('ready');preview.focus();
  } catch {preview.close();setState('failed');}
 }
 if(!token&&!current)return null;
 const form=<section className={s.export} aria-label={e.export}><label>{e.format}<select value={current?.access==='summary'?'summary':format} onChange={event=>setFormat(event.target.value as ExportFormat)}><option value="summary">{e.summary}</option>{current?.access!=='summary'&&<option value="full">{e.full}</option>}</select></label>
 <button type="button" onClick={prepare} disabled={state==='busy'}><ReportActionIcon name="download"/>{state==='busy'?e.busy:e.export}</button><p role="status" aria-live="polite">{state==='ready'?e.ready:state==='failed'?e.failed:''}</p></section>;
 return compact?<details className={s.compact}><summary><ReportActionIcon name="download"/>{e.export}</summary>{form}</details>:form;
}
