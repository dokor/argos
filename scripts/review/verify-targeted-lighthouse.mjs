// Executes installed Lighthouse audit classes with controlled gatherer/computed artifacts.
// This validates diagnosis construction, extraction and before/after selection; it does
// not claim to reproduce a live performance trace or a field-performance improvement.
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {lighthouseEvidence} from '../../apps/lighthouse-service/evidence.mjs';
const core=new URL('../../apps/lighthouse-service/node_modules/lighthouse/core/',import.meta.url);
const module=async path=>import(new URL(path,core));
const files=await readdir(new URL('audits/',core),{recursive:true});
const auditClass=async id=>(await module('audits/'+files.find(p=>p.replaceAll('\\','/').split('/').at(-1)===id+'.js'))).default;
const page='https://targeted.example/catalogue', script='https://targeted.example/assets/startup.js';
const node={path:'1,HTML,1,BODY,0,MAIN,0,BUTTON',devtoolsNodePath:'1,HTML,1,BODY,0,MAIN,0,BUTTON',selector:'main > button',nodeLabel:'button',snippet:'<button>Save</button>'};
const nodeItem={...node,type:'node'};
const element=(tag,parent='main')=>({selector:`${parent} > ${tag}`,nodeLabel:tag,snippet:`<${tag}>`});
const source={type:'source-location',url:script,line:2,column:4,urlProvider:'network'};
const request=url=>({args:{data:{url,protocol:'http/1.1'}}});
const results=[];
const originals=[];
let state={};
async function computed(path,name,fn) {const Class=(await module('computed/'+path+'.js'))[name]; originals.push([Class,Class.request]); Class.request=async(...args)=>fn(...args);}
await computed('main-resource','MainResource',()=>state.main??{url:page,statusCode:200,responseHeaders:[]});
await computed('js-bundles','JSBundles',()=>[]);
await computed('entity-classification','EntityClassification',()=>({isFirstParty:url=>url.startsWith('https://targeted.example/')}));
await computed('processed-trace','ProcessedTrace',()=>state.processed??{timeOriginEvt:{args:{data:{navigationId:'nav'}}}});
await computed('trace-engine-result','TraceEngineResult',()=>({insights:new Map([['nav',{navigation:{args:{data:{navigationId:'nav'}}},model:state.models??{},modelErrors:{},bounds:{min:0,max:1e7,range:1e7}}]]),data:state.traceData??{}}));
await computed('navigation-insights','NavigationInsights',()=>({model:state.models??{}}));
await computed('network-records','NetworkRecords',()=>state.records??[]);
await computed('main-thread-tasks','MainThreadTasks',()=>state.tasks??[]);
await computed('tbt-impact-tasks','TBTImpactTasks',()=>[]);
await computed('metrics/total-blocking-time','TotalBlockingTime',()=>({timing:state.fixed?30:1200}));
await computed('metrics/interactive','Interactive',()=>({timing:state.fixed?1500:12000}));
await computed('metrics/responsiveness','Responsiveness',()=>state.noInteraction?null:{args:{data:{duration:state.fixed?100:900}}});
await computed('metrics/cumulative-layout-shift','CumulativeLayoutShift',()=>({cumulativeLayoutShift:state.fixed?0:0.6,impactByNodeId:new Map(),layoutShiftEvents:[]}));
await computed('metrics/lantern-interactive','LanternInteractive',()=>({pessimisticEstimate:{nodeTimings:state.nodeTimings??new Map()}}));
const context=Audit=>({settings:{locale:'en-US',formFactor:'mobile',throttlingMethod:'provided',throttling:{cpuSlowdownMultiplier:1}},options:Audit.defaultOptions??{},computedCache:new Map()});
const base=()=>({URL:{requestedUrl:page,finalDisplayedUrl:page,mainDocumentUrl:page},SourceMaps:[],Scripts:[],DevtoolsLog:[],Trace:{traceEvents:[]},GatherContext:{gatherMode:'navigation'},HostDPR:1,
  TraceElements:[{traceEventType:'trace-engine',nodeId:1,node}]});
async function pair(id,make,options={}) {
 const Audit=await auditClass(id),observations=[];
 for(const fixed of [false,true]) {
  state={fixed,models:{}};
  const artifacts={...base(),...await make(fixed)};
  const product=options.run?await options.run(Audit,artifacts,context(Audit)):await Audit.audit(artifacts,context(Audit));
  const observed=lighthouseEvidence(product,page,id);
  observations.push({product,observed});
 }
 const [before,after]=observations;
 const resolved=before.observed.items.length>0||options.semanticTarget||options.related;
 const verified=before.product.score<0.9&&before.product.score!==null&&(after.product.score>=0.9||after.product.notApplicable||after.product.scoreDisplayMode==='notApplicable')&&!!resolved;
 results.push({id,method:options.method??'installed-audit-artifact-replay',semanticTarget:options.semanticTarget,related:options.related,change:options.change,verified,before,after});
 console.log(`${verified?'PASS':'CHECK'} ${id}: ${before.product.score} -> ${after.product.score}; targets=${before.observed.items.length}`);
}
async function insight(id,name,make,options={}) {await pair(id,fixed=>{state.models[name]={insightKey:name,state:fixed?'pass':'fail',...make(fixed)};return {};},options);}
try {
 await pair('canonical',fixed=>({LinkElements:[{rel:'canonical',source:'head',hrefRaw:fixed?page:'/catalogue',href:page}]}),{semanticTarget:'head > link[rel="canonical"] / Link',change:'Use an absolute canonical URL for this equivalent page'});
 await pair('charset',fixed=>({MainDocumentContent:fixed?'<meta charset="utf-8">':'<title>Demo</title>',MetaElements:fixed?[{charset:'utf-8'}]:[]}),{semanticTarget:'Content-Type / head > meta[charset]',change:'Declare UTF-8 near the start of the document'});
 await pair('http-status-code',fixed=>{state.main={url:page,statusCode:fixed?200:503};return {};},{semanticTarget:'Final document HTTP status',change:'Restore the route/upstream producing 503, retain real 404 for missing pages'});
 await pair('redirects-http',fixed=>({URL:{requestedUrl:'http://targeted.example/catalogue',finalDisplayedUrl:fixed?page:'http://targeted.example/catalogue'}}),{semanticTarget:'HTTP entry route and Location',change:'Redirect the HTTP route to its HTTPS equivalent'});
 await pair('crawlable-anchors',fixed=>({AnchorElements:[{rawHref:fixed?'/details':'javascript:void(0)',href:fixed?'https://targeted.example/details':'javascript:void(0)',attributeNames:['href'],node:element('a')}]}),{change:'Use a real href for navigation'});
 await pair('hreflang',fixed=>({LinkElements:[{source:'head',rel:'alternate',hreflang:fixed?'fr':'invalid',hrefRaw:page,href:page,node:element('link','head')}]}),{change:'Correct the language code on the alternate link'});
 await pair('is-crawlable',fixed=>({MetaElements:[{name:'robots',content:fixed?'index,follow':'noindex',node:element('meta','head')}],RobotsTxt:{content:'User-agent: *\nAllow: /'}}),{change:'Remove noindex only if this page is intended for indexing'});
 await pair('robots-txt',fixed=>({RobotsTxt:{status:200,content:fixed?'User-agent: *\nDisallow: /draft/':'User-agent: *\nDisallow: draft/'}}),{change:'Correct line 2 to a path beginning with /; preserve intentional exclusions'});
 await pair('paste-preventing-inputs',fixed=>({Inputs:{inputs:[{type:'text',node:element('input'),preventsPaste:!fixed}]}}),{change:'Remove preventDefault from the paste handler'});
 for(const [id,text] of [['geolocation-on-start','Only request geolocation in response to a user gesture.'],['notification-on-start','Only request notification permission in response to a user gesture.']])
  await pair(id,fixed=>({ConsoleMessages:fixed?[]:[{source:'violation',text,url:script,lineNumber:2,stackTrace:{callFrames:[{url:script,lineNumber:2,columnNumber:4}]}}]}),{change:'Move this request behind an explicit relevant user action'});
 await pair('deprecations',fixed=>({InspectorIssues:{deprecationIssue:fixed?[]:[{type:'PrefixedRequestAnimationFrame',sourceCodeLocation:{url:script,lineNumber:2,columnNumber:4}}]}}),{change:'Replace the deprecated API at the reported code position'});
 await pair('third-party-cookies',fixed=>({InspectorIssues:{cookieIssue:fixed?[]:[{cookie:{name:'demo',domain:'vendor.example',path:'/'},cookieUrl:'https://vendor.example/embed.js',cookieWarningReasons:['WarnThirdPartyPhaseout'],cookieExclusionReasons:[]}]}}),{change:'Update the integration to work when third-party cookies are blocked'});
 await pair('valid-source-maps',fixed=>({Scripts:[{scriptId:'one',url:script,length:600000}],SourceMaps:fixed?[{scriptId:'one',sourceMapUrl:script+'.map',map:{sources:['startup.ts'],sourcesContent:['export const demo=1;']}}]:[]}),{change:'Generate a matching source map for this bundle using the project publication policy'});
 await pair('bf-cache',fixed=>({HostProduct:'Chrome/140',BFCacheFailures:fixed?[]:[{notRestoredReasonsTree:{PageSupportNeeded:{UnloadHandlerExistsInMainFrame:[page]},SupportPending:{},Circumstantial:{}}}]}),{change:'Replace this page’s unload handler, then test backward/forward navigation'});
 for(const id of ['interactive','total-blocking-time','cumulative-layout-shift','interaction-to-next-paint'])
  await pair(id,()=>({}),{related:id==='cumulative-layout-shift'?'cls-culprits-insight':id==='interaction-to-next-paint'?'inp-breakdown-insight':'long-tasks',change:'Change the source demonstrated by the related diagnostic and repeat the same measurement'});
 for(const id of ['bootup-time','mainthread-work-breakdown']) await pair(id,fixed=>{
  state.tasks=[{selfTime:fixed?10:6000,attributableURLs:[script],group:{id:'scriptEvaluation'},children:[]}];state.records=[{url:script,resourceType:'Script'}];return {};
 },{related:id==='mainthread-work-breakdown'?'bootup-time':undefined,change:'Defer or split the expensive initialization in startup.js'});
 await insight('document-latency-insight','DocumentLatency',fixed=>({data:{checklist:{serverResponseIsFast:{label:'Server response',value:fixed}},serverResponseTime:fixed?100:1800,redirectDuration:0,uncompressedResponseBytes:0,documentRequest:request(page)}}),{semanticTarget:'Main document timing',change:'Reduce the demonstrated server wait, preserving private response caching rules'});
 await pair('server-response-time',fixed=>{state.models.DocumentLatency={data:{serverResponseTime:fixed?100:1800,documentRequest:request(page),checklist:{serverResponseIsFast:{value:fixed}}}};return {};},{change:'Optimize the handler or upstream responsible for the document response'});
 await insight('font-display-insight','FontDisplay',fixed=>({fonts:fixed?[]:[{request:request('https://targeted.example/assets/text.woff2'),wastedTime:350}]}),{change:'Change font-display on the @font-face referencing text.woff2'});
 await insight('forced-reflow-insight','ForcedReflow',fixed=>({aggregatedBottomUpData:fixed?[]:[{bottomUpData:{url:script,lineNumber:2,columnNumber:4},totalTime:350000}]}),{change:'Batch DOM reads before writes at this source position'});
 await insight('modern-http-insight','ModernHTTP',fixed=>({http1Requests:fixed?[]:[request(script)]}),{change:'Enable HTTP/2 or HTTP/3 on the resource origin and verify negotiation'});
 await insight('dom-size-insight','DOMSize',fixed=>({maxDOMStats:{args:{data:{totalElements:fixed?100:3000,maxDepth:{nodeId:1,depth:fixed?3:40},maxChildren:{nodeId:1,numChildren:fixed?10:2000}}}}}),{change:'Reduce rendered descendants of the identified container'});
 await insight('duplicated-javascript-insight','DuplicatedJavaScript',fixed=>({duplicationGroupedByNodeModules:new Map(fixed?[]:[['node_modules/demo',{estimatedDuplicateBytes:30000,duplicates:[{script:{url:script},attributedSize:30000},{script:{url:'https://targeted.example/assets/secondary.js'},attributedSize:30000}]}]])}),{change:'Share the duplicated dependency between these two bundles'});
 await insight('inp-breakdown-insight','INPBreakdown',fixed=>({longestInteractionEvent:{inputDelay:fixed?1000:500000,mainThreadHandling:50000,presentationDelay:10000,args:{data:{beginEvent:{args:{data:{nodeId:1}}}}}}}),{change:'Reduce input delay for this button; repeat the same interaction'});
 await insight('lcp-breakdown-insight','LCPBreakdown',fixed=>({subparts:{ttfb:{range:100000},renderDelay:{range:fixed?10000:1500000}},lcpEvent:{args:{data:{nodeId:1}}}}),{change:'Reduce the measured render delay for this LCP element'});
 // The byte-efficiency helpers calculate actual waste from source text. They do not simulate a trace.
 for(const [id,ext] of [['unminified-css','css'],['unminified-javascript','js']]) await pair(id,fixed=>{
  const content=fixed?(ext==='css'?'body{color:black}':'function demo(){return 1}'):(ext==='css'?'/* '+ 'unused comment '.repeat(4000)+' */ body { color: black; }':'/* '+'unused comment '.repeat(4000)+' */ function demo ( ) { return 1; }');
  return ext==='css'?{Stylesheets:[{header:{sourceURL:'https://targeted.example/assets/style.css',isInline:false},content}]}:{Scripts:[{url:script,content,startLine:0,startColumn:0,endLine:10,endColumn:0}]};
 },{run:async(Audit,a)=>{const r=await Audit.audit_(a,[]);return {score:r.items.length?0:1,details:{type:'table',headings:r.headings,items:r.items}};},method:'installed-byte-efficiency-calculation',change:'Minify the deployed stylesheet/script through the production build'});
 // Genuine producer helpers for complex trace diagnoses. The parent timing/score is a replay contract.
 const CLS=await auditClass('cls-culprits-insight'),event={};
 await pair('cls-culprits-insight',fixed=>({reviewFixed:fixed}),{method:'installed-diagnostic-helper',run:async(Audit,a)=>({score:a.reviewFixed?1:0,details:{type:'table',items:a.reviewFixed?[]:[{node:nodeItem,score:0.6,subItems:{type:'subitems',items:CLS.getCulpritSubItems({shifts:new Map([[event,{unsizedImages:[{backendNodeId:1}],webFonts:[request('https://targeted.example/assets/text.woff2')],iframes:[]}]])},event,a.TraceElements).items}}]}}),change:'Reserve the image area and stabilize the font causing the shift'});
 await pair('layout-shifts',fixed=>({reviewFixed:fixed}),{method:'legacy-diagnostic-contract',run:async(Audit,a)=>({score:a.reviewFixed?1:0,details:Audit.makeTableDetails([{key:'node',valueType:'node'}],a.reviewFixed?[]:[{node:nodeItem,score:0.6}])}),change:'Reserve space for the shifted element and inspect the preceding insertion'});
 const Third=await auditClass('third-parties-insight'),entity={name:'Demo vendor'};
 await pair('third-parties-insight',fixed=>({reviewFixed:fixed}),{method:'installed-diagnostic-helper',run:async(Audit,a)=>({score:a.reviewFixed?1:0,details:{type:'table',items:a.reviewFixed?[]:[{entity:'Demo vendor',subItems:{type:'subitems',items:Third.makeSubItems(entity,[{entity,url:'https://vendor.example/embed.js',mainThreadTime:400,transferSize:30000}])}}]}}),change:'Load this integration only when needed or remove it, then test its feature'});
 await pair('redirects',fixed=>{
  const chain=(fixed?[page]:['https://targeted.example/start','https://targeted.example/old',page]).map((url,i)=>({url,requestId:'r'+i,networkRequestTime:i*300}));
  chain.forEach((r,i)=>r.redirectDestination=chain[i+1]);state.records=chain;
  state.processed={processEvents:[{name:'navigationStart',args:{data:{documentLoaderURL:chain[0].url,isLoadingMainFrame:true,navigationId:'r0'}}}]};
  state.nodeTimings=new Map(chain.map((request,i)=>[{type:'network',request},{startTime:i*300}]));return {};
 },{change:'Point the old route directly at the canonical final URL'});
 const Total=await auditClass('total-byte-weight');
 await pair('total-byte-weight',fixed=>({reviewFixed:fixed}),{method:'diagnostic-contract',run:async(Audit,a)=>({score:a.reviewFixed?1:0,numericValue:a.reviewFixed?100000:6000000,numericUnit:'byte',details:Audit.makeTableDetails([{key:'url',valueType:'url'}],[{url:'https://targeted.example/assets/hero.webp',totalBytes:a.reviewFixed?100000:6000000}])}),change:'Resize and compress this hero image, compare transferred bytes with the same cache state'});
} finally {for(const [Class,request] of originals)Class.request=request;}
// Exact target expectations are independent of the extractor. A nonempty list
// (or a documentation URL mistaken for a resource) cannot satisfy this review.
const targets={
 'crawlable-anchors':['main > a'],'hreflang':['head > link'],'is-crawlable':['head > meta'],
 'paste-preventing-inputs':['main > input'],'robots-txt':['/robots.txt'],
 'geolocation-on-start':['/assets/startup.js'],'notification-on-start':['/assets/startup.js'],
 'deprecations':['/assets/startup.js'],'third-party-cookies':['/embed.js'],'valid-source-maps':['/assets/startup.js'],
 'bootup-time':['/assets/startup.js'],'font-display-insight':['/assets/text.woff2'],'forced-reflow-insight':['/assets/startup.js'],
 'modern-http-insight':['/assets/startup.js'],'dom-size-insight':['main > button'],
 'duplicated-javascript-insight':['/assets/startup.js','/assets/secondary.js'],'inp-breakdown-insight':['main > button'],
 'lcp-breakdown-insight':['main > button'],'unminified-css':['/assets/style.css'],'unminified-javascript':['/assets/startup.js'],
 'cls-culprits-insight':['main > button','/assets/text.woff2'],'layout-shifts':['main > button'],
 'third-parties-insight':['/embed.js'],'total-byte-weight':['/assets/hero.webp'],
};
for(const r of results) {
 r.expectedTargets=targets[r.id]??[];
 for(const target of r.expectedTargets) assert.ok(r.before.observed.items.some(i=>i.selector===target||i.resourcePath===target),`${r.id}: missing ${target}`);
 assert.ok(r.before.observed.items.every(i=>!i.origin||['https://targeted.example','https://vendor.example'].includes(i.origin)),r.id+': extraneous URL');
}
const get=id=>results.find(r=>r.id===id).before.observed.items;
assert.deepEqual(get('forced-reflow-insight')[0].metrics,{reflowTime:350,sourceLine:3,sourceColumn:5});
assert.equal(get('robots-txt')[0].metrics.sourceLine,2);
assert.equal(get('third-parties-insight')[0].metrics.mainThreadTime,400);
assert.equal(get('cls-culprits-insight')[0].metrics.layoutShiftScore,0.6);
assert.deepEqual(get('redirects').map(i=>i.metrics.navigationStep),[1,2,3]);
assert.equal(get('bootup-time')[0].metrics.duration,6000);
for(const id of ['bf-cache','server-response-time'])assert.equal(get(id)[0].locationScope,'ANALYSED_DOCUMENT');
await mkdir('outputs/targeted-rules',{recursive:true});
await writeFile('outputs/targeted-rules/lighthouse-results.json',JSON.stringify(results,null,2));
const failed=results.filter(r=>!r.verified);console.log(JSON.stringify({total:results.length,verified:results.length-failed.length,failed:failed.map(r=>r.id)}));
if(failed.length)process.exitCode=1;
