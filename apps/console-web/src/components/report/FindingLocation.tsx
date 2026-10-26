import type { Issue } from './types';
import type { Lang } from '@/lib/i18n/routes';
import { cleanEvidence } from './findingText';
import { headerTargets, documentTargets, isPageTiming } from './findingTargets';

/** Put the measured target beside the finding, including hostname-scoped TLS checks. */
export default function FindingLocation({ issue, pageUrl, lang }: { issue: Issue; pageUrl?: string; lang: Lang }) {
  const fr = lang === 'fr';
  const detail = (key: string) => issue.structuredEvidence?.details?.find(item => item.key === key)?.text;
  const ssl = issue.id?.startsWith('ssl.');
  const observatory = issue.id === 'observatory.score';
  const header = headerTargets[issue.id??''] ?? (/^[a-zA-Z][a-zA-Z0-9-]{0,79}$/.test(detail('responseHeader')??'') ? detail('responseHeader') : undefined);
  const documentTarget = documentTargets[issue.id??''];
  const cookieIssues = (detail('cookieIssues')??'').split(';').filter(part=>/^\d{1,5}:(?:Secure)?(?: HttpOnly)?$/.test(part));
  const cookieIndexes = (detail('cookieIndexes')??'').match(/\b[1-9][0-9]{0,4}\b/g)??[];
  const weakSuites = (detail('weakCipherSuites')??'').match(/\bTLS_[A-Z0-9_]{1,100}\b/g)??[];
  const legacyProtocols = issue.id==='ssl.protocols.legacy_disabled' ? (detail('protocols')??'').match(/\b(?:TLS 1\.[01]|SSL [23]\.0)\b/g)??[] : [];
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
    {isPageTiming(issue.id)&&<p>{fr?'Cette durée décrit l’affichage de la page entière. Elle n’identifie pas une cause unique : examiner les constats de ressources bloquantes, de chaîne réseau et de LCP de ce même rapport avant de modifier le chargement.':'This duration describes the whole page’s rendering. It identifies no single cause: inspect this report’s blocking-resource, network-chain and LCP findings before changing loading behaviour.'}</p>}
    {header && <p><strong>{fr?'En-tête concerné':'Affected header'} :</strong> <code>{header}</code> — {fr?'réponse du document dans Réseau':'document response in Network'}.</p>}
    {documentTarget && <p><strong>{fr?'Emplacement dans le document':'Document location'} :</strong> <code>{documentTarget}</code>. {fr?'Examiner le HTML reçu ; si la balise manque, la correction se fait dans le modèle qui génère cette page.':'Inspect the received HTML; if the element is absent, change the template generating this page.'}</p>}
    {!!cookieIssues.length && <ul>{cookieIssues.map(value=><li key={value}><code>Set-Cookie #{value.split(':')[0]}</code> : {fr?'attributs absents':'missing attributes'} <code>{value.split(':')[1].trim()}</code></li>)}</ul>}
    {!!cookieIndexes.length && <p>{fr?'Occurrences dans les en-têtes de la réponse collectée':'Entries in the collected response headers'} : {cookieIndexes.map(index=>`Set-Cookie #${index}`).join(', ')}.</p>}
    {(cookieIssues.length>0||cookieIndexes.length>0) && <p>{fr?'Comparer l’ordre des en-têtes Set-Cookie de cette réponse, pas l’ordre de la liste des cookies stockés. Modifier les options qui produisent ce cookie ; aucune valeur de session n’est conservée ici.':'Compare Set-Cookie header order in this response, not the stored-cookie list order. Change the options producing that cookie; no session value is retained here.'}</p>}
    {/^[1-9][0-9]{0,7}$/.test(detail('responseBodyLine')??'') && <p><strong>{fr?'Emplacement dans la réponse HTML':'Location in the HTML response'} :</strong> {fr?'ligne':'line'} {detail('responseBodyLine')}, {fr?'colonne':'column'} {detail('responseBodyColumn')}. {fr?'Ouvrir la réponse originale dans Réseau/Sources, sans reformater le code. Le contenu sensible de la preuve reste masqué.':'Open the original response in Network/Sources without pretty-printing. Sensitive evidence contents remain hidden.'}</p>}
    {issue.id === 'tech.security.version_disclosure' && detail('exposed') && <p>{fr?'Bannière de version observée':'Observed version banner'} : <code>{cleanEvidence(detail('exposed'))}</code>. {fr?'Modifier la configuration qui émet cet en-tête ; masquer une version ne remplace pas sa mise à jour.':'Change the configuration emitting this header; hiding a version does not replace updating it.'}</p>}
    {issue.id === 'http.protocol.http2' && <p>{fr?'Protocole négocié pour cette réponse':'Protocol negotiated for this response'} : <code>{detail('httpVersion')}</code>. {fr?'Vérifier HTTP/2 et ALPN sur le serveur ou CDN qui répond à cette URL.':'Check HTTP/2 and ALPN on the server or CDN answering this URL.'}</p>}
    {detail('probePath') && <p>{fr?'Ressource SEO interrogée':'Requested SEO resource'} : <code>{detail('probeOrigin')}{detail('probePath')}</code> — HTTP {detail('status')}. {fr?'Vérifier le contenu retourné à cette adresse.':'Check the content returned at this address.'}</p>}
    {issue.id === 'zap.alert.10055' && <><p><strong>{fr?'En-tête concerné':'Affected header'} :</strong> <code>Content-Security-Policy</code></p>
      {!!directives.length && <p>{fr?'Directives signalées par ZAP':'Directives flagged by ZAP'} : <code>{directives.join(', ')}</code>.</p>}
      {policyFindings.includes('Wildcard Directive') && <p>{fr?'ZAP signale une source trop large ou une directive non définie. Dans les directives citées, examiner notamment les jokers (*) et les autorisations de protocole entier (https:) ; conserver uniquement les origines nécessaires.':'ZAP flags an overly broad source or an undefined directive. In the named directives, inspect wildcards (*) and entire-scheme permissions (https:); retain only required origins.'}</p>}
      {policyFindings.includes('unsafe-inline') && <p>{fr?'ZAP signale notamment une autorisation de contenu inline (unsafe-inline). Examiner la directive concernée avant de modifier cette permission.':'ZAP specifically flags permission for inline content (unsafe-inline). Inspect the affected directive before changing this permission.'}</p>}
      {!!policyFindings && !directives.length && <p>{cleanEvidence(policyFindings)}</p>}</>}
    {observatory && host && <><p><strong>{fr?'Périmètre Observatory':'Observatory scope'} :</strong> <code>http://{host}/</code>. {fr?'Ce scan commence à la racine de l’hôte et suit ses redirections ; il ne mesure pas spécifiquement le chemin de cette fiche.':'This scan starts at the host root and follows its redirects; it does not specifically measure this finding’s page path.'}</p><p><a href={`https://developer.mozilla.org/en-US/observatory/analyze?host=${encodeURIComponent(host)}`} target="_blank" rel="noreferrer">{fr?'Ouvrir le diagnostic de cet hôte':'Open this host’s diagnosis'}</a></p></>}
    {ssl ? <>
      {host && <p><strong>{fr ? 'Hôte TLS concerné' : 'Affected TLS host'} :</strong> <code>{host}:443</code></p>}
      {safeEndpoint && <p><strong>{fr ? 'Serveur retenu par SSL Labs' : 'Endpoint selected by SSL Labs'} :</strong> <code>{safeEndpoint}</code></p>}
      {expiryDate && <p><strong>{fr ? 'Expiration du certificat (UTC)' : 'Certificate expiry (UTC)'} :</strong> {expiryDate}</p>}
      {!!legacyProtocols.length&&<p><strong>{fr?'Protocoles historiques activés':'Enabled legacy protocols'} :</strong> <code>{legacyProtocols.join(', ')}</code></p>}
      {safeEndpoint && <p>{fr ? 'Sur cet hôte et ce serveur, vérifier le certificat présenté avec le nom de domaine (SNI), puis intervenir sur sa terminaison TLS : CDN, reverse proxy ou serveur web.' : 'For this host and endpoint, check the certificate presented with the domain name (SNI), then update its TLS termination: CDN, reverse proxy or web server.'}</p>}
      {!!weakSuites.length && <><p><strong>{fr?'Suites classées faibles ou non sûres par SSL Labs':'Suites flagged as weak or insecure by SSL Labs'}</strong></p><ul>{weakSuites.map(suite=><li key={suite}><code>{suite}</code></li>)}</ul></>}
    </> : !observatory && pageUrl && <p><strong>{fr ? 'Page analysée' : 'Analysed page'} :</strong> <code>{cleanEvidence(pageUrl)}</code></p>}
    {detail('relatedAudit') === 'lcp-breakdown-insight' && <p>{fr ? 'L’élément ci-dessous provient de la décomposition LCP du même passage Lighthouse.' : 'The element below comes from the LCP breakdown in the same Lighthouse run.'}</p>}
    {!!phases.length && <><p><strong>{fr ? 'Phases LCP observées' : 'Observed LCP phases'}</strong> — {fr ? 'Chronologie observée, distincte de la durée simulée ci-dessus.' : 'Observed timeline, separate from the simulated duration above.'}</p><ul>{phases.map(phase=><li key={phase.label}>{phase.label} : {phase.value.toLocaleString(lang,{maximumFractionDigits:1})} ms</li>)}</ul></>}
    {detail('relatedAudit') === 'long-tasks' && <p>{fr ? 'Les ressources ci-dessous sont associées aux tâches longues du même passage Lighthouse. Leurs durées ne sont pas des économies garanties.' : 'The resources below are associated with long tasks from the same Lighthouse run. Their durations are not guaranteed savings.'}</p>}
  </div>;
}
