import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.resolve('apps/console-web'),require=createRequire(path.join(root,'package.json')),ts=require('typescript');
const source=fs.readFileSync(path.join(root,'src/components/marketing/reportDemoFixture.ts'),'utf8');
const {demoReport}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
const report=demoReport('fr');
report.domain='atelier.example';report.generatedAt='2026-10-15T10:42:00Z';
report.url='https://atelier.example/collection/sac-en-coton';report.pageIdentity={requested:report.url,destination:report.url,redacted:false,redirected:false};
report.scores.global=64;
report.scores.byCategory.forEach((d,i)=>d.score=[48,63,82,72][i]);
report.issues=[
{id:'runtime.lcp',categoryKey:'performance',severity:'critical',title:'Le contenu principal s’affiche trop tard',impact:'Les visiteurs attendent avant de pouvoir consulter la page.',evidence:'LCP : 4,2 s',recommendation:'Optimiser l’image principale.'},
{id:'http.security.csp',categoryKey:'security',severity:'important',title:'La politique de sécurité du contenu est absente',impact:'Le navigateur ne dispose pas de cette protection complémentaire.',evidence:'CSP absent',recommendation:'Définir une politique adaptée.'},
{id:'html.images.alt_coverage',categoryKey:'a11y',severity:'important',title:'Des images n’ont pas d’alternative textuelle',impact:'Une partie de l’information échappe aux lecteurs d’écran.',evidence:'3 images',recommendation:'Décrire les images informatives.'},
{id:'html.meta.description',categoryKey:'seo',severity:'info',title:'Ajouter une description à la page produit',impact:'Aider à comprendre le contenu de cette page.',recommendation:'Rédiger une description.'},
{id:'runtime.page_weight',categoryKey:'performance',severity:'info',title:'Réduire le poids des ressources',impact:'Alléger le chargement sur les connexions mobiles.',recommendation:'Compresser les images.'}
];
report.summary.priorities=report.issues.map((i,n)=>({severity:i.severity==='info'?'opportunity':i.severity,title:i.title,impact:i.impact,categoryKey:i.categoryKey,findingKey:i.id,rank:n+1,effort:'S'}));
report.access='full';
export {report};
export function publicReport(value=report){return {...value,access:'summary',issues:value.issues.map(i=>({...i,evidence:null,recommendation:null,structuredEvidence:null})),introduction:null};}
const port=Number(process.env.REPORT_FIXTURE_PORT||3018);
const app='http://localhost:3040';
http.createServer((req,res)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
 const p=new URL(req.url,'http://localhost').pathname;
 if(req.method!=='GET'){res.statusCode=405;return res.end('{}');}
 if(p==='/preview-owner'){res.writeHead(302,{'Set-Cookie':'argos_account=synthetic-visual-session; Path=/; HttpOnly; SameSite=Lax',Location:app+'/account/runs/644'});return res.end();}
 if(p==='/api/account/me')return res.end(JSON.stringify({verified:true,displayName:'Atelier',email:'fixture@example.test'}));
 if(p==='/api/account/usage')return res.end(JSON.stringify({available:20,used:1,limit:21}));
 if(p==='/api/account/runs/644')return res.end(JSON.stringify({id:'644',status:'COMPLETED',reportAvailability:'AVAILABLE',site:'atelier.example',normalizedUrl:report.url,createdAt:report.generatedAt}));
 if(p==='/api/account/runs/644/report'||p.startsWith('/api/account/reports/')||p.startsWith('/api/account/shared-reports/'))return res.end(JSON.stringify(report));
 if(p.startsWith('/api/reports/'))return res.end(JSON.stringify(publicReport()));
 res.statusCode=404;res.end('{}');
}).listen(port,'127.0.0.1',()=>console.log('Read-only fictional report fixtures on '+port));
