import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const code=value=>typeof value==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(value)?value:'UNKNOWN';
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-6;
const states=new Set(['MEASURED','UNAVAILABLE','BLOCKED_BY_ANTIBOT','NOT_APPLICABLE']);
const missing=row=>['UNAVAILABLE','BLOCKED_BY_ANTIBOT'].includes(row.state);

function aggregateEvidence(aggregate, checks) {
  const expected=checks.filter(row=>row.state!=='NOT_APPLICABLE').reduce((sum,row)=>sum+row.weight,0);
  const measured=checks.filter(row=>row.state==='MEASURED').reduce((sum,row)=>sum+row.weight,0);
  const computedRatio=aggregate.expectedWeight>0?aggregate.measuredWeight/aggregate.expectedWeight:0;
  const valid=checks.every(row=>states.has(row.state)&&Number.isFinite(row.weight)&&row.weight>=0)
    &&new Set(checks.map(row=>row.key)).size===checks.length
    &&Number.isFinite(aggregate.expectedWeight)&&aggregate.expectedWeight>=0
    &&Number.isFinite(aggregate.measuredWeight)&&aggregate.measuredWeight>=0
    &&aggregate.measuredWeight<=aggregate.expectedWeight
    &&Number.isFinite(aggregate.ratio)&&aggregate.ratio>=0&&aggregate.ratio<=1;
  return {computedRatio, reconciled:valid&&close(expected,aggregate.expectedWeight)
    &&close(measured,aggregate.measuredWeight)&&close(computedRatio,aggregate.ratio)};
}

export function explainCoverage(report) {
  if(!report||typeof report!=='object')return {available:false,reason:'COVERAGE_NOT_RETAINED'};
  // Both published ReportDto and frozen AuditRun.result_json; never compose a new report.
  const c=report.scores?.coverage??report.score?.coverage??report.coverage;
  if(!c?.global||!Array.isArray(c.checks)) return {available:false,reason:'COVERAGE_NOT_RETAINED'};
  if(c.checks.some(row=>!row||typeof row!=='object')||(c.domains!=null&&!Array.isArray(c.domains)))
    return {available:false,reason:'COVERAGE_INVALID'};
  const total=c.global.expectedWeight;
  const evidence=aggregateEvidence(c.global,c.checks);
  const domains=(c.domains??[]).map(domain=>({key:code(domain.key),measuredWeight:domain.measuredWeight,
    expectedWeight:domain.expectedWeight,recordedRatio:domain.ratio,
    ...aggregateEvidence(domain,c.checks.filter(row=>row.domain===domain.key))}));
  return {available:true,version:code(c.version),measuredWeight:c.global.measuredWeight,expectedWeight:total,recordedRatio:c.global.ratio,
    roundedPercent:Math.round(c.global.ratio*100),...evidence,
    reconciled:evidence.reconciled&&domains.every(domain=>domain.reconciled),
    missingPercentagePoints:(1-c.global.ratio)*100,
    fullyMeasured:total>0&&evidence.reconciled&&domains.every(domain=>domain.reconciled)
      &&c.global.measuredWeight===total&&!c.checks.some(row=>row.confidence==='PARTIAL'),
    partialChecks:c.checks.filter(row=>row.confidence==='PARTIAL').length,domains,
    checks:c.checks.map(row=>({key:code(row.key),domain:code(row.domain),owner:code(row.module),source:code(row.measurementModule),
      sources:(row.measurementSources??[]).map(code),weight:row.weight,state:code(row.state),reason:code(row.reason),confidence:code(row.confidence),
      missingPercentagePoints:missing(row)&&total>0?row.weight/total*100:0}))};
}

/** Only compare recurrence within the same persisted methodology. No target, run ID or raw metadata leaves this function. */
export function summarizeCoverage(reports) {
  const groups=new Map();
  let unavailable=0;
  reports.forEach((report,index)=>{
    const result=explainCoverage(report);
    if(!result.available){unavailable++;return;}
    const calculation=report.scores?.calculation??report.score??{};
    const measurement=calculation.measurementFingerprint??report.meta?.measurementFingerprint;
    const retained=typeof calculation.scoringFingerprint==='string'&&!!calculation.scoringFingerprint
      &&typeof measurement==='string'&&!!measurement;
    // Fingerprints are used privately for grouping, never copied into the output.
    const identity=JSON.stringify([result.version,calculation.scoringVersion??null,
      calculation.scoringFingerprint??null,measurement??null,retained?null:index]);
    if(!groups.has(identity))groups.set(identity,{methodology:groups.size+1,version:result.version,
      scoringVersion:Number.isInteger(calculation.scoringVersion)?calculation.scoringVersion:null,
      methodologyRetained:retained,
      samples:0,inconsistentSamples:0,rounded96:0,exact96:0,fullyMeasured:0,rounded100ButIncomplete:0,
      ratios96:[],missingChecks:new Map()});
    const group=groups.get(identity);group.samples++;
    if(!result.reconciled){group.inconsistentSamples++;return;}
    if(result.fullyMeasured)group.fullyMeasured++;
    if(result.roundedPercent===100&&!result.fullyMeasured)group.rounded100ButIncomplete++;
    if(result.roundedPercent!==96)return;
    group.rounded96++;
    if(result.recordedRatio===0.96)group.exact96++;
    group.ratios96.push(result.recordedRatio);
    result.checks.filter(row=>row.missingPercentagePoints>0).forEach(row=>{
      const key=JSON.stringify([row.key,row.owner,row.source,row.sources,row.reason,row.state,row.weight]);
      if(!group.missingChecks.has(key))group.missingChecks.set(key,{key:row.key,owner:row.owner,source:row.source,
        sources:row.sources,reason:row.reason,state:row.state,weight:row.weight,samples:0,points:[]});
      const check=group.missingChecks.get(key);check.samples++;check.points.push(row.missingPercentagePoints);
    });
  });
  return {samples:reports.length,unavailable,groups:[...groups.values()].map(({ratios96,missingChecks,...group})=>({...group,
    ratioRange96:ratios96.length?[Math.min(...ratios96),Math.max(...ratios96)]:null,
    missingChecks96:[...missingChecks.values()].map(({points,...row})=>({...row,
      percentageOf96Samples:row.samples/group.rounded96*100,missingPointsRange:[Math.min(...points),Math.max(...points)]}))}))};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),cohort=args[0]==='--cohort',files=cohort?args.slice(1):args;
 if(!files.length){console.error('Usage: node scripts/explain-coverage.mjs [--cohort] <frozen-report.json> [other-report.json]');process.exitCode=1;}
 else {
   const reports=[];
   files.forEach((file,index)=>{
     try {reports.push(JSON.parse(readFileSync(file,'utf8')));}
     // File paths and JSON parser messages can contain private identities or payloads.
     catch {console.error(`Sample ${index+1}: INPUT_UNREADABLE`);process.exitCode=1;}
   });
   if(!process.exitCode){
     if(cohort)console.log(JSON.stringify(summarizeCoverage(reports),null,2));
     else reports.forEach((report,index)=>console.log(JSON.stringify({sample:index+1,...explainCoverage(report)},null,2)));
   }
 }
}
