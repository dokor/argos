"use client";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { DataTable, EmptyState, KpiCard, PageHeading, StatusBadge } from "./Primitives";
import s from "./Connected.module.scss";
export type PreviewFixture = {
  expected: { priorityUrls: number; incompleteUrls: number; trackedUrls: number };
  usage: { expectedAvailable: number };
  domains: { pages: { id: string; url: string; completeness: string; executionStatus: string; score: number | null }[] }[];
};
/** Only mounted by the opt-in development route. Never a production dashboard. */
export default function FoundationPreview({ fixture }: { fixture: PreviewFixture }) {
  const { t, lang } = useLang(), c = t.connected;
  const number = (n: number) => new Intl.NumberFormat(lang).format(n);
  return <><p className={s.previewNotice}>{c.preview}</p><main className={s.page}>
    <PageHeading title={c.overview} description={c.previewIntro} action={<Link href="/account/sites" className={s.primary}>{c.explore}</Link>}/>
    <div className={s.kpis}>
      <KpiCard label={c.priority} value={number(fixture.expected.priorityUrls)} detail={`${number(fixture.expected.trackedUrls)} ${c.tracked}`}/>
      <KpiCard label={c.incomplete} value={number(fixture.expected.incompleteUrls)} detail={c.previewKpiHint}/>
      <KpiCard label={c.credits} value={number(fixture.usage.expectedAvailable)} detail={c.previewKpiHint}/>
    </div>
    <DataTable caption={c.recent} columns={[c.page, c.status, c.score]}>{[...fixture.domains[0].pages.slice(0, 2), ...fixture.domains[0].pages.slice(-2)].map(page => <tr key={page.id}>
      <td>{page.url}</td><td><StatusBadge tone={page.executionStatus === "FAILED" ? "danger" : page.completeness === "FULL" ? "success" : "warning"}>{page.executionStatus === "FAILED" ? c.failed : page.completeness === "FULL" ? c.full : c.partial}</StatusBadge></td>
      <td>{page.score === null ? c.unavailable : number(page.score) + "/100"}</td>
    </tr>)}</DataTable>
    <div className={`${s.twoColumns} ${s.previewStates}`}><EmptyState title={c.emptyTitle} description={c.emptyDescription}/><EmptyState title={c.errorTitle} description={c.previewError} kind="error"/></div>
  </main></>;
}
