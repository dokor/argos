import type { Lang } from '@/lib/i18n/routes';
import type { FindingDetection, Issue } from './types';
import { findingPlaybook, type Playbook } from './findingPlaybooks';
import { cleanEvidence } from './findingText';

export const pilotFindingKeys = ['html.title', 'html.images.alt_coverage', 'http.security.csp',
  'lighthouse.audit.largest-contentful-paint', 'lighthouse.audit.lcp-discovery-insight',
  'lighthouse.audit.lcp-breakdown-insight'] as const;

type Explanation = Playbook & { methodNote: string; title?: string; observation?: string; missingInformation?: string };

/** Counts and header states are facts too; absence of a scalar is not missing evidence. */
export function expectsScalarMeasurement(issue: Issue): boolean {
  if (issue.id?.startsWith('lighthouse.audit.')) return new Set([
    'largest-contentful-paint', 'first-contentful-paint', 'speed-index', 'total-blocking-time',
    'interactive', 'cumulative-layout-shift', 'interaction-to-next-paint', 'max-potential-fid',
  ]).has(issue.id.slice('lighthouse.audit.'.length));
  return !!issue.id && (issue.id.startsWith('lighthouse.score.') || new Set([
    'http.response_time_ms', 'http.redirect.count', 'html.h1.count', 'html.scripts.count', 'html.size.bytes',
    'html.analysis.duration_ms', 'runtime.console.errors', 'runtime.js.errors', 'runtime.network.5xx',
    'runtime.network.failed_requests', 'runtime.network.third_party_errors', 'runtime.network.request_count',
    'runtime.network.bytes_estimated', 'runtime.analysis.duration_ms', 'ssl.certificate.expiry_days', 'observatory.score',
  ]).has(issue.id));
}

/** Only a known revision and matching producer may explain a historical detection as a fact. */
export function recordedPilotDetection(issue: Issue): FindingDetection | undefined {
  const d = issue.structuredEvidence?.detection;
  if (!d || d.version !== 'finding-detection-v1' || d.ruleKey !== issue.id
    || d.source !== issue.structuredEvidence?.source || !d.values
    || !Object.values(d.values).every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0)) return;
  const integer = (key: string) => Number.isSafeInteger(d.values[key]);
  if (issue.id === 'html.title' && d.ruleVersion === 'html-title-v1' && d.source === 'html'
    && d.scope === 'RECEIVED_HTML' && ['length', 'minimum', 'maximum'].every(integer)
    && d.values.minimum > 0 && d.values.minimum <= d.values.maximum) {
    const { length, minimum, maximum } = d.values;
    const result = length === 0 ? 'MISSING_OR_EMPTY' : length < minimum ? 'SHORT' : length > maximum ? 'LONG' : 'IN_RANGE';
    if (d.result === result) return d;
  }
  if (issue.id === 'html.images.alt_coverage' && d.ruleVersion === 'html-image-alt-v1' && d.source === 'html'
    && d.scope === 'RECEIVED_HTML' && ['images', 'missingAlt', 'missingPercent', 'lowSeverityMaxPercent'].every(integer)
    && d.values.images > 0 && d.values.missingAlt <= d.values.images && d.values.lowSeverityMaxPercent <= 100
    && d.values.missingPercent === Math.round(d.values.missingAlt / d.values.images * 100)
    && d.result === (d.values.missingAlt > 0 ? 'MISSING_ALT' : 'ALL_HAVE_ALT')) return d;
  if (issue.id === 'http.security.csp' && d.ruleVersion === 'http-csp-v1' && d.source === 'http'
    && d.scope === 'FINAL_HTTP_RESPONSE'
    && ['HEADER_ABSENT', 'HEADER_EMPTY', 'POLICY_UNRECOGNIZED', 'POLICY_RECOGNIZED'].includes(d.result)) return d;
  if (issue.id?.startsWith('lighthouse.audit.') && (pilotFindingKeys as readonly string[]).includes(issue.id)
    && d.ruleVersion === 'lighthouse-audit-selection-v1' && d.source === 'lighthouse'
    && d.scope === 'LIGHTHOUSE_NAVIGATION' && d.result === 'SCORE_BELOW_THRESHOLD'
    && d.values.score >= 0 && d.values.score < d.values.scoreThreshold && d.values.scoreThreshold <= 1
    && integer('maxFindings') && d.values.maxFindings > 0) return d;
}

export function findingExplanation(issue: Issue, lang: Lang): Explanation {
  const p = findingPlaybook(issue.id, lang), fr = lang === 'fr';
  const current = fr
    ? 'Référentiel des collecteurs actuels. La version exacte de cette règle n’est pas conservée dans la fiche ; un rapport historique peut utiliser une autre méthode.'
    : 'Current collector reference. The exact version of this rule is not retained in the finding; a historical report may use another method.';
  if (issue.id === 'lighthouse.audit.bf-cache') {
    const codes = (issue.structuredEvidence?.details?.find(d => d.key === 'bfCacheReasons')?.text ?? '').split(',').filter(code => /^[A-Za-z][A-Za-z0-9]{0,119}$/.test(code));
    const noStore = codes.some(code => ['MainResourceHasCacheControlNoStore', 'JsNetworkRequestReceivedCacheControlNoStoreResource'].includes(code));
    if (noStore) return { ...p, methodNote: current,
      observation: fr ? 'Lighthouse a relevé Cache-Control: no-store sur le document ou une réponse chargée par JavaScript pendant le test arrière/avant.' : 'Lighthouse detected Cache-Control: no-store on the document or a response loaded by JavaScript during the back/forward test.',
      steps: [fr ? 'Dans Réseau, ouvrir la requête du document de la page analysée et vérifier son en-tête Cache-Control. Examiner aussi les réponses fetch/XHR marquées no-store ; le rapport ne conserve pas leur URL exacte.' : 'In Network, open the analysed page’s document request and check its Cache-Control header. Also inspect fetch/XHR responses marked no-store; their exact URLs are not retained in this report.',
        fr ? 'Si no-store protège une session ou des données personnelles, le conserver. Pour une réponse publique, examiner la règle de cache de cette route dans le serveur, le reverse proxy ou le CDN avant de la modifier.' : 'Keep no-store when it protects a session or personal data. For a public response, review that route’s cache rule in the server, reverse proxy or CDN before changing it.',
        fr ? 'Dans Application → Cache arrière/avant, rejouer le test et lire le motif courant. Si Chrome indique une condition sans action possible, aucune suppression automatique de no-store n’est justifiée.' : 'In Application → Back/forward cache, repeat the test and read the current reason. If Chrome reports a non-actionable condition, automatically removing no-store is not justified.'],
      expected: fr ? 'Rejouer une navigation arrière/avant dans le navigateur cible et vérifier le motif de non-restauration. Confirmer que les données privées ne sont jamais réaffichées après déconnexion.' : 'Repeat back/forward navigation in the target browser and check the not-restored reason. Confirm private data never reappears after logout.',
      missingInformation: fr ? `Motifs enregistrés : ${codes.join(', ')}. Le détail des requêtes JavaScript et des frames reste à confirmer dans le navigateur.` : `Recorded reasons: ${codes.join(', ')}. JavaScript requests and frame details still need confirmation in the browser.`,
    };
  }
  if (issue.id?.startsWith('zap.alert.')) {
    const detail = (key: string) => cleanEvidence(issue.structuredEvidence?.details?.find(d => d.key === key)?.text).trim();
    const description = detail('description');
    const retained = detail('solution') || cleanEvidence(issue.recommendation).trim();
    const solution = /^(Examinez et corrigez ce problème|Corriger selon les bonnes pratiques)/i.test(retained) ? '' : retained;
    const plugin = issue.id.slice('zap.alert.'.length);
    const sourceLabel = fr ? 'ZAP, texte source (langue d’origine)' : 'ZAP source text (original language)';
    const contextualGuide = ['10055','10202','10037'].includes(plugin);
    return { ...p, specific: p.specific || !!solution, methodNote: current,
      reference: /^\d{1,8}$/.test(plugin) ? `https://www.zaproxy.org/docs/alerts/${plugin}/` : p.reference,
      ...(description ? { observation: contextualGuide ? (plugin === '10202'
        ? (fr ? 'ZAP n’a pas reconnu de jeton anti-CSRF dans les formulaires signalés du HTML reçu. La protection effective côté serveur reste à vérifier.' : 'ZAP did not recognise an anti-CSRF token in the flagged forms in received HTML. Effective server-side protection still needs verification.')
        : plugin === '10037' ? (fr ? 'La réponse de cette page expose le logiciel serveur dans X-Powered-By.' : 'This page’s response exposes server software in X-Powered-By.')
        : (fr ? 'ZAP signale les directives CSP détaillées ci-dessous sur la réponse de cette page.' : 'ZAP flags the CSP directives detailed below on this page’s response.')) : `${sourceLabel} : ${description}`,
        impact: p.impact ?? (fr ? 'Le risque décrit par ZAP ci-dessus concerne les réponses observées. Confirmer les conditions et les utilisateurs concernés avant de choisir la priorité.' : 'The risk described by ZAP above concerns observed responses. Confirm the conditions and affected users before choosing priority.') } : {}),
      summary: p.summary ?? (solution ? `${sourceLabel} : ${solution}` : (fr ? 'La solution de cette règle ZAP n’a pas été conservée. Ouvrir sa documentation avant de choisir une modification.' : 'This ZAP rule’s solution was not retained. Open its documentation before choosing a change.')),
      steps: p.specific ? [...p.steps, ...(solution && !contextualGuide ? [`${sourceLabel} : ${solution}`] : [])] : [fr ? 'Retrouver la réponse concernée dans Réseau et comparer le motif de la règle ZAP avec les en-têtes ou le contenu reçus.' : 'Locate the affected response in Network and compare the ZAP rule’s reason with received headers or content.',
        solution ? `${sourceLabel} : ${solution}` : (fr ? 'Solution spécifique indisponible dans ce rapport : consulter la règle de référence ou relancer la collecte. Aucun changement de configuration ne peut être déduit de la seule gravité.' : 'Specific solution unavailable in this report: consult the reference rule or repeat collection. Severity alone cannot determine a configuration change.')],
      expected: p.specific ? p.expected : (fr ? `Rejouer la même requête après correction et vérifier le comportement décrit par la règle ${plugin}. Relancer l’analyse passive : le signal ciblé doit disparaître sans casser le parcours légitime.` : `Repeat the same request after the fix and verify the behaviour described by rule ${plugin}. Rerun passive analysis: the targeted signal should disappear without breaking the legitimate journey.`),
    };
  }
  if (issue.id === 'observatory.score') {
    const failed = cleanEvidence(issue.structuredEvidence?.details?.find(d => d.key === 'failedPolicies')?.text);
    const guidance = cleanEvidence(issue.recommendation);
    const policies: Record<string, string> = {
      'content-security-policy': 'http.security.csp', 'strict-transport-security': 'http.security.hsts',
      'x-content-type-options': 'http.security.x_content_type_options', 'x-frame-options': 'http.security.x_frame_options',
      'referrer-policy': 'http.security.referrer_policy', cookies: 'http.security.cookie_flags',
      redirection: 'http.redirect.to_https',
    };
    const names = [...new Set((failed.match(/[a-z][a-z-]+/g) ?? []))];
    const remedies = names.filter(name => Object.hasOwn(policies, name)).map(name => ({ name, book: findingPlaybook(policies[name], lang) }));
    return { ...p, methodNote: current,
      ...(failed ? { observation: fr ? `Observatory signale les politiques suivantes : ${failed}. La note est un résumé de ces contrôles.` : `Observatory flags these policies: ${failed}. The score summarises these checks.` } : {}),
      steps: failed ? [
        ...(guidance ? [`${fr ? 'Détail Observatory conservé (langue d’origine)' : 'Retained Observatory detail (original language)'} : ${guidance}`] : []),
        ...remedies.flatMap(({ name, book }) => book.steps.filter(step => !/validateur Argos|Argos validator/.test(step)).map(step => `${name} : ${step}`)),
        ...(remedies.length < names.length || !remedies.length ? p.steps : []),
      ] : p.steps,
      expected: remedies.length ? remedies.map(({ name, book }) => `${name} : ${book.expected}`).join(' ') : p.expected,
    };
  }
  if (!(pilotFindingKeys as readonly (string | null | undefined)[]).includes(issue.id)) return { ...p, methodNote: current };
  const d = recordedPilotDetection(issue);
  const source = issue.structuredEvidence?.source;
  const missing = fr
    ? 'La méthode exacte de cette analyse est indisponible ou sa révision n’est pas prise en charge. Aucun seuil courant n’est attribué rétroactivement à ce constat. Les étapes ci-dessous restent un guide de vérification.'
    : 'This analysis’s exact method is unavailable or its revision is unsupported. No current threshold is retroactively assigned to this finding. The steps below remain verification guidance.';
  const result: Explanation = { ...p, methodNote: missing };
  const n = (value: number) => value.toLocaleString(lang, { maximumSignificantDigits: 8 });
  if (d) {
    const version = d.toolVersion && /^[0-9]{1,3}(\.[0-9]{1,3}){1,3}$/.test(d.toolVersion) ? ` · Lighthouse ${d.toolVersion}` : '';
    result.methodNote = `${fr ? 'Méthode enregistrée avec cette analyse' : 'Method recorded with this analysis'} : ${d.ruleVersion}${version}.`;
  }

  if (issue.id === 'html.title') {
    result.detection = d
      ? (fr ? `Le parseur HTML lit le titre du document reçu sans exécuter JavaScript. Une longueur nulle déclenche un échec ; moins de ${n(d.values.minimum)} ou plus de ${n(d.values.maximum)} caractères déclenche un avertissement. Ces bornes sont des heuristiques Argos.`
        : `The HTML parser reads the received document title without executing JavaScript. A zero length triggers failure; fewer than ${n(d.values.minimum)} or more than ${n(d.values.maximum)} characters triggers a warning. These bounds are Argos heuristics.`)
      : (fr ? 'Ce constat concerne le titre de la page. Le rapport ne permet pas de confirmer la méthode et les bornes de longueur appliquées lors de cette analyse.'
        : 'This finding concerns the page title. The report cannot confirm the method and length bounds applied during this analysis.');
    if (d) {
      result.observation = fr ? `Le titre HTML contient ${n(d.values.length)} caractères.` : `The HTML title contains ${n(d.values.length)} characters.`;
      if (d.result === 'MISSING_OR_EMPTY') result.title = fr ? 'Le titre HTML est absent ou vide' : 'The HTML title is absent or empty';
      if (d.result === 'SHORT') result.title = fr ? 'Le titre HTML est très court' : 'The HTML title is very short';
      if (d.result === 'LONG') result.title = fr ? 'Le titre HTML est long' : 'The HTML title is long';
    }
    result.missingInformation = fr ? 'Emplacement à examiner : le titre du document reçu. Son texte exact n’est pas conservé dans cette preuve ; le retrouver dans la réponse HTML.'
      : 'Location to inspect: the received document title. Its exact text is not retained in this evidence; locate it in the HTML response.';
  } else if (issue.id === 'html.images.alt_coverage') {
    result.detection = d
      ? (fr ? `Le parseur compte les img sans attribut alt dans le HTML reçu. Un alt vide est accepté. Toute absence déclenche un avertissement ; une proportion arrondie au plus égale à ${n(d.values.lowSeverityMaxPercent)} % donne une sévérité faible, au-delà une sévérité moyenne.`
        : `The parser counts img elements without alt in received HTML. Empty alt is accepted. Any absence triggers a warning; a rounded proportion up to ${n(d.values.lowSeverityMaxPercent)}% has low severity, above it medium severity.`)
      : (fr ? 'Ce constat porte sur les attributs alt des images. Les compteurs éventuellement conservés ne suffisent pas à confirmer la méthode et les seuils appliqués lors de cette analyse.'
        : 'This finding concerns image alt attributes. Any retained counts cannot confirm the method and thresholds applied during this analysis.');
    if (d) {
      result.title = fr ? 'Des images n’ont pas d’attribut alt' : 'Images lack an alt attribute';
      result.observation = fr ? `${n(d.values.missingAlt)} image(s) sans attribut alt parmi ${n(d.values.images)} images observées.`
        : `${n(d.values.missingAlt)} image(s) without an alt attribute among ${n(d.values.images)} observed images.`;
    }
    result.missingInformation = fr ? 'L’emplacement exact des images n’est pas conservé par ce compteur HTML. Les retrouver dans la réponse reçue ; aucun chemin ou extrait de site n’est déduit de leur nombre.'
      : 'This HTML count does not retain exact image locations. Locate them in the received response; no site path or snippet is inferred from their number.';
  } else if (issue.id === 'http.security.csp') {
    const observations: Record<string, [string, string]> = {
      HEADER_ABSENT: ['L’en-tête Content-Security-Policy est absent de la réponse HTTP finale examinée.', 'The Content-Security-Policy header is absent from the examined final HTTP response.'],
      HEADER_EMPTY: ['L’en-tête Content-Security-Policy est vide dans la réponse HTTP finale examinée.', 'The Content-Security-Policy header is empty in the examined final HTTP response.'],
      POLICY_UNRECOGNIZED: ['L’en-tête CSP est présent ; sa configuration restrictive n’est pas reconnue par le validateur Argos.', 'The CSP header is present; its restrictive configuration is not recognised by the Argos validator.'],
      POLICY_RECOGNIZED: ['Une configuration CSP restrictive est reconnue par le validateur Argos.', 'A restrictive CSP configuration is recognised by the Argos validator.'],
    };
    result.detection = d
      ? (fr ? 'Le collecteur HTTP examine Content-Security-Policy dans la réponse finale. Il accepte un sous-ensemble de sources script-src restrictives, ou default-src si script-src est absent. Une valeur vide, non reconnue ou un en-tête absent déclenche un avertissement ; Report-Only seul ne satisfait pas ce contrôle.'
        : 'The HTTP collector examines Content-Security-Policy in the final response. It accepts a subset of restrictive script-src sources, or default-src when script-src is absent. An empty or unrecognised value or absent header triggers a warning; Report-Only alone does not satisfy this check.')
      : source === 'zap' ? (fr ? 'La source conservée est ZAP. Sa règle et la réponse signalée doivent être vérifiées dans le diagnostic source ; le validateur HTTP Argos ne décrit pas cette observation.'
        : 'The retained source is ZAP. Its rule and reported response must be checked in the source diagnosis; the Argos HTTP validator does not describe this observation.')
        : (fr ? 'Ce constat concerne la politique CSP. Sans méthode enregistrée, ce rapport ne permet pas de distinguer avec certitude un en-tête absent, vide ou une configuration non reconnue.'
          : 'This finding concerns CSP. Without a recorded method, this report cannot reliably distinguish an absent or empty header from an unrecognised configuration.');
    if (d) {
      result.observation = observations[d.result][fr ? 0 : 1];
      result.title = d.result === 'HEADER_ABSENT' ? (fr ? 'L’en-tête Content-Security-Policy est absent' : 'The Content-Security-Policy header is absent')
        : d.result === 'HEADER_EMPTY' ? (fr ? 'L’en-tête Content-Security-Policy est vide' : 'The Content-Security-Policy header is empty')
          : (fr ? 'La politique CSP nécessite une vérification' : 'The CSP policy needs review');
    }
    result.missingInformation = fr ? 'Périmètre à examiner : les en-têtes de la réponse concernée. La valeur brute de la politique n’est pas ajoutée à cette preuve.'
      : 'Scope to inspect: the affected response headers. The raw policy value is not added to this evidence.';
  } else {
    result.detection = `${p.detection} ${d
      ? (fr ? `Lors de cette analyse, Argos a retenu un score ${n(d.values.score)} inférieur à ${n(d.values.scoreThreshold)}, parmi au plus ${n(d.values.maxFindings)} diagnostics classés par poids de catégorie puis par score.`
        : `In this analysis, Argos selected a score of ${n(d.values.score)} below ${n(d.values.scoreThreshold)}, among at most ${n(d.values.maxFindings)} diagnoses ordered by category weight, then score.`)
      : (fr ? 'Le seuil de sélection et la version de cette analyse ne sont pas confirmés par cette fiche.' : 'This entry cannot confirm this analysis’s selection threshold and version.')}`;
    const measure = issue.structuredEvidence?.measurement;
    if (issue.id === 'lighthouse.audit.largest-contentful-paint') {
      result.observation = measure?.unit === 'ms' && Number.isFinite(measure.value) && measure.value >= 0
        ? (fr ? `LCP mesuré en laboratoire : ${n(measure.value)} ms.` : `Laboratory LCP measurement: ${n(measure.value)} ms.`)
        : (fr ? 'Un signal LCP est conservé, mais sa durée est indisponible pour cette analyse. Le score normalisé n’est pas une durée.'
          : 'An LCP signal is retained, but its duration is unavailable for this analysis. The normalised score is not a duration.');
    }
    const observed = issue.structuredEvidence?.observed;
    result.missingInformation = observed?.version === 'observed-evidence-v1' && observed.source === 'lighthouse'
      && observed.state === 'AVAILABLE' && observed.items.length > 0
      ? (fr ? 'Les observations conservées sont présentées ci-dessous. Leur présence ne garantit pas que la décomposition des phases LCP soit disponible.'
        : 'Retained observations are shown below. Their presence does not guarantee that the LCP phase breakdown is available.')
      : (fr ? 'L’élément LCP et le détail des phases ne sont pas conservés dans cette preuve. Les retrouver dans la trace de cette URL avant de choisir une correction.'
        : 'This evidence does not retain the LCP element or phase details. Locate them in this URL’s trace before choosing a correction.');
  }
  return result;
}
