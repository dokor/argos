'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLang } from '@/lib/i18n/LangContext';
import { publicRoute, type ProductEvent } from '@/lib/analytics/contract';
import s from './ProductAnalytics.module.scss';
export default function ProductAnalytics() {
    const { lang } = useLang();
    const path = usePathname();
    const [state, setState] = useState<{
        enabled: boolean;
        choice: string;
    }>({ enabled: false, choice: 'unset' });
    const [settings, setSettings] = useState(false);
    const seen = useRef('');
    const reportSeen = useRef('');
    const fr = lang === 'fr';
    useEffect(() => { let active = true; fetch('/api/product-analytics/consent', { cache: 'no-store', referrerPolicy: 'no-referrer' }).then(r => r.json()).then(v => { if (active)
        setState(v); }).catch(() => { }); return () => { active = false; }; }, []);
    async function choose(choice: string) { try {
        const r = await fetch('/api/product-analytics/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice }), referrerPolicy: 'no-referrer' });
        if (r.ok) {
            setState(previous => ({ ...previous, choice }));
            setSettings(false);
            if (choice === 'refused') {
                seen.current = '';
                reportSeen.current = '';
            }
        }
    }
    catch { } }
    useEffect(() => {
        if (!state.enabled || state.choice !== 'granted')
            return;
        const route = publicRoute(path);
        const send = (event: ProductEvent) => { void fetch('/api/product-analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event), keepalive: true, referrerPolicy: 'no-referrer' }).catch(() => { }); };
        if (route && seen.current !== path) {
            seen.current = path;
            send({ event: 'public_page_view', dimensions: { route, lang, placement: 'page' } });
            if (route === '/exemple-rapport')
                send({ event: 'example_open', dimensions: { route, lang, placement: 'page' } });
        }
        const click = (event: MouseEvent) => { if (!route || !(event.target instanceof Element))
            return; const a = event.target.closest('a'); if (!a)
            return; const href = new URL(a.href, location.origin); if (href.origin !== location.origin)
            return; if (href.hash !== '#audit')
            return; const placement = a.closest('nav') ? 'nav' : a.closest('footer') ? 'footer' : 'hero'; send({ event: 'audit_cta_click', dimensions: { route, lang, placement } }); };
        const report = () => { if (!/^\/(?:en\/)?report\/[A-Za-z0-9_-]+$/.test(path) || reportSeen.current === path)
            return; reportSeen.current = path; const token = path.split('/').at(-1); void fetch('/api/reports/' + token, { headers: { 'X-Argos-Report-View': '1' }, cache: 'no-store', referrerPolicy: 'no-referrer' }).catch(() => { }); };
        document.addEventListener('click', click);
        window.addEventListener('argos-report-displayed', report);
        if (document.getElementById('report-domain'))
            report();
        return () => { document.removeEventListener('click', click); window.removeEventListener('argos-report-displayed', report); };
    }, [path, lang, state]);
    if (!state.enabled)
        return null;
    if (state.choice !== 'unset' && !settings)
        return <button className={s.settings} onClick={() => setSettings(true)}>{fr ? 'Préférences de mesure' : 'Measurement preferences'}</button>;
    return <aside className={s.banner} aria-label={fr ? 'Mesure d’utilisation' : 'Usage measurement'}><p>{fr ? 'Autoriser une mesure interne de l’utilisation ? Elle compte les pages, clics et étapes d’audit, sans URL auditée ni contenu de rapport. Conservation : 90 jours. Vous pouvez refuser ou retirer votre accord ; l’audit reste disponible.' : 'Allow internal usage measurement? It counts pages, clicks and audit steps, without audited URLs or report content. Retention: 90 days. You may refuse or withdraw consent; the audit remains available.'}</p><a href="/confidentialite">{fr ? 'Confidentialité' : 'Privacy information (French)'}</a><div><button onClick={() => choose('refused')}>{fr ? 'Refuser / retirer' : 'Refuse / withdraw'}</button><button onClick={() => choose('granted')}>{fr ? 'Autoriser' : 'Allow'}</button></div></aside>;
}
