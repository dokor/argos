import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
// Read-only fictional reports for #532. Run from the repository root.
// Build/start console-web with API_BASE=http://127.0.0.1:3141, port 3142.
const root=path.resolve('apps/console-web');
const ts=createRequire(path.join(root,'package.json'))('typescript');
const source=fs.readFileSync(path.join(root,'src/components/marketing/reportDemoFixture.ts'),'utf8');
const {demoReport}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const complete=demoReport('fr');complete.scores.global=95;
const limited=structuredClone(complete);limited.scores.coverage.provisional=true;
Object.assign(limited.scores.coverage.domains.find(d=>d.key==='a11y'),{ratio:.4,sufficient:false});
const aggregate={id:'lighthouse.score.performance',categoryKey:'performance',module:'lighthouse',severity:'critical',title:'Performance score',impact:'Tool threshold',recommendation:'',confidence:'HIGH'};
const detail={id:'lighthouse.audit.unused-css-rules',categoryKey:'performance',module:'lighthouse',severity:'important',title:'Unused CSS',impact:'Tool diagnosis',recommendation:'',confidence:'HIGH'};
for(const report of [complete,limited]){report.issues.unshift(aggregate,detail);report.summary.priorities.unshift({severity:'critical',findingKey:aggregate.id,categoryKey:'performance',rank:7,title:aggregate.title,impact:aggregate.impact});}
const missing=structuredClone(limited);missing.issues=missing.issues.filter(f=>f.id!==detail.id);
const unavailable=structuredClone(complete);unavailable.scores.globalAvailable=false;unavailable.issues=[];unavailable.summary.priorities=[];
delete unavailable.measurements;
for(const item of [unavailable.scores.coverage.global,...unavailable.scores.coverage.domains])Object.assign(item,{ratio:0,available:false,sufficient:false});
const fixtures={complete,limited,missing,unavailable};
http.createServer((req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.statusCode=405;return res.end('{}');}
 const key=/^\/api\/reports\/review-532-(complete|limited|missing|unavailable)$/.exec(req.url)?.[1];
 if(key)return res.end(JSON.stringify(fixtures[key]));
 res.statusCode=404;res.end('{}');
}).listen(3141,'127.0.0.1',()=>console.log('Fictional reports ready on 3141: complete, limited, missing, unavailable'));
