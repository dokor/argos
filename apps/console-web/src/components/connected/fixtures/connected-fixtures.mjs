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
  if(path.startsWith("/api/account/admin/queue/tasks")) {
    const common={site:"atelier.example",userId:"101",resolvedUserId:"101",userDisplayName:"Camille démo",userEmail:"camille@atelier.example",createdAt:date,startedAt:null,finishedAt:null,waitSeconds:84,elapsedSeconds:null,pageCount:null,batchId:null,displayUrl:null,queuedChildren:null,runningChildren:null,snapshotAt:date,stuckSeconds:1200};
    const child={...common,type:"RUN",id:"401",batchId:"201",status:"RUNNING",diagnostic:"STALE",startedAt:date,elapsedSeconds:1400,displayUrl:"https://atelier.example/catalogue/collection-automne"};
    const tasks=[{...common,type:"DISCOVERY",id:"301",status:"QUEUED",diagnostic:"OBSERVED"},
      {...common,type:"BATCH",id:"201",status:"RUNNING",diagnostic:"STALE",startedAt:date,elapsedSeconds:1400,pageCount:3,queuedChildren:2,runningChildren:1,children:[child,{...child,id:"402",status:"QUEUED",diagnostic:"OBSERVED",startedAt:null,displayUrl:"https://atelier.example/contact"},{...child,id:"403",status:"QUEUED",diagnostic:"OBSERVED",startedAt:null,displayUrl:"https://atelier.example/livraison"}]},
      {...common,type:"RUN",id:"399",status:"QUEUED",diagnostic:"REQUEUED",site:"www.atelier.example",displayUrl:"https://www.atelier.example/une-page-au-chemin-volontairement-long-pour-verifier-la-lecture",userId:null,resolvedUserId:null}];
    const match=path.match(/\/tasks\/(DISCOVERY|BATCH|RUN)\/(\d+)$/);
    if(match) return tasks.find(row=>row.type===match[1]&&row.id===match[2])??child;
    const items=(params.get("type")==="RUN"?[...tasks.filter(row=>row.type==="RUN"),child]:tasks).filter(row=>(!params.get("type")||row.type===params.get("type"))&&(!params.get("status")||row.status===params.get("status"))&&(!params.get("site")||row.site===params.get("site"))&&(!params.get("user")||row.userId===(params.get("user")==="anonymous"?null:params.get("user"))));
    return {items,hasMore:false,page:Number(params.get("page")??1),snapshotAt:date,stuckSeconds:1200,counts:[{type:"DISCOVERY",queued:1,running:0},{type:"BATCH",queued:0,running:1},{type:"RUN",queued:3,running:1}]};
  }
  if(path === "/api/account/notifications") return {items:[
    {id:"3",type:"BATCH_PARTIAL",hostname:"atelier.example",count:6,createdAt:date,readAt:null,href:"/account/domains/101/batches/201"},
    {id:"2",type:"DISCOVERY_READY",hostname:"atelier.example",count:8,createdAt:date,readAt:null,href:"/account/domains/new?discovery=301"},
    {id:"1",type:"ANALYSIS_FAILED",hostname:"atelier.example",count:null,createdAt:date,readAt:date,href:"/account/runs/650"}
  ],unread:2,cursor:"3",serverTime:date};
  if(path === "/api/account/admin/traffic") return {enabled:true,from:"2026-10-01",until:"2026-10-16",views:480,visits:120,
    evolution:[{date:"2026-10-01",views:220,visits:60},{date:"2026-10-02",views:260,visits:60}],
    pages:[{value:"/",views:300},{value:"/faq",views:180}],sources:[{value:"direct",views:280},{value:"search",views:150},{value:"campaign",views:50}],languages:[{value:"fr",views:420},{value:"en",views:60}]};
  if(path === "/api/account/auth/providers") return {providers:["github","google","linkedin"],enabled:true};
  if(path === "/api/account/methods") return [{id:"1",provider:"password"},{id:"2",provider:"github"}];
  if(path === "/api/account/sessions") return [{id:"1",createdAt:date,current:true}];
  if(path === "/api/account/admin/events") return {items:[
    {id:"2",actorId:"900",targetId:"101",actorDisplayName:"Administration démo",actorEmail:"admin@atelier.example",targetDisplayName:null,targetEmail:"client@atelier.example",oldOffer:"FREE",newOffer:"PRO",oldLimit:null,newLimit:100,reasonCode:"PLAN_ADJUSTMENT",createdAt:date},
    {id:"1",actorId:"900",targetId:"102",actorDisplayName:"Administration démo",actorEmail:"admin@atelier.example",targetDisplayName:null,targetEmail:null,oldOffer:"FREE",newOffer:"FREE",oldLimit:100,newLimit:0,reasonCode:"ABUSE_REVIEW",createdAt:date}
  ],nextCursor:null};
  if(path === "/api/account/runs/650") return {status:"RUNNING",siteId:"101",createdAt:date,startedAt:date,reportAvailability:"PENDING",moduleStatuses:JSON.stringify([
    {id:"http",status:"COMPLETED"},{id:"html",status:"RUNNING"},{id:"runtime",status:"PENDING"},{id:"lighthouse",status:"FAILED"},{id:"ssl",status:"PARTIAL"},{id:"observatory",status:"TIMEOUT"},{id:"zap",status:"SKIPPED"},{id:"tech",status:"UNRECOGNIZED"}
  ])};

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
  if(path === "/api/account/domain-discoveries/limits") return {maxUrls:50,maxDepth:3,defaultUrls:20,defaultDepth:2,durationSeconds:60};
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
