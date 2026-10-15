"use client";
import type {ReactNode} from "react";
import type {Report} from "@/components/report/types";
import ReportPage from "@/app/(fr)/report/[token]/ReportPage";
import RunContext,{type PersonalRun} from "@/components/connected/RunContext";
import {useLang} from "@/lib/i18n/LangContext";
import s from "./PrivateDiagnostic.module.scss";
export default function PrivateDiagnostic({report,run,runId,actions}:{report:Report;run:PersonalRun;runId:string;actions:ReactNode}) {
  const {lang}=useLang();
  return <><ReportPage params={{report}} embedded runId={runId} feedbackReference={{runId}} workspaceActions={actions}/>
    <details className={s.secondary}><summary>{lang==="fr"?"Contexte de la mesure":"Measurement context"}</summary><RunContext run={run} runId={runId} complete/></details></>;
}
