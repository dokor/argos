// Fictional read-only account data for the Clarté visual review. Never production seed data.
const date = "2026-10-13T10:42:00Z";
const profile = { profileId: "server-default-v1", contractVersion: 1, settingsProvenance: "COLLECTOR_DEFAULTS", scoringVersion: 12, scoringFingerprint: "fixture" };
const paths = ["/collections", "/", "/collections/automne", "/contact", "/livraison", "/catalogue/une-page-au-chemin-volontairement-long-pour-verifier-les-retours-a-la-ligne"];
const pages = paths.map((path, i) => ({ pageId: String(i + 1), runId: String(401 + i), normalizedUrl: "https://atelier.example" + path, executionStatus: "COMPLETED", completeness: i === 4 ? "PARTIAL" : "FULL", score: { value: 48 + i * 6, provisional: i === 4, reason: null }, coverage: { ratio: i === 4 ? .55 : 1, version: "fixture" }, criticalCount: 1, importantCount: 2, moduleStatuses: { http: "COMPLETED", ssl: i === 4 ? "FAILED" : "COMPLETED" }, failureReason: i === 4 ? "MODULE_FAILED" : null, reportAvailable: true }));
const attempt = page => ({ runId: page.runId, executionStatus: page.executionStatus, createdAt: date, finishedAt: date });
const counts = { selectedPages: 6, completePages: 5, partialPages: 1, failedPages: 0, canceledPages: 0, activePages: 0, priorityPages: 6, unknownPages: 0 };
const commonFindings = ["Script de navigation introuvable", "Image principale trop lourde", "Champ de formulaire sans nom accessible"].map((title, i) => ({ ruleKey: ["runtime.network.failed_requests", "lighthouse.audit.largest-contentful-paint", "lighthouse.audit.label"][i], definitionVersion: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", category: i === 2 ? "a11y" : "performance", provenance: [i ? "lighthouse" : "runtime"], severity: i ? "IMPORTANT" : "CRITICAL", titleKey: "fixture", title, impact: "Une ressource ou un élément limite le parcours observé.", recommendation: "Vérifier la ressource commune, corriger son intégration et relancer les pages concernées avec le même profil.", affectedPages: 6-i, evaluatedPages: 6, selectedPages: 6, examplePageIds: ["1","2","3","4","5"], evidenceAvailable: true, notEvaluatedPages: 0, exclusions: [] }));
const batch = { id: "201", domainId: "101", discoveryId: "301", hostname: "atelier.example", profileSnapshot: profile, createdAt: date, finishedAt: date, status: "PARTIAL", cancelRequested: false, counts, commonFindings, problematicPages: pages.slice(0,3), incompletePages: pages.slice(4,5), usage: { reserved: 0, counted: 6, released: 0 }, snapshotAt: date, version: 1, discovery: { eligiblePages: 6, excludedPages: 2, truncated: true, stopReason: "URL_LIMIT", effectiveLimits: { maxUrls: 6, maxDepth: 2, durationSeconds: 60, requestsPerHost: 2 } } };
export function connectedFixture(path, params, baseReport, usage) {
  if(path === "/api/account/admin/runs/401") return {id:"401",userId:"101",site:"atelier.example",status:"COMPLETED",createdAt:date,reportAvailable:true,modules:{http:"COMPLETED",ssl:"FAILED",observatory:"FAILED",zap:"FAILED"},failureCode:null,attempts:1};
  if(path === "/api/account/admin/runs/401/report") {
    const report=baseReport("review-partial");
    report.scores.coverage.checks.push(...["ssl","observatory"].map(module=>({key:module+".grade",domain:"security",module,weight:1,state:"UNAVAILABLE",reason:"POLICY_DISABLED",confidence:"HIGH"})));
    return report;
  }
  if(path === "/api/account/auth/providers") return {providers:[]};
  if(path === "/api/account/methods") return [{id:"1",provider:"password"}];
  if(path === "/api/account/sessions") return [{id:"1",createdAt:date,current:true}];
  if(path === "/api/account/domain-discoveries"||path === "/api/account/domain-batches") return [];
  if(path === "/api/account/analysis-profiles") return {defaultProfileId:"server-default-v1",items:[{id:"server-default-v1",label:"Default collectors",description:"Collector defaults",contractVersion:1,settingsProvenance:"COLLECTOR_DEFAULTS"}]};
  if(path === "/api/account/domains") return {items:params.get("query")&&!"atelier.example".includes(params.get("query"))?[]:[{id:"101",hostname:"atelier.example",latestBatchId:"201",latestAttemptAt:date,batchStatus:"PARTIAL",counts},{id:"102",hostname:"nouveau.example",latestBatchId:null,latestAttemptAt:null,batchStatus:null,counts:Object.fromEntries(Object.keys(counts).map(k=>[k,0]))}],total:2,limit:20,offset:0,snapshotAt:date};
  if(path === "/api/account/usage/events") return {period:params.get("period")??"2026-10",snapshotAt:date,limit:20,offset:0,total:6,items:pages.map((p,i)=>({runId:p.runId,batchId:i<4?"201":null,state:i===4?"RELEASED":i===5?"RESERVED":"COUNTED",period:"2026-10",createdAt:date,countedAt:i<4?date:null,releasedAt:i===4?date:null,url:p.normalizedUrl}))};
  const history=path.match(/^\/api\/account\/urls\/([1-6])\/history$/);
  if(history) {const p=pages[Number(history[1])-1];return {context:{siteId:"101",siteUrlId:p.pageId,normalizedUrl:p.normalizedUrl},items:[{runId:p.runId,status:"COMPLETED",createdAt:date,finishedAt:date,reportAvailable:true,publishedAt:date,expiresAt:null,globalScore:p.score.value,scoringVersion:12,coverage:1,provisional:false,comparison:null}],nextCursor:null};}
  if(path === "/api/account/overview") {
    const overviewPages = pages.map(page => ({ ...page, completeness: "PARTIAL", score: {...page.score, provisional:true}, coverage:{ratio:.82,version:"fixture"}, moduleStatuses:{http:"COMPLETED",ssl:"FAILED",observatory:"FAILED"}, collectionGaps:[{ruleKey:"ssl.grade",module:"ssl",reason:"POLICY_DISABLED"},{ruleKey:"observatory.grade",module:"observatory",reason:"POLICY_DISABLED"}] }));
    const tracked = overviewPages.map(page => ({ pageId: page.pageId, domainId: "101", hostname: "atelier.example", normalizedUrl: page.normalizedUrl, latestAttempt: attempt(page), latestAvailableReport: { runId: page.runId, publishedAt: date, expiresAt: null, score: page.score }, result: page }));
    const selected = tracked.filter(p => (!params.get("query") || p.normalizedUrl.includes(params.get("query"))) && (params.get("attention") !== "incomplete" || p.result.completeness !== "FULL"));
    return { snapshotAt: date, scope: "LATEST_ATTEMPT_PER_URL", trackedUrls: 6, priorityUrls: 6, incompleteUrls: 6, activeRuns: 0, usage, recentRuns: pages.map(p => ({ pageId:p.pageId, domainId:"101", hostname:"atelier.example", normalizedUrl: p.normalizedUrl, attempt: attempt(p) })), activeAttempts: [], priorityPages: tracked, pages: { items: selected, total: selected.length, limit: 6, offset: 0 } };
  }
  if(path === "/api/account/domains/101/batches/201") return batch;
  if(path === "/api/account/domains/101/batches/201/pages") return { items: pages, total: 6, limit: 100, offset: 0 };
  if(path === "/api/account/domains/101/batches") return { items: [batch], total: 1, limit: 5, offset: 0 };
  const match = path.match(/^\/api\/account\/runs\/(40[1-6])(\/report)?$/);
  if(!match) return undefined;
  const page = pages[Number(match[1])-401];
  if(!match[2]) return { status: "COMPLETED", siteId: "101", reportAvailability: "AVAILABLE", createdAt: date, startedAt: date, finishedAt: date, profileSnapshot: JSON.stringify(profile), historyContext: { siteUrlId: page.pageId, normalizedUrl: page.normalizedUrl } };
  const report = baseReport(page.completeness === "PARTIAL" ? "review-partial" : "review-complete");
  report.url = page.normalizedUrl;
  report.issues[0] = { ...report.issues[0], evidence: "LCP fictif : 4,9 secondes.", id: "lighthouse.audit.largest-contentful-paint", module: "lighthouse", structuredEvidence: { source: "lighthouse", measurement: { value: 4900, unit: "ms" } } };
  report.summary.priorities[0].findingKey = report.issues[0].id;
  report.scores.coverage.checks[0].key = report.issues[0].id;
  return report;
}
