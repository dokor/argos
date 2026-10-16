"use client";
import Link from "@/components/LocalizedLink";
import type { Discovery, BatchProgress } from "@/lib/connected/contracts";
import { batchPath } from "@/lib/connected/domain-navigation";
import { useDomainResource, followPages } from "./useDomainResource";
import { useDomainText, State, DomainError } from "./DomainUi";
import d from "./Domains.module.scss";

export default function DomainTasks({ domainId }: { domainId?: string }) {
  const { c } = useDomainText();
  const discoveries = useDomainResource<Discovery[]>("domain-discoveries", followPages);
  const batches = useDomainResource<BatchProgress[]>("domain-batches", followPages);
  const visible = (item: { domainId: string }) => !domainId || item.domainId === domainId;
  const ds = discoveries.data?.filter(visible) ?? [], bs = batches.data?.filter(visible) ?? [];
  return <section aria-label={c.tasks}>
    {discoveries.error && <DomainError code={discoveries.error} retry={discoveries.reload}/>}
    {batches.error && <DomainError code={batches.error} retry={batches.reload}/>}
    {(ds.length > 0 || bs.length > 0) && <h2 className={d.taskTitle}>{c.tasks}</h2>}
    {ds.map(item => <div className={d.notice} key={item.id}><p>{c.activeDiscovery}: {item.hostname} · {item.status === "COMPLETED" ? c.readySelection : <State value={item.status}/>} · {c.eligible}: {item.eligibleCount} · {c.excluded}: {item.excludedCount}</p>
      <Link className={d.link} href={`/account/domains/new?discovery=${item.id}`}>{c.resumeDiscovery}</Link></div>)}
    {bs.map(item => <div className={d.notice} key={item.id}><p>{c.activeBatch}: {item.hostname} <State value={item.status}/></p>
      <Link className={d.link} href={batchPath(item.domainId,item.id)}>{c.resumeBatch}</Link></div>)}
  </section>;
}
