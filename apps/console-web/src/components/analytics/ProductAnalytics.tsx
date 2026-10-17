'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from '@/components/LocalizedLink';
import { useLang } from '@/lib/i18n/LangContext';
import { publicRoute, type ProductEvent } from '@/lib/analytics/contract';
import s from './ProductAnalytics.module.scss';
import TrafficAnalytics from './TrafficAnalytics';
export default function ProductAnalytics() {
    const { lang } = useLang();
    const path = usePathname();
    const [state, setState] = useState<{
        enabled: boolean;
        choice: string;
    }>({ enabled: false, choice: 'unset' });
    const [settings, setSettings] = useState(false);
    const [traffic, setTraffic] = useState({enabled:false,choice:'unset'});
    const [custom, setCustom] = useState(false), [productChoice, setProductChoice] = useState(false), [trafficChoice, setTrafficChoice] = useState(false);
    const [busy, setBusy] = useState(false), [error, setError] = useState(false);
    const seen = useRef('');
    const reportSeen = useRef('');
    const fr = lang === 'fr';
    useEffect(() => {
        let active=true;
        const load=()=>{for(const [url,setter] of [['/api/product-analytics/consent',setState],['/api/traffic/consent',setTraffic]] as const)void fetch(url,{cache:'no-store',referrerPolicy:'no-referrer'}).then(r=>r.json()).then(v=>{if(active)setter(v);}).catch(()=>{});};
        load();
        const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('argos-measurement'):null;
        if(channel)channel.onmessage=load;
        window.addEventListener('focus',load);
        return()=>{active=false;channel?.close();window.removeEventListener('focus',load);};
    }, []);
    async function choose(product:boolean,audience:boolean) {
        setBusy(true);setError(false);setSettings(true);
        // Stop future client collection immediately on withdrawal, including a failed save.
        if(!product)setState(v=>({...v,choice:'refused'}));
        if(!audience)setTraffic(v=>({...v,choice:'refused'}));
        try {
            let failed=false;
            for(const [url,granted,setter] of [['/api/product-analytics/consent',product,setState],['/api/traffic/consent',audience,setTraffic]] as const){
                const choice=granted?'granted':'refused';
                try {
                    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({choice}),referrerPolicy:'no-referrer'});
                    if(!response.ok)throw new Error('Choice unavailable');
                    setter(v=>({...v,choice}));
                }catch{failed=true;}
            }
            if(failed)throw new Error('Choice unavailable');
            setSettings(false);setCustom(false);
            if(!product){seen.current='';reportSeen.current='';}
            if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel('argos-measurement');channel.postMessage('changed');channel.close();}
        }catch{setError(true);}finally{setBusy(false);}
    }
    useEffect(() => {
        if (!state.enabled || state.choice !== 'granted')
            return;
        const route = publicRoute(path);
        const registration = /^\/(?:en\/)?account\/register$/.test(path);
        const send = (event: ProductEvent) => { void fetch('/api/product-analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event), keepalive: true, referrerPolicy: 'no-referrer' }).catch(() => { }); };
        if (registration && seen.current !== path) {
            seen.current = path;
            send({ event: 'account_registration_view', dimensions: { route: '/account/register', lang, placement: 'page' } });
        }
        if (route && seen.current !== path) {
            seen.current = path;
            send({ event: 'public_page_view', dimensions: { route, lang, placement: 'page' } });
            if (route === '/exemple-rapport')
                send({ event: 'example_open', dimensions: { route, lang, placement: 'page' } });
        }
        if (!route && !registration) seen.current = path;
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
    if (!state.enabled && !traffic.enabled)
        return null;
    const needsChoice=state.enabled&&state.choice==='unset'||traffic.enabled&&traffic.choice==='unset';
    return <><TrafficAnalytics granted={traffic.enabled&&traffic.choice==='granted'}/>
      {!needsChoice&&!settings ? <button className={s.settings} onClick={()=>{setProductChoice(state.choice==='granted');setTrafficChoice(traffic.choice==='granted');setSettings(true);}}>{fr?'Gérer mes cookies':'Manage cookies'}</button> :
      <aside className={s.banner} aria-label={fr?'Préférences de mesure':'Measurement preferences'}>
        <p>{fr?'Argos propose deux mesures facultatives : la fréquentation des pages publiques et l’utilisation du produit (clics et étapes d’audit). Compteurs internes conservés 90 jours, cookies de session, aucun fournisseur tiers, nom, email, URL auditée ni contenu de rapport. Après accord, des références de compte restent internes pour dédupliquer inscriptions, rattachements et retours. Refuser reste sans effet sur les analyses.':'Argos offers two optional measurements: public page traffic and product usage (clicks and audit steps). Internal counters retained for 90 days, session cookies, no third-party provider, name, email, audited URL or report content. With consent, account references remain internal to deduplicate registrations, report claims and returns. Refusal does not affect analyses.'}</p>
        <Link href="/confidentialite">{fr?'Confidentialité':'Privacy information'}</Link>
        {custom&&<fieldset><legend>{fr?'Finalités facultatives':'Optional purposes'}</legend>{traffic.enabled&&<label><input type="checkbox" checked={trafficChoice} onChange={e=>setTrafficChoice(e.target.checked)}/>{fr?'Mesure de fréquentation':'Traffic measurement'}</label>}{state.enabled&&<label><input type="checkbox" checked={productChoice} onChange={e=>setProductChoice(e.target.checked)}/>{fr?'Mesure produit':'Product measurement'}</label>}</fieldset>}
        {error&&<p role="alert">{fr?'Choix non enregistré. Réessayez.':'Choice could not be saved. Try again.'}</p>}
        <div><button disabled={busy} onClick={()=>void choose(false,false)}>{fr?'Tout refuser / retirer':'Reject all / withdraw'}</button><button disabled={busy} onClick={()=>void choose(true,true)}>{fr?'Tout accepter':'Accept all'}</button><button disabled={busy} onClick={()=>setCustom(true)}>{fr?'Personnaliser':'Customise'}</button>{custom&&<button disabled={busy} onClick={()=>void choose(productChoice,trafficChoice)}>{fr?'Enregistrer mes choix':'Save choices'}</button>}</div>
      </aside>}
    </>;
}
