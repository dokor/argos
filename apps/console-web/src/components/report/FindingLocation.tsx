import type { Issue } from './types';
import type { Lang } from '@/lib/i18n/routes';
import { cleanEvidence } from './findingText';

/** Put the measured target beside the finding, including hostname-scoped TLS checks. */
export default function FindingLocation({ issue, pageUrl, lang }: { issue: Issue; pageUrl?: string; lang: Lang }) {
  const fr = lang === 'fr';
  const detail = (key: string) => issue.structuredEvidence?.details?.find(item => item.key === key)?.text;
  const ssl = issue.id?.startsWith('ssl.');
  const policyFindings = detail('policyFindings') ?? '';
  const directives = [...new Set(policyFindings.match(/\b(?:default-src|script-src(?:-elem|-attr)?|style-src(?:-elem|-attr)?|img-src|font-src|connect-src|frame-src|frame-ancestors|object-src|base-uri|form-action|media-src|worker-src)\b/g) ?? [])];
  let host: string | undefined;
  try { if (pageUrl) host = new URL(pageUrl).hostname; } catch { /* Historical URL unavailable. */ }
  const endpoint = detail('selectedEndpoint');
  const safeEndpoint = endpoint && /^[a-zA-Z0-9.:[\]-]{1,253}$/.test(endpoint) ? endpoint : undefined;
  const expiry = Number(detail('notAfterMs'));
  const expiryDate = Number.isSafeInteger(expiry) && expiry > 0 && expiry < 8640000000000000
    ? new Date(expiry).toLocaleDateString(lang, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }) : undefined;
  const phases = [
    ['timeToFirstByte', fr ? 'Réponse du document' : 'Document response'],
    ['resourceLoadDelay', fr ? 'Attente avant transfert' : 'Delay before transfer'],
    ['resourceLoadDuration', fr ? 'Transfert de la ressource' : 'Resource transfer'],
    ['elementRenderDelay', fr ? 'Attente avant affichage' : 'Render delay'],
  ].flatMap(([key,label]) => {
    const value = detail(`lcpPhase.${key}`);
    return value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0 ? [{label,value:Number(value)}] : [];
  });
  return <div data-finding-location>
    {issue.id === 'zap.alert.10055' && <><p><strong>{fr?'En-tête concerné':'Affected header'} :</strong> <code>Content-Security-Policy</code></p>
      {!!directives.length && <p>{fr?'Directives signalées par ZAP':'Directives flagged by ZAP'} : <code>{directives.join(', ')}</code>.</p>}
      {policyFindings.includes('Wildcard Directive') && <p>{fr?'ZAP signale une source trop large ou une directive non définie. Dans les directives citées, examiner notamment les jokers (*) et les autorisations de protocole entier (https:) ; conserver uniquement les origines nécessaires.':'ZAP flags an overly broad source or an undefined directive. In the named directives, inspect wildcards (*) and entire-scheme permissions (https:); retain only required origins.'}</p>}
      {policyFindings.includes('unsafe-inline') && <p>{fr?'ZAP signale notamment une autorisation de contenu inline (unsafe-inline). Examiner la directive concernée avant de modifier cette permission.':'ZAP specifically flags permission for inline content (unsafe-inline). Inspect the affected directive before changing this permission.'}</p>}
      {!!policyFindings && !directives.length && <p>{cleanEvidence(policyFindings)}</p>}</>}
    {issue.id === 'zap.alert.10037' && <p><strong>{fr?'En-tête concerné':'Affected header'} :</strong> <code>X-Powered-By</code></p>}
    {ssl ? <>
      {host && <p><strong>{fr ? 'Hôte TLS concerné' : 'Affected TLS host'} :</strong> <code>{host}:443</code></p>}
      {safeEndpoint && <p><strong>{fr ? 'Serveur retenu par SSL Labs' : 'Endpoint selected by SSL Labs'} :</strong> <code>{safeEndpoint}</code></p>}
      {expiryDate && <p><strong>{fr ? 'Expiration du certificat (UTC)' : 'Certificate expiry (UTC)'} :</strong> {expiryDate}</p>}
      {safeEndpoint && <p>{fr ? 'Sur cet hôte et ce serveur, vérifier le certificat présenté avec le nom de domaine (SNI), puis intervenir sur sa terminaison TLS : CDN, reverse proxy ou serveur web.' : 'For this host and endpoint, check the certificate presented with the domain name (SNI), then update its TLS termination: CDN, reverse proxy or web server.'}</p>}
    </> : pageUrl && <p><strong>{fr ? 'Page analysée' : 'Analysed page'} :</strong> <code>{cleanEvidence(pageUrl)}</code></p>}
    {detail('relatedAudit') === 'lcp-breakdown-insight' && <p>{fr ? 'L’élément ci-dessous provient de la décomposition LCP du même passage Lighthouse.' : 'The element below comes from the LCP breakdown in the same Lighthouse run.'}</p>}
    {!!phases.length && <><p><strong>{fr ? 'Phases LCP observées' : 'Observed LCP phases'}</strong> — {fr ? 'Chronologie observée, distincte de la durée simulée ci-dessus.' : 'Observed timeline, separate from the simulated duration above.'}</p><ul>{phases.map(phase=><li key={phase.label}>{phase.label} : {phase.value.toLocaleString(lang,{maximumFractionDigits:1})} ms</li>)}</ul></>}
    {detail('relatedAudit') === 'long-tasks' && <p>{fr ? 'Les ressources ci-dessous sont associées aux tâches longues du même passage Lighthouse. Leurs durées ne sont pas des économies garanties.' : 'The resources below are associated with long tasks from the same Lighthouse run. Their durations are not guaranteed savings.'}</p>}
  </div>;
}
