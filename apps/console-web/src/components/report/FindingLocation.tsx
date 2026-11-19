import { intlLocale } from "@/lib/i18n/locales";
import { localizeValue } from "@/lib/i18n/messages";
import type { Issue } from './types';
import type { Lang } from '@/lib/i18n/routes';
import { cleanEvidence } from './findingText';
import { headerTargets, documentTargets, pageTargets, isPageTiming } from './findingTargets';

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
  const responseLocations=(detail('responseBodyLocations')??'').split(',').filter(value=>/^[1-9][0-9]{0,7}:[1-9][0-9]{0,7}$/.test(value)).slice(0,10);
  const responseHeaders=(detail('responseHeaders')??'').split(',').filter(value=>/^[a-zA-Z][a-zA-Z0-9-]{0,79}$/.test(value)).slice(0,10);
  const legacyProtocols = issue.id==='ssl.protocols.legacy_disabled' ? (detail('protocols')??'').match(/\b(?:TLS 1\.[01]|SSL [23]\.0)\b/g)??[] : [];
  const policyFindings = detail('policyFindings') ?? '';
  const directives = [...new Set(policyFindings.match(/\b(?:default-src|script-src(?:-elem|-attr)?|style-src(?:-elem|-attr)?|img-src|font-src|connect-src|frame-src|frame-ancestors|object-src|base-uri|form-action|media-src|worker-src)\b/g) ?? [])];
  let host: string | undefined;
  try { if (pageUrl) host = new URL(pageUrl).hostname; } catch { /* Historical URL unavailable. */ }
  const endpoint = detail('selectedEndpoint');
  const safeEndpoint = endpoint && /^[a-zA-Z0-9.:[\]-]{1,253}$/.test(endpoint) ? endpoint : undefined;
  const expiry = Number(detail('notAfterMs'));
  const expiryDate = Number.isSafeInteger(expiry) && expiry > 0 && expiry < 8640000000000000
    ? new Date(expiry).toLocaleDateString(intlLocale(lang), { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }) : undefined;
  const phases = [
    ['timeToFirstByte', (lang === "fr" ? 'Réponse du document' : localizeValue('Document response', lang))],
    ['resourceLoadDelay', (lang === "fr" ? 'Attente avant transfert' : localizeValue('Delay before transfer', lang))],
    ['resourceLoadDuration', (lang === "fr" ? 'Transfert de la ressource' : localizeValue('Resource transfer', lang))],
    ['elementRenderDelay', (lang === "fr" ? 'Attente avant affichage' : localizeValue('Render delay', lang))],
  ].flatMap(([key,label]) => {
    const value = detail(`lcpPhase.${key}`);
    return value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0 ? [{label,value:Number(value)}] : [];
  });
  return <div data-finding-location>
    {detail('diagnosticExplanation')&&<p><strong>{(lang === "fr" ? 'Motif donné par Lighthouse (langue de collecte)' : localizeValue('Lighthouse reason (collection language)', lang))} :</strong> {cleanEvidence(detail('diagnosticExplanation'))}</p>}
    {/^[1-5][0-9]{2}$/.test(detail('statusCode')??'')&&<p><strong>{(lang === "fr" ? 'Statut HTTP observé' : localizeValue('Observed HTTP status', lang))} :</strong> <code>{detail('statusCode')}</code>.</p>}
    {pageTargets[issue.id??'']&&<p><strong>{(lang === "fr" ? 'Où intervenir' : localizeValue('Where to make the change', lang))} :</strong> {localizeValue(pageTargets[issue.id!][fr?0:1], lang)}. {(lang === "fr" ? 'Ce contrôle porte sur cette page ou sa navigation ; il ne désigne pas à lui seul un fichier source unique.' : localizeValue('This check concerns this page or its navigation; it does not by itself identify a single source file.', lang))}</p>}
    {issue.id==='lighthouse.audit.robots-txt'&&host&&<p><strong>{(lang === "fr" ? 'Fichier à examiner' : localizeValue('File to inspect', lang))} :</strong> <code>{new URL('/robots.txt',pageUrl).href}</code>. {(lang === "fr" ? 'Les numéros de ligne ci-dessous concernent ce fichier, pas le HTML de la page.' : localizeValue('The line numbers below refer to this file, not the page HTML.', lang))}</p>}
    {isPageTiming(issue.id)&&<p>{(lang === "fr" ? 'Cette durée décrit l’affichage de la page entière. Elle n’identifie pas une cause unique : examiner les constats de ressources bloquantes, de chaîne réseau et de LCP de ce même rapport avant de modifier le chargement.' : localizeValue('This duration describes the whole page’s rendering. It identifies no single cause: inspect this report’s blocking-resource, network-chain and LCP findings before changing loading behaviour.', lang))}</p>}
    {header && <p><strong>{(lang === "fr" ? 'En-tête concerné' : localizeValue('Affected header', lang))} :</strong> <code>{header}</code> — {(lang === "fr" ? 'réponse du document dans Réseau' : localizeValue('document response in Network', lang))}.</p>}
    {responseHeaders.length>1&&<p>{(lang === "fr" ? 'En-têtes signalés' : localizeValue('Flagged headers', lang))} : <code>{responseHeaders.join(', ')}</code>.</p>}
    {responseLocations.length>1&&<p>{(lang === "fr" ? 'Positions signalées dans la réponse HTML (ligne:colonne)' : localizeValue('Reported HTML response positions (line:column)', lang))} : <code>{responseLocations.join(', ')}</code>. {(lang === "fr" ? 'Examiner chaque occurrence dans la réponse originale ; dix emplacements au plus sont conservés.' : localizeValue('Inspect each occurrence in the original response; at most ten locations are retained.', lang))}</p>}
    {documentTarget && <p><strong>{(lang === "fr" ? 'Emplacement dans le document' : localizeValue('Document location', lang))} :</strong> <code>{documentTarget}</code>. {(lang === "fr" ? 'Examiner le HTML reçu ; si la balise manque, la correction se fait dans le modèle qui génère cette page.' : localizeValue('Inspect the received HTML; if the element is absent, change the template generating this page.', lang))}</p>}
    {!!cookieIssues.length && <ul>{cookieIssues.map(value=><li key={value}><code>Set-Cookie #{value.split(':')[0]}</code> : {(lang === "fr" ? 'attributs absents' : localizeValue('missing attributes', lang))} <code>{value.split(':')[1].trim()}</code></li>)}</ul>}
    {!!cookieIndexes.length && <p>{(lang === "fr" ? 'Occurrences dans les en-têtes de la réponse collectée' : localizeValue('Entries in the collected response headers', lang))} : {cookieIndexes.map(index=>`Set-Cookie #${index}`).join(', ')}.</p>}
    {(cookieIssues.length>0||cookieIndexes.length>0) && <p>{(lang === "fr" ? 'Comparer l’ordre des en-têtes Set-Cookie de cette réponse, pas l’ordre de la liste des cookies stockés. Modifier les options qui produisent ce cookie ; aucune valeur de session n’est conservée ici.' : localizeValue('Compare Set-Cookie header order in this response, not the stored-cookie list order. Change the options producing that cookie; no session value is retained here.', lang))}</p>}
    {/^[1-9][0-9]{0,7}$/.test(detail('responseBodyLine')??'') && <p><strong>{(lang === "fr" ? 'Emplacement dans la réponse HTML' : localizeValue('Location in the HTML response', lang))} :</strong> {(lang === "fr" ? 'ligne' : localizeValue('line', lang))} {detail('responseBodyLine')}, {(lang === "fr" ? 'colonne' : localizeValue('column', lang))} {detail('responseBodyColumn')}. {(lang === "fr" ? 'Ouvrir la réponse originale dans Réseau/Sources, sans reformater le code. Le contenu sensible de la preuve reste masqué.' : localizeValue('Open the original response in Network/Sources without pretty-printing. Sensitive evidence contents remain hidden.', lang))}</p>}
    {issue.id === 'tech.security.version_disclosure' && detail('exposed') && <p>{(lang === "fr" ? 'Bannière de version observée' : localizeValue('Observed version banner', lang))} : <code>{cleanEvidence(detail('exposed'))}</code>. {(lang === "fr" ? 'Modifier la configuration qui émet cet en-tête ; masquer une version ne remplace pas sa mise à jour.' : localizeValue('Change the configuration emitting this header; hiding a version does not replace updating it.', lang))}</p>}
    {issue.id === 'http.protocol.http2' && <p>{(lang === "fr" ? 'Protocole négocié pour cette réponse' : localizeValue('Protocol negotiated for this response', lang))} : <code>{detail('httpVersion')}</code>. {(lang === "fr" ? 'Vérifier HTTP/2 et ALPN sur le serveur ou CDN qui répond à cette URL.' : localizeValue('Check HTTP/2 and ALPN on the server or CDN answering this URL.', lang))}</p>}
    {detail('probePath') && <p>{(lang === "fr" ? 'Ressource SEO interrogée' : localizeValue('Requested SEO resource', lang))} : <code>{detail('probeOrigin')}{detail('probePath')}</code> — HTTP {detail('status')}. {(lang === "fr" ? 'Vérifier le contenu retourné à cette adresse.' : localizeValue('Check the content returned at this address.', lang))}</p>}
    {issue.id === 'zap.alert.10055' && <><p><strong>{(lang === "fr" ? 'En-tête concerné' : localizeValue('Affected header', lang))} :</strong> <code>Content-Security-Policy</code></p>
      {!!directives.length && <p>{(lang === "fr" ? 'Directives signalées par ZAP' : localizeValue('Directives flagged by ZAP', lang))} : <code>{directives.join(', ')}</code>.</p>}
      {policyFindings.includes('Wildcard Directive') && <p>{(lang === "fr" ? 'ZAP signale une source trop large ou une directive non définie. Dans les directives citées, examiner notamment les jokers (*) et les autorisations de protocole entier (https:) ; conserver uniquement les origines nécessaires.' : localizeValue('ZAP flags an overly broad source or an undefined directive. In the named directives, inspect wildcards (*) and entire-scheme permissions (https:); retain only required origins.', lang))}</p>}
      {policyFindings.includes('unsafe-inline') && <p>{(lang === "fr" ? 'ZAP signale notamment une autorisation de contenu inline (unsafe-inline). Examiner la directive concernée avant de modifier cette permission.' : localizeValue('ZAP specifically flags permission for inline content (unsafe-inline). Inspect the affected directive before changing this permission.', lang))}</p>}
      {!!policyFindings && !directives.length && <p>{cleanEvidence(policyFindings)}</p>}</>}
    {observatory && host && <><p><strong>{(lang === "fr" ? 'Périmètre Observatory' : localizeValue('Observatory scope', lang))} :</strong> <code>http://{host}/</code>. {(lang === "fr" ? 'Ce scan commence à la racine de l’hôte et suit ses redirections ; il ne mesure pas spécifiquement le chemin de cette fiche.' : localizeValue('This scan starts at the host root and follows its redirects; it does not specifically measure this finding’s page path.', lang))}</p><p><a href={`https://developer.mozilla.org/en-US/observatory/analyze?host=${encodeURIComponent(host)}`} target="_blank" rel="noreferrer">{(lang === "fr" ? 'Ouvrir le diagnostic de cet hôte' : localizeValue('Open this host’s diagnosis', lang))}</a></p></>}
    {ssl ? <>
      {host && <p><strong>{(lang === "fr" ? 'Hôte TLS concerné' : localizeValue('Affected TLS host', lang))} :</strong> <code>{host}:443</code></p>}
      {safeEndpoint && <p><strong>{(lang === "fr" ? 'Serveur retenu par SSL Labs' : localizeValue('Endpoint selected by SSL Labs', lang))} :</strong> <code>{safeEndpoint}</code></p>}
      {expiryDate && <p><strong>{(lang === "fr" ? 'Expiration du certificat (UTC)' : localizeValue('Certificate expiry (UTC)', lang))} :</strong> {expiryDate}</p>}
      {!!legacyProtocols.length&&<p><strong>{(lang === "fr" ? 'Protocoles historiques activés' : localizeValue('Enabled legacy protocols', lang))} :</strong> <code>{legacyProtocols.join(', ')}</code></p>}
      {safeEndpoint && <p>{(lang === "fr" ? 'Sur cet hôte et ce serveur, vérifier le certificat présenté avec le nom de domaine (SNI), puis intervenir sur sa terminaison TLS : CDN, reverse proxy ou serveur web.' : localizeValue('For this host and endpoint, check the certificate presented with the domain name (SNI), then update its TLS termination: CDN, reverse proxy or web server.', lang))}</p>}
      {!!weakSuites.length && <><p><strong>{(lang === "fr" ? 'Suites classées faibles ou non sûres par SSL Labs' : localizeValue('Suites flagged as weak or insecure by SSL Labs', lang))}</strong></p><ul>{weakSuites.map(suite=><li key={suite}><code>{suite}</code></li>)}</ul></>}
    </> : !observatory && pageUrl && <p><strong>{(lang === "fr" ? 'Page analysée' : localizeValue('Analysed page', lang))} :</strong> <code>{cleanEvidence(pageUrl)}</code></p>}
    {detail('relatedAudit') === 'lcp-breakdown-insight' && <p>{(lang === "fr" ? 'L’élément ci-dessous provient de la décomposition LCP du même passage Lighthouse.' : localizeValue('The element below comes from the LCP breakdown in the same Lighthouse run.', lang))}</p>}
    {!!phases.length && <><p><strong>{(lang === "fr" ? 'Phases LCP observées' : localizeValue('Observed LCP phases', lang))}</strong> — {(lang === "fr" ? 'Chronologie observée, distincte de la durée simulée ci-dessus.' : localizeValue('Observed timeline, separate from the simulated duration above.', lang))}</p><ul>{phases.map(phase=><li key={phase.label}>{phase.label} : {phase.value.toLocaleString(intlLocale(lang),{maximumFractionDigits:1})} ms</li>)}</ul></>}
    {detail('relatedAudit') === 'long-tasks' && <p>{(lang === "fr" ? 'Les ressources ci-dessous sont associées aux tâches longues du même passage Lighthouse. Leurs durées ne sont pas des économies garanties.' : localizeValue('The resources below are associated with long tasks from the same Lighthouse run. Their durations are not guaranteed savings.', lang))}</p>}
    {detail('relatedAudit') === 'cls-culprits-insight' && <p>{(lang === "fr" ? 'Ces éléments et ressources proviennent du diagnostic des déplacements du même passage Lighthouse. Un élément déplacé n’est pas nécessairement la cause : vérifier aussi les insertions, images et polices qui le précèdent.' : localizeValue('These elements and resources come from the layout-shift diagnosis in the same Lighthouse run. A shifted element is not necessarily the cause: also check preceding insertions, images and fonts.', lang))}</p>}
    {detail('relatedAudit') === 'inp-breakdown-insight' && <p>{(lang === "fr" ? 'Cet élément provient de la décomposition de l’interaction du même passage Lighthouse. Rejouer cette interaction dans Performance pour retrouver son gestionnaire.' : localizeValue('This element comes from the interaction breakdown in the same Lighthouse run. Repeat that interaction in Performance to locate its handler.', lang))}</p>}
    {detail('relatedAudit') === 'bootup-time' && <p>{(lang === "fr" ? 'Ces scripts et durées proviennent du diagnostic d’exécution du même passage Lighthouse. Ils expliquent le travail JavaScript, pas nécessairement les autres postes du thread principal.' : localizeValue('These scripts and durations come from the execution diagnosis in the same Lighthouse run. They describe JavaScript work, not necessarily other main-thread work.', lang))}</p>}
  </div>;
}
