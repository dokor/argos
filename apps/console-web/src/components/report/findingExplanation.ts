import { intlLocale } from "@/lib/i18n/locales";
import { localizeValue } from "@/lib/i18n/messages";
import type { Lang } from '@/lib/i18n/routes';
import type { FindingDetection, Issue } from './types';
import { findingPlaybook, type Playbook } from './findingPlaybooks';
import { cleanEvidence } from './findingText';
import {certificateProblems} from './certificateProblems';

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
  if (['tech.security.php_eol', 'tech.security.php_cves'].includes(issue.id ?? '')) {
    const detail = (key: string) => cleanEvidence(issue.structuredEvidence?.details?.find(d => d.key === key)?.text ?? '');
    const version = /^\d{1,2}\.\d{1,2}(?:\.\d{1,3})?$/.test(detail('phpVersion')) ? `PHP ${detail('phpVersion')}` : 'PHP';
    const eol = issue.id === 'tech.security.php_eol';
    const cves = [...new Set(detail('cves').match(/CVE-\d{4}-\d{4,}/g) ?? [])];
    const checked = detail(eol ? 'supportVerifiedAt' : 'advisoriesVerifiedAt');
    return { ...p,
      title: eol ? ((lang === "fr" ? `${version} : branche en fin de support` : localizeValue("{p0}: end-of-life branch", lang).replaceAll("{p0}", () => String(version))))
        : ((lang === "fr" ? `${version} : CVE connues à vérifier` : localizeValue("{p0}: review known CVEs", lang).replaceAll("{p0}", () => String(version)))),
      observation: eol
        ? ((lang === "fr" ? `La réponse HTTP expose ${version}. Cette branche n’est plus maintenue par le projet PHP.` : localizeValue("The HTTP response exposes {p0}. This branch is no longer supported by the PHP project.", lang).replaceAll("{p0}", () => String(version))))
        : ((lang === "fr" ? `La version exposée ${version} correspond à des avis de sécurité PHP` : localizeValue("The exposed {p0} version matches PHP security advisories", lang).replaceAll("{p0}", () => String(version)))) + (cves.length ? ` : ${cves.join(', ')}.` : '.'),
      methodNote: ((lang === "fr" ? 'Référentiel enregistré avec ce constat' : localizeValue('Reference recorded with this finding', lang))) + (/^\d{4}-\d{2}-\d{2}$/.test(checked) ? ` (${checked}). ` : '. ') + p.limits,
      reference: eol ? p.reference : 'https://github.com/php/php-src/security/advisories',
    };
  }
  const current = (lang === "fr" ? 'Référentiel des collecteurs actuels. La version exacte de cette règle n’est pas conservée dans la fiche ; un rapport historique peut utiliser une autre méthode.' : localizeValue('Current collector reference. The exact version of this rule is not retained in the finding; a historical report may use another method.', lang));
  // WAI-ARIA 1.2: values depend on state and role; never copy the observed invalid
  // value or infer one from severity. Apply only to the attribute rule itself.
  if(['lighthouse.audit.aria-valid-attr-value','lighthouse.audit.aria-required-attr','lighthouse.audit.aria-valid-attr'].includes(issue.id??'')) {
    const attrs=new Set(issue.structuredEvidence?.observed?.items.flatMap(item=>item.attributes??[])??[]);
    const specific=[
      ['aria-expanded',(lang === "fr" ? 'aria-expanded : utiliser "false" lorsque la zone est repliée, "true" lorsqu’elle est dépliée. Synchroniser la valeur avec son ouverture réelle.' : localizeValue('aria-expanded: use "false" when collapsed and "true" when expanded. Keep it synchronized with actual visibility.', lang))],
      ['aria-valuenow',(lang === "fr" ? 'aria-valuenow : fournir la valeur numérique actuelle, entre aria-valuemin et aria-valuemax. Ne pas inventer une progression ; une progression indéterminée peut omettre cette valeur.' : localizeValue('aria-valuenow: supply the current numeric value within aria-valuemin and aria-valuemax. Do not invent progress; indeterminate progress may omit this value.', lang))],
      ['aria-labl',(lang === "fr" ? 'aria-labl n’existe pas : corriger en aria-label si ce rôle accepte un nom accessible, avec un libellé décrivant l’action.' : localizeValue('aria-labl does not exist: correct it to aria-label if the role accepts an accessible name, with a label describing the action.', lang))],
    ].filter(([name])=>attrs.has(name)).map(([,instruction])=>instruction);
    if(specific.length)return {...p,methodNote:current,steps:[p.steps[0],...specific],expected:(lang === "fr" ? 'Actionner le composant au clavier, puis vérifier son nom et son état calculés dans Accessibilité à chaque changement. Relancer la même règle : l’erreur disparaît et l’action fonctionne.' : localizeValue('Operate the component with the keyboard, then check its computed name and state in Accessibility after each change. Rerun the same rule: the error disappears and the action works.', lang))};
  }
  if(issue.id==='lighthouse.audit.document-latency-insight') {
    const detail=(key:string)=>issue.structuredEvidence?.details?.find(d=>d.key===key)?.text;
    const causes = [
      ['serverResponseIsFast',(lang === "fr" ? 'Attente de réponse du serveur' : localizeValue('Server response waiting', lang)),(lang === "fr" ? 'Sur la route du document principal, mesurer le traitement et les appels amont ; optimiser le poste lent ou son cache compatible avec les données privées.' : localizeValue('On the main document route, measure processing and upstream calls; optimise the slow work or its cache while protecting private data.', lang))],
      ['noRedirects',(lang === "fr" ? 'Détours de redirection' : localizeValue('Redirect detours', lang)),(lang === "fr" ? 'Conserver le journal Réseau et faire pointer les redirections intermédiaires vers la destination finale équivalente, en préservant HTTPS et le contenu attendu.' : localizeValue('Preserve the Network log and point intermediate redirects at the equivalent final destination, preserving HTTPS and the intended content.', lang))],
      ['usesCompression',(lang === "fr" ? 'Document transféré sans compression suffisante' : localizeValue('Document transferred without sufficient compression', lang)),(lang === "fr" ? 'Vérifier Content-Encoding sur la réponse du document et activer gzip ou Brotli au serveur ou CDN qui la sert ; comparer les octets transférés.' : localizeValue('Check Content-Encoding on the document response and enable gzip or Brotli at the serving server or CDN; compare transferred bytes.', lang))],
    ].filter(([key])=>detail(`documentCheck.${key}`)==='false');
    if(causes.length) return {...p,methodNote:current,
      observation:((lang === "fr" ? 'Causes relevées sur le document principal : ' : localizeValue('Recorded causes on the main document: ', lang)))+causes.map(c=>c[1]).join(' ; '),
      steps:causes.map(c=>c[2]),expected:(lang === "fr" ? 'Recharger la même URL au même profil, comparer la phase ciblée dans Réseau et relancer Lighthouse : chaque contrôle indiqué doit réussir. Vérifier aussi les contenus connectés et anonymes.' : localizeValue('Reload the same URL with the same profile, compare the targeted phase in Network and rerun Lighthouse: each listed check should pass. Also verify signed-in and anonymous content.', lang))};
  }
  if(issue.id==='ssl.certificate.valid') {
    const problems=certificateProblems(issue.structuredEvidence?.details?.find(d=>d.key==='certificateProblems')?.text,lang);
    if(problems.length) return {...p,methodNote:current,
      observation:problems.map(p=>p.problem).join(' ; '),steps:problems.map(p=>`${p.problem} : ${p.change}`),expected:problems.map(p=>p.verify).join(' ')};
  }
  if (['runtime.console.errors','lighthouse.audit.errors-in-console'].includes(issue.id??'')) return {...p,methodNote:current,
    title:(lang === "fr" ? 'Des erreurs sont relevées dans la console' : localizeValue('Errors were recorded in the console', lang)),
    steps:[(lang === "fr" ? 'Ouvrir les ressources indiquées dans Réseau et la Console. Un message de chargement échoué concerne la requête ; une exception concerne le code à la ligne indiquée.' : localizeValue('Open the listed resources in Network and Console. A failed-load message concerns the request; an exception concerns code at the reported line.', lang)),
      (lang === "fr" ? 'Pour une image ou un fichier introuvable, corriger son URL dans le HTML, le CSS ou son initiateur et vérifier sa publication. Pour une requête refusée, lire le statut et le motif avant de modifier sa configuration.' : localizeValue('For a missing image or file, fix its URL in HTML, CSS or its initiator and check deployment. For a refused request, inspect its status and reason before changing configuration.', lang)),
      (lang === "fr" ? 'Pour une exception JavaScript, activer l’arrêt sur exception et corriger l’expression ou la condition dans le module source correspondant. Ne pas masquer le message.' : localizeValue('For a JavaScript exception, enable pause on exceptions and fix the expression or condition in the corresponding source module. Do not hide the message.', lang))]};
  if (issue.id==='lighthouse.audit.inspector-issues' && issue.structuredEvidence?.details?.some(d=>d.key==='browserIssueTypes'&&d.text?.includes('MIXED_CONTENT'))) {
    const mixed=findingPlaybook('lighthouse.audit.is-on-https',lang);
    return {...mixed,methodNote:current,observation:(lang === "fr" ? 'DevTools signale du contenu mixte : cette page HTTPS référence les ressources HTTP indiquées ci-dessous.' : localizeValue('DevTools reports mixed content: this HTTPS page references the HTTP resources listed below.', lang))};
  }
  if (issue.id === 'ssl.grade' && issue.structuredEvidence?.details?.some(d=>d.key==='weakCipherSuites'&&d.text)) return {...p, methodNote:current,
    observation:(lang === "fr" ? 'SSL Labs relève des suites de chiffrement faibles ou non sûres sur la terminaison indiquée. Elles sont listées ci-dessous ; la note peut aussi dépendre d’autres critères.' : localizeValue('SSL Labs flags weak or insecure cipher suites on the listed endpoint. They appear below; other criteria may also affect the grade.', lang)),
    steps:[(lang === "fr" ? 'Sur la terminaison TLS indiquée, retrouver la liste des suites autorisées dans le serveur, reverse proxy ou CDN. Comparer les noms exacts ci-dessus.' : localizeValue('On the listed TLS endpoint, locate the enabled cipher suites in the server, reverse proxy or CDN. Compare the exact names above.', lang)),
      (lang === "fr" ? 'Retirer les suites signalées de la configuration en conservant les suites modernes nécessaires aux clients supportés. Tester en préproduction avant rechargement ; modifier la configuration du composant qui termine réellement TLS.' : localizeValue('Remove the flagged suites while retaining modern suites required by supported clients. Test in staging before reloading; change the component that actually terminates TLS.', lang))],
    expected:(lang === "fr" ? 'Le nouveau scan du même hôte et de chaque terminaison ne propose plus ces suites ; les clients supportés négocient toujours HTTPS.' : localizeValue('A new scan of the same host and each endpoint no longer offers those suites; supported clients still negotiate HTTPS.', lang))};
  if (issue.id === 'lighthouse.audit.bf-cache') {
    const codes = (issue.structuredEvidence?.details?.find(d => d.key === 'bfCacheReasons')?.text ?? '').split(',').filter(code => /^[A-Za-z][A-Za-z0-9]{0,119}$/.test(code));
    const noStore = codes.some(code => ['MainResourceHasCacheControlNoStore', 'JsNetworkRequestReceivedCacheControlNoStoreResource'].includes(code));
    if(codes.includes('UnloadHandlerExistsInMainFrame')&&!noStore) return {...p,methodNote:current,
      observation:(lang === "fr" ? 'Un gestionnaire unload du document principal empêche sa restauration depuis le cache retour/avance.' : localizeValue('An unload handler in the main document prevents restoration from the back/forward cache.', lang)),
      steps:[(lang === "fr" ? 'Sur la page analysée, dans la Console Chrome, exécuter getEventListeners(window).unload et ouvrir les fonctions listées pour retrouver leur fichier source. Vérifier également window.onunload.' : localizeValue('On the analysed page, run getEventListeners(window).unload in the Chrome Console and open the listed functions to locate their source file. Also check window.onunload.', lang)),
        (lang === "fr" ? 'Retirer la dépendance à unload ; déplacer la sauvegarde d’état vers visibilitychange et adapter les nettoyages à pagehide/pageshow selon le cycle de vie requis. Tester l’intégration qui installait le gestionnaire.' : localizeValue('Remove the dependency on unload; move state saving to visibilitychange and adapt cleanup to pagehide/pageshow according to the required lifecycle. Test the integration that installed the handler.', lang))],
      expected:(lang === "fr" ? 'Dans Application → Cache arrière/avant, relancer le test : ce motif disparaît. Naviguer ailleurs puis revenir, vérifier la restauration et la conservation des données attendues ; traiter séparément tout autre motif encore signalé.' : localizeValue('Rerun Application → Back/forward cache: this reason disappears. Navigate away and back, verify restoration and expected state; handle any other remaining reason separately.', lang))};
    if (noStore) return { ...p, methodNote: current,
      observation: (lang === "fr" ? 'Lighthouse a relevé Cache-Control: no-store sur le document ou une réponse chargée par JavaScript pendant le test arrière/avant.' : localizeValue('Lighthouse detected Cache-Control: no-store on the document or a response loaded by JavaScript during the back/forward test.', lang)),
      steps: [(lang === "fr" ? 'Dans Réseau, ouvrir la requête du document de la page analysée et vérifier son en-tête Cache-Control. Examiner aussi les réponses fetch/XHR marquées no-store ; le rapport ne conserve pas leur URL exacte.' : localizeValue('In Network, open the analysed page’s document request and check its Cache-Control header. Also inspect fetch/XHR responses marked no-store; their exact URLs are not retained in this report.', lang)),
        (lang === "fr" ? 'Si no-store protège une session ou des données personnelles, le conserver. Pour une réponse publique, examiner la règle de cache de cette route dans le serveur, le reverse proxy ou le CDN avant de la modifier.' : localizeValue('Keep no-store when it protects a session or personal data. For a public response, review that route’s cache rule in the server, reverse proxy or CDN before changing it.', lang)),
        (lang === "fr" ? 'Dans Application → Cache arrière/avant, rejouer le test et lire le motif courant. Si Chrome indique une condition sans action possible, aucune suppression automatique de no-store n’est justifiée.' : localizeValue('In Application → Back/forward cache, repeat the test and read the current reason. If Chrome reports a non-actionable condition, automatically removing no-store is not justified.', lang))],
      expected: (lang === "fr" ? 'Rejouer une navigation arrière/avant dans le navigateur cible et vérifier le motif de non-restauration. Confirmer que les données privées ne sont jamais réaffichées après déconnexion.' : localizeValue('Repeat back/forward navigation in the target browser and check the not-restored reason. Confirm private data never reappears after logout.', lang)),
      missingInformation: (lang === "fr" ? `Motifs enregistrés : ${codes.join(', ')}. Le détail des requêtes JavaScript et des frames reste à confirmer dans le navigateur.` : localizeValue("Recorded reasons: {p0}. JavaScript requests and frame details still need confirmation in the browser.", lang).replaceAll("{p0}", () => String(codes.join(', ')))),
    };
  }
  if (issue.id?.startsWith('zap.alert.')) {
    const detail = (key: string) => cleanEvidence(issue.structuredEvidence?.details?.find(d => d.key === key)?.text).trim();
    const description = detail('description');
    const retained = detail('solution') || cleanEvidence(issue.recommendation).trim();
    const solution = /^(Examinez et corrigez ce problème|Corriger selon les bonnes pratiques)/i.test(retained) ? '' : retained;
    const plugin = issue.id.slice('zap.alert.'.length);
    const sourceLabel = (lang === "fr" ? 'ZAP, texte source (langue d’origine)' : localizeValue('ZAP source text (original language)', lang));
    const contextualGuide = ['10055','10202','10037','10036','10040','10010','10011','10054','10096'].includes(plugin);
    return { ...p, specific: p.specific || !!solution, methodNote: current,
      reference: /^\d{1,8}$/.test(plugin) ? `https://www.zaproxy.org/docs/alerts/${plugin}/` : p.reference,
      ...(description ? { observation: contextualGuide ? (plugin === '10202'
        ? ((lang === "fr" ? 'ZAP n’a pas reconnu de jeton anti-CSRF dans les formulaires signalés du HTML reçu. La protection effective côté serveur reste à vérifier.' : localizeValue('ZAP did not recognise an anti-CSRF token in the flagged forms in received HTML. Effective server-side protection still needs verification.', lang)))
        : ['10037','10036'].includes(plugin) ? ((lang === "fr" ? `La réponse de cette page expose le logiciel serveur dans ${plugin==='10036'?'Server':'X-Powered-By'}.` : localizeValue("This page’s response exposes server software in {p0}.", lang).replaceAll("{p0}", () => String(plugin==='10036'?'Server':'X-Powered-By'))))
        : ['10010','10011','10054'].includes(plugin) ? ((lang === "fr" ? 'ZAP signale un attribut de protection absent sur le cookie de réponse indiqué ci-dessous.' : localizeValue('ZAP flags a missing protection attribute on the response cookie located below.', lang)))
        : plugin === '10096' ? ((lang === "fr" ? 'ZAP a reconnu une valeur ressemblant à un horodatage à l’emplacement indiqué. Ce signal de faible confiance ne démontre pas une fuite sensible.' : localizeValue('ZAP recognised a value resembling a timestamp at the listed location. This low-confidence signal does not establish a sensitive disclosure.', lang)))
        : plugin === '10040' ? ((lang === "fr" ? 'Le HTML de cette page HTTPS référence une ressource HTTP à l’emplacement indiqué.' : localizeValue('This HTTPS page’s HTML references an HTTP resource at the listed location.', lang)))
        : ((lang === "fr" ? 'ZAP signale les directives CSP détaillées ci-dessous sur la réponse de cette page.' : localizeValue('ZAP flags the CSP directives detailed below on this page’s response.', lang)))) : `${sourceLabel} : ${description}`,
        impact: p.impact ?? ((lang === "fr" ? 'Le risque décrit par ZAP ci-dessus concerne les réponses observées. Confirmer les conditions et les utilisateurs concernés avant de choisir la priorité.' : localizeValue('The risk described by ZAP above concerns observed responses. Confirm the conditions and affected users before choosing priority.', lang))) } : {}),
      summary: p.summary ?? (solution ? `${sourceLabel} : ${solution}` : ((lang === "fr" ? 'La solution de cette règle ZAP n’a pas été conservée. Ouvrir sa documentation avant de choisir une modification.' : localizeValue('This ZAP rule’s solution was not retained. Open its documentation before choosing a change.', lang)))),
      steps: p.specific ? [...p.steps, ...(solution && !contextualGuide ? [`${sourceLabel} : ${solution}`] : [])] : [(lang === "fr" ? 'Retrouver la réponse concernée dans Réseau et comparer le motif de la règle ZAP avec les en-têtes ou le contenu reçus.' : localizeValue('Locate the affected response in Network and compare the ZAP rule’s reason with received headers or content.', lang)),
        solution ? `${sourceLabel} : ${solution}` : ((lang === "fr" ? 'Solution spécifique indisponible dans ce rapport : consulter la règle de référence ou relancer la collecte. Aucun changement de configuration ne peut être déduit de la seule gravité.' : localizeValue('Specific solution unavailable in this report: consult the reference rule or repeat collection. Severity alone cannot determine a configuration change.', lang)))],
      expected: p.specific ? p.expected : ((lang === "fr" ? `Rejouer la même requête après correction et vérifier le comportement décrit par la règle ${plugin}. Relancer l’analyse passive : le signal ciblé doit disparaître sans casser le parcours légitime.` : localizeValue("Repeat the same request after the fix and verify the behaviour described by rule {p0}. Rerun passive analysis: the targeted signal should disappear without breaking the legitimate journey.", lang).replaceAll("{p0}", () => String(plugin)))),
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
      ...(failed ? { observation: (lang === "fr" ? `Observatory signale les politiques suivantes : ${failed}. La note est un résumé de ces contrôles.` : localizeValue("Observatory flags these policies: {p0}. The score summarises these checks.", lang).replaceAll("{p0}", () => String(failed))) } : {}),
      steps: failed ? [
        ...(guidance ? [`${(lang === "fr" ? 'Détail Observatory conservé (langue d’origine)' : localizeValue('Retained Observatory detail (original language)', lang))} : ${guidance}`] : []),
        ...remedies.flatMap(({ name, book }) => book.steps.filter(step => !/validateur Argos|Argos validator/.test(step)).map(step => `${name} : ${step}`)),
        ...(remedies.length < names.length || !remedies.length ? p.steps : []),
      ] : p.steps,
      expected: remedies.length ? remedies.map(({ name, book }) => `${name} : ${book.expected}`).join(' ') : p.expected,
    };
  }
  if (!(pilotFindingKeys as readonly (string | null | undefined)[]).includes(issue.id)) return { ...p, methodNote: current };
  const d = recordedPilotDetection(issue);
  const source = issue.structuredEvidence?.source;
  const missing = (lang === "fr" ? 'La méthode exacte de cette analyse est indisponible ou sa révision n’est pas prise en charge. Aucun seuil courant n’est attribué rétroactivement à ce constat. Les étapes ci-dessous restent un guide de vérification.' : localizeValue('This analysis’s exact method is unavailable or its revision is unsupported. No current threshold is retroactively assigned to this finding. The steps below remain verification guidance.', lang));
  const result: Explanation = { ...p, methodNote: missing };
  const n = (value: number) => value.toLocaleString(intlLocale(lang), { maximumSignificantDigits: 8 });
  if (d) {
    const version = d.toolVersion && /^[0-9]{1,3}(\.[0-9]{1,3}){1,3}$/.test(d.toolVersion) ? ` · Lighthouse ${d.toolVersion}` : '';
    result.methodNote = `${(lang === "fr" ? 'Méthode enregistrée avec cette analyse' : localizeValue('Method recorded with this analysis', lang))} : ${d.ruleVersion}${version}.`;
  }

  if (issue.id === 'html.title') {
    result.detection = d
      ? ((lang === "fr" ? `Le parseur HTML lit le titre du document reçu sans exécuter JavaScript. Une longueur nulle déclenche un échec ; moins de ${n(d.values.minimum)} ou plus de ${n(d.values.maximum)} caractères déclenche un avertissement. Ces bornes sont des heuristiques Argos.` : localizeValue("The HTML parser reads the received document title without executing JavaScript. A zero length triggers failure; fewer than {p0} or more than {p1} characters triggers a warning. These bounds are Argos heuristics.", lang).replaceAll("{p0}", () => String(n(d.values.minimum))).replaceAll("{p1}", () => String(n(d.values.maximum)))))
      : ((lang === "fr" ? 'Ce constat concerne le titre de la page. Le rapport ne permet pas de confirmer la méthode et les bornes de longueur appliquées lors de cette analyse.' : localizeValue('This finding concerns the page title. The report cannot confirm the method and length bounds applied during this analysis.', lang)));
    if (d) {
      result.observation = (lang === "fr" ? `Le titre HTML contient ${n(d.values.length)} caractères.` : localizeValue("The HTML title contains {p0} characters.", lang).replaceAll("{p0}", () => String(n(d.values.length))));
      if (d.result === 'MISSING_OR_EMPTY') result.title = (lang === "fr" ? 'Le titre HTML est absent ou vide' : localizeValue('The HTML title is absent or empty', lang));
      if (d.result === 'SHORT') result.title = (lang === "fr" ? 'Le titre HTML est très court' : localizeValue('The HTML title is very short', lang));
      if (d.result === 'LONG') result.title = (lang === "fr" ? 'Le titre HTML est long' : localizeValue('The HTML title is long', lang));
    }
    result.missingInformation = (lang === "fr" ? 'Emplacement à examiner : le titre du document reçu. Son texte exact n’est pas conservé dans cette preuve ; le retrouver dans la réponse HTML.' : localizeValue('Location to inspect: the received document title. Its exact text is not retained in this evidence; locate it in the HTML response.', lang));
  } else if (issue.id === 'html.images.alt_coverage') {
    result.detection = d
      ? ((lang === "fr" ? `Le parseur compte les img sans attribut alt dans le HTML reçu. Un alt vide est accepté. Toute absence déclenche un avertissement ; une proportion arrondie au plus égale à ${n(d.values.lowSeverityMaxPercent)} % donne une sévérité faible, au-delà une sévérité moyenne.` : localizeValue("The parser counts img elements without alt in received HTML. Empty alt is accepted. Any absence triggers a warning; a rounded proportion up to {p0}% has low severity, above it medium severity.", lang).replaceAll("{p0}", () => String(n(d.values.lowSeverityMaxPercent)))))
      : ((lang === "fr" ? 'Ce constat porte sur les attributs alt des images. Les compteurs éventuellement conservés ne suffisent pas à confirmer la méthode et les seuils appliqués lors de cette analyse.' : localizeValue('This finding concerns image alt attributes. Any retained counts cannot confirm the method and thresholds applied during this analysis.', lang)));
    if (d) {
      result.title = (lang === "fr" ? 'Des images n’ont pas d’attribut alt' : localizeValue('Images lack an alt attribute', lang));
      result.observation = (lang === "fr" ? `${n(d.values.missingAlt)} image(s) sans attribut alt parmi ${n(d.values.images)} images observées.` : localizeValue("{p0} image(s) without an alt attribute among {p1} observed images.", lang).replaceAll("{p0}", () => String(n(d.values.missingAlt))).replaceAll("{p1}", () => String(n(d.values.images))));
    }
    result.missingInformation = issue.structuredEvidence?.observed?.items.length ? undefined : (lang === "fr" ? 'L’emplacement exact des images n’est pas conservé par ce compteur HTML. Les retrouver dans la réponse reçue ; aucun chemin ou extrait de site n’est déduit de leur nombre.' : localizeValue('This HTML count does not retain exact image locations. Locate them in the received response; no site path or snippet is inferred from their number.', lang));
  } else if (issue.id === 'http.security.csp') {
    const observations: Record<string, [string, string]> = {
      HEADER_ABSENT: ['L’en-tête Content-Security-Policy est absent de la réponse HTTP finale examinée.', 'The Content-Security-Policy header is absent from the examined final HTTP response.'],
      HEADER_EMPTY: ['L’en-tête Content-Security-Policy est vide dans la réponse HTTP finale examinée.', 'The Content-Security-Policy header is empty in the examined final HTTP response.'],
      POLICY_UNRECOGNIZED: ['L’en-tête CSP est présent ; sa configuration restrictive n’est pas reconnue par le validateur Argos.', 'The CSP header is present; its restrictive configuration is not recognised by the Argos validator.'],
      POLICY_RECOGNIZED: ['Une configuration CSP restrictive est reconnue par le validateur Argos.', 'A restrictive CSP configuration is recognised by the Argos validator.'],
    };
    result.detection = d
      ? ((lang === "fr" ? 'Le collecteur HTTP examine Content-Security-Policy dans la réponse finale. Il accepte un sous-ensemble de sources script-src restrictives, ou default-src si script-src est absent. Une valeur vide, non reconnue ou un en-tête absent déclenche un avertissement ; Report-Only seul ne satisfait pas ce contrôle.' : localizeValue('The HTTP collector examines Content-Security-Policy in the final response. It accepts a subset of restrictive script-src sources, or default-src when script-src is absent. An empty or unrecognised value or absent header triggers a warning; Report-Only alone does not satisfy this check.', lang)))
      : source === 'zap' ? ((lang === "fr" ? 'La source conservée est ZAP. Sa règle et la réponse signalée doivent être vérifiées dans le diagnostic source ; le validateur HTTP Argos ne décrit pas cette observation.' : localizeValue('The retained source is ZAP. Its rule and reported response must be checked in the source diagnosis; the Argos HTTP validator does not describe this observation.', lang)))
        : ((lang === "fr" ? 'Ce constat concerne la politique CSP. Sans méthode enregistrée, ce rapport ne permet pas de distinguer avec certitude un en-tête absent, vide ou une configuration non reconnue.' : localizeValue('This finding concerns CSP. Without a recorded method, this report cannot reliably distinguish an absent or empty header from an unrecognised configuration.', lang)));
    if (d) {
      result.observation = localizeValue(observations[d.result][fr ? 0 : 1], lang);
      result.title = d.result === 'HEADER_ABSENT' ? ((lang === "fr" ? 'L’en-tête Content-Security-Policy est absent' : localizeValue('The Content-Security-Policy header is absent', lang)))
        : d.result === 'HEADER_EMPTY' ? ((lang === "fr" ? 'L’en-tête Content-Security-Policy est vide' : localizeValue('The Content-Security-Policy header is empty', lang)))
          : ((lang === "fr" ? 'La politique CSP nécessite une vérification' : localizeValue('The CSP policy needs review', lang)));
    }
    result.missingInformation = (lang === "fr" ? 'Périmètre à examiner : les en-têtes de la réponse concernée. La valeur brute de la politique n’est pas ajoutée à cette preuve.' : localizeValue('Scope to inspect: the affected response headers. The raw policy value is not added to this evidence.', lang));
  } else {
    result.detection = `${p.detection} ${d
      ? ((lang === "fr" ? `Lors de cette analyse, Argos a retenu un score ${n(d.values.score)} inférieur à ${n(d.values.scoreThreshold)}, parmi au plus ${n(d.values.maxFindings)} diagnostics classés par poids de catégorie puis par score.` : localizeValue("In this analysis, Argos selected a score of {p0} below {p1}, among at most {p2} diagnoses ordered by category weight, then score.", lang).replaceAll("{p0}", () => String(n(d.values.score))).replaceAll("{p1}", () => String(n(d.values.scoreThreshold))).replaceAll("{p2}", () => String(n(d.values.maxFindings)))))
      : ((lang === "fr" ? 'Le seuil de sélection et la version de cette analyse ne sont pas confirmés par cette fiche.' : localizeValue('This entry cannot confirm this analysis’s selection threshold and version.', lang)))}`;
    const measure = issue.structuredEvidence?.measurement;
    if (issue.id === 'lighthouse.audit.largest-contentful-paint') {
      result.observation = measure?.unit === 'ms' && Number.isFinite(measure.value) && measure.value >= 0
        ? ((lang === "fr" ? `LCP mesuré en laboratoire : ${n(measure.value)} ms.` : localizeValue("Laboratory LCP measurement: {p0} ms.", lang).replaceAll("{p0}", () => String(n(measure.value)))))
        : ((lang === "fr" ? 'Un signal LCP est conservé, mais sa durée est indisponible pour cette analyse. Le score normalisé n’est pas une durée.' : localizeValue('An LCP signal is retained, but its duration is unavailable for this analysis. The normalised score is not a duration.', lang)));
    }
    const observed = issue.structuredEvidence?.observed;
    result.missingInformation = observed?.version === 'observed-evidence-v1' && observed.source === 'lighthouse'
      && observed.state === 'AVAILABLE' && observed.items.length > 0
      ? ((lang === "fr" ? 'Les observations conservées sont présentées ci-dessous. Leur présence ne garantit pas que la décomposition des phases LCP soit disponible.' : localizeValue('Retained observations are shown below. Their presence does not guarantee that the LCP phase breakdown is available.', lang)))
      : ((lang === "fr" ? 'L’élément LCP et le détail des phases ne sont pas conservés dans cette preuve. Les retrouver dans la trace de cette URL avant de choisir une correction.' : localizeValue('This evidence does not retain the LCP element or phase details. Locate them in this URL’s trace before choosing a correction.', lang)));
  }
  return result;
}
