import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const moduleRoot = resolve(root, 'apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules');
const rows = new Map();
for (const file of readdirSync(moduleRoot, {recursive:true}).filter(f=>f.endsWith('Analyzer.java')).sort()) {
  const path = resolve(moduleRoot, file), source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(/"((?:http|html|runtime|ssl|observatory|zap|tech)\.[a-z0-9_.-]+)"/g)) {
    const key=match[1]; if(key.endsWith('.')) continue;
    const line=source.slice(0,match.index).split('\n').length;
    if(!rows.has(key)) rows.set(key, {key, sources:[]});
    rows.get(key).sources.push(relative(root,path).replaceAll('\\','/')+':'+line);
  }
}
const policy=readFileSync(resolve(root,'apps/api-backend/src/main/java/com/dokor/argos/services/analysis/scoring/DefaultScorePolicy.java'),'utf8');
const rules=new Map([...policy.matchAll(/map.put\("([^"]+)",\s*rule\((true|false),\s*([\d.]+),\s*"([^"]+)"(?:,\s*"([^"]+)")?/g)].map(m=>[m[1],{scorable:m[2]==='true',weight:Number(m[3]),domain:m[4],owner:m[5]??m[4]}]));
for(const key of rules.keys()) if(!rows.has(key)) rows.set(key,{key,sources:[]});
for(const cat of ['performance','accessibility','best-practices','seo']) rows.set('lighthouse.score.'+cat,{key:'lighthouse.score.'+cat,sources:['apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/lighthouse/LighthouseModuleAnalyzer.java']});
const playbookText=readFileSync(resolve(root,'apps/console-web/src/components/report/findingPlaybooks.ts'),'utf8').replaceAll('\r\n','\n');
const start=playbookText.indexOf(' = [',playbookText.indexOf('export const playbookGroups'))+3;
const groups=JSON.parse(playbookText.slice(start,playbookText.indexOf(';\n\nexport const rulePlaybooks',start)));
const { detailedRuleGuidance } = await import(new URL('../apps/console-web/src/components/report/findingRuleGuidance.ts', import.meta.url));
const playbooks=Object.fromEntries([...groups, ...detailedRuleGuidance].flatMap(({keys,...entry})=>keys.map(key=>[key,entry])));
const facts = {
  http: 'Statut et valeur du contrôle ; détails assainis de la réponse, du parcours ou de la sonde. Temps et nombre de redirections ont une unité explicite. Pas de valeur de cookie publiée.',
  html: 'Snapshot HTML reçu sans exécution JS ; présence/état/valeur des métadonnées, longueur du titre, h1Count, imgCount et imgAltMissingCount, anchorCount et noHrefCount selon la clé.',
  runtime: 'Compteurs, attribution site/tiers si fournie, échantillon plafonné de ressources ; octets estimés. Navigation incomplète et champs absents restent indisponibles.',
  lighthouse: 'Note de catégorie sur 100 ; pour les audits, ratio score, catégorie, poids Lighthouse et numericValue/numericUnit si fournis ; échantillons observés optionnels.',
  ssl: 'Note, certificat, jours avant expiration ou protocoles par points de terminaison selon la clé ; couverture des points de terminaison éventuellement partielle.',
  observatory: 'Note et informations de sous-tests disponibles dans la réponse source ; ne pas inventer un sous-test absent.',
  zap: 'Identifiant de plugin, niveau de risque et éléments assainis disponibles ; une alerte passive ne démontre pas une exploitation.',
  tech: 'Indices du HTML/en-têtes et motifs de bannières ; ne pas en déduire une version installée certaine.',
};
const contract=readFileSync(resolve(root,'apps/api-backend/src/main/java/com/dokor/argos/services/analysis/MeasurementContract.java'),'utf8').match(/VERSION = "([^"]+)"/)[1];
const data=[...rows.values()].sort((a,b)=>a.key.localeCompare(b.key,'en')).map(row=>{
 const rule=rules.get(row.key),owner=rule?.owner??row.key.split('.')[0],p=playbooks[row.key];
 return {...row,...rule,collectorContract:contract,availableFacts:facts[owner],content:p?'specific-fr-en':'explicit-fallback-fr-en',
   detection:p?{fr:p.fr.detection,en:p.en.detection}:null,
   missingCollection:p?'La version exacte de la règle et des emplacements peuvent manquer dans un rapport historique.':'Méthode versionnée, seuil et élément concerné non décrits : repli explicite ; demander la source avant de prescrire une correction.',
   reference:p?.reference??null};
});
const output=resolve(root,'docs/report/rule-inventory.json');
if(process.argv.includes('--check')){
 if(readFileSync(output,'utf8').replaceAll('\r\n','\n').trim()!==JSON.stringify(data,null,2)) throw new Error('Rule inventory drift: run node scripts/report-rule-inventory.mjs');
 console.log('Rule inventory matches '+data.length+' static keys; Lighthouse has a separate versioned inventory; dynamic ZAP rules retain source guidance.');
}else{
 writeFileSync(output,JSON.stringify(data,null,2)+'\n');
 const table=data.map(r=>'| '+r.key+' | '+(r.owner??r.key.split('.')[0])+' | '+(r.weight??0)+' | '+r.content+' | '+(r.sources[0]??'Availability stub from orchestrator')+' |').join('\n');
 writeFileSync(resolve(root,'docs/report/rule-inventory.md'),'# Inventaire statique des règles\n\nGénéré par node scripts/report-rule-inventory.mjs depuis les analyseurs et la policy. Ne pas modifier manuellement. La clé renvoie aux textes FR/EN versionnés ; specific décrit une fiche détaillée, explicit-fallback indique que la méthode versionnée ou les éléments concernés restent à demander. Cela ne signifie pas une validation humaine.\n\nLes littéraux sont inventoriés de manière conservatrice, y compris contrôles informatifs et stubs non publiés. La condition exacte de déclenchement et les détails disponibles sont dans la source référencée et les fiches findingPlaybooks.ts et findingRuleGuidance.ts. Les clés dynamiques Lighthouse ont un inventaire séparé issu de la version installée : lighthouseAuditCatalogue.json couvre les modes publiables, lighthouse-rule-inventory.json inclut aussi les candidats manuels et informatifs. ZAP conserve la description et la solution de la règle source ; une solution absente reste explicitement indisponible. Ces identifiants dynamiques ne peuvent pas être énumérés à partir des seuls littéraux Java.\n\n| Clé | Propriétaire | Poids catalogue | Fiche | Source et ligne |\n| --- | --- | ---: | --- | --- |\n'+table+'\n');
 console.log('Wrote '+data.length+' static keys.');
}
