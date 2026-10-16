import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const code=value=>typeof value==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(value)?value:'UNKNOWN';
export function explainCoverage(report) {
  const c=report.scores?.coverage??report.coverage;
  if(!c?.global||!Array.isArray(c.checks)) return {available:false,reason:'COVERAGE_NOT_RETAINED'};
  const total=c.global.expectedWeight;
  const expected=c.checks.filter(row=>row.state!=='NOT_APPLICABLE').reduce((sum,row)=>sum+row.weight,0);
  const measured=c.checks.filter(row=>row.state==='MEASURED').reduce((sum,row)=>sum+row.weight,0);
  return {available:true,version:code(c.version),measuredWeight:c.global.measuredWeight,expectedWeight:total,recordedRatio:c.global.ratio,
    roundedPercent:Math.round(c.global.ratio*100),reconciled:Math.abs(expected-total)<1e-6&&Math.abs(measured-c.global.measuredWeight)<1e-6,
    checks:c.checks.map(row=>({key:code(row.key),domain:code(row.domain),owner:code(row.module),source:code(row.measurementModule),
      sources:(row.measurementSources??[]).map(code),weight:row.weight,state:code(row.state),reason:code(row.reason),confidence:code(row.confidence),
      missingPercentagePoints:['UNAVAILABLE','BLOCKED_BY_ANTIBOT'].includes(row.state)&&total>0?row.weight/total*100:0}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const files=process.argv.slice(2);
 if(!files.length){console.error('Usage: node scripts/explain-coverage.mjs <frozen-report.json> [other-report.json]');process.exitCode=1;}
 else files.forEach((file,index)=>{const result=explainCoverage(JSON.parse(readFileSync(file,'utf8')));console.log(JSON.stringify({sample:index+1,...result},null,2));});
}
