"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import s from './page.module.scss';
type Counts = {
    accepted: number;
    started: number;
    completed: number;
    failed: number;
    pending: number;
    viewed: number;
    completedViewed: number;
};
type Delay = {
    sample: number;
    excluded: number;
    medianMs: number | null;
    p90Ms: number | null;
    p95Ms: number | null;
};
type Metrics = {
    enabled: boolean;
    capped: boolean;
    from: string;
    until: string;
    cohort: Counts;
    bySource: {
        route: string;
        lang: string;
        placement: string;
        counts: Counts;
    }[];
    queue: Delay;
    processing: Delay;
    endToEnd: Delay;
    events: {
        event: string;
        route: string;
        lang: string;
        placement: string;
        error: string;
        count: number;
    }[];
};
export default function Analytics() {
    const [days, setDays] = useState(30);
    const [data, setData] = useState<Metrics>();
    const [error, setError] = useState(false);
    useEffect(() => { const controller = new AbortController(); fetch('/api/product-analytics/metrics?days=' + days, { cache: 'no-store', signal: controller.signal }).then(async (response) => { if (!response.ok)
        throw new Error(); setData(await response.json()); }).catch(() => { if (!controller.signal.aborted)
        setError(true); }); return () => controller.abort(); }, [days]);
    const ms = (v: number | null) => v === null ? 'Indisponible' : (v / 1000).toFixed(1) + ' s';
    return <main className={s.main}><Link href="/dashboard">Retour au dashboard</Link><h1>Mesure produit</h1><p>Uniquement les audits créés après accord explicite. Une ligne correspond à un run, jamais à une personne. Les états sont actualisés ; les cohortes récentes restent incomplètes.</p><label htmlFor="period">Période glissante UTC</label> <select id="period" value={days} onChange={e => {setError(false);setData(undefined);setDays(Number(e.target.value));}}>{[7, 30, 90].map(n => <option key={n} value={n}>{n} jours</option>)}</select>{error ? <p role="alert">Métriques indisponibles. Vérifiez la session administrateur et le backend.</p> : !data ? <p role="status">Chargement…</p> : <><p>Collecte {data.enabled ? 'autorisée côté backend' : 'désactivée côté backend'} · {data.from} → {data.until}</p>{data.capped && <p role="status">Échantillon limité aux 100 000 runs les plus anciens de cette période.</p>}<h2>Cohorte des audits consentis</h2><dl>{Object.entries(data.cohort).map(([key, value]) => <div key={key}><dt>{({ accepted: 'Créés', started: 'Démarrés', completed: 'Terminés', failed: 'Échoués', pending: 'En attente / en cours', viewed: 'Rapports affichés', completedViewed: 'Terminés et affichés' } as Record<string, string>)[key]}</dt><dd>{value}</dd></div>)}</dl><p>Les rapports affichés sont dédupliqués par run, même après un rafraîchissement. Aucune conversion visite → rapport ni amélioration causale n’est déduite.</p><h2>Délais</h2><div className={s.scroll}><table><thead><tr><th>Mesure</th><th>Échantillon</th><th>Exclus</th><th>Médiane</th><th>p90</th><th>p95</th></tr></thead><tbody>{[['File', data.queue], ['Traitement', data.processing], ['Création → fin', data.endToEnd]].map(([label, d]) => { const delay = d as Delay; return <tr key={String(label)}><th>{String(label)}</th><td>{delay.sample}</td><td>{delay.excluded}</td><td>{ms(delay.medianMs)}</td><td>{ms(delay.p90Ms)}</td><td>{ms(delay.p95Ms)}</td></tr>; })}</tbody></table></div><p>Traitement et création → fin : uniquement les runs terminés. Dates absentes ou inversées exclues. Percentiles par rang le plus proche, sans interpolation.</p><h2>Sources</h2><div className={s.scroll}><table><thead><tr><th>Page / langue / emplacement</th><th>Créés</th><th>Terminés</th><th>Échoués</th><th>Affichés</th></tr></thead><tbody>{data.bySource.map(row => <tr key={row.route + row.lang + row.placement}><th>{row.route} · {row.lang} · {row.placement}</th><td>{row.counts.accepted}</td><td>{row.counts.completed}</td><td>{row.counts.failed}</td><td>{row.counts.viewed}</td></tr>)}</tbody></table></div><h2>Événements publics</h2><p>Compteurs d’affichages et de clics, sans identifiant de visiteur. Jours calendaires UTC couvrant la période demandée, distincts de la cohorte glissante des runs.</p><ul>{data.events.map((row, i) => <li key={i}>{row.event} · {row.route} · {row.lang} · {row.placement} · {row.error} : {row.count}</li>)}</ul></>}</main>;
}
