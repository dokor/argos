import { mockSessionRenewal } from './session-renewal-fixture.mjs';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from '../../apps/playwright-service/node_modules/playwright/index.mjs';
import {injectAxe} from './inject-axe.mjs';
import * as fixture from './ci-integrations-fixture.mjs';
const base=process.env.CONNECTED_BASE_URL??'http://127.0.0.1:3020';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output='outputs/ui-review/premium-ci-account';await mkdir(output,{recursive:true});
const catalog=JSON.parse(await readFile('apps/console-web/src/lib/ci-error-catalog.json','utf8'));
const browser=await chromium.launch(process.env.CLARTE_BROWSER_PATH?{executablePath:process.env.CLARTE_BROWSER_PATH}:{}),results=[];
try{
 for(const width of [320,390,768,1440])for(const lang of ['fr','en'])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,permissions:['clipboard-read','clipboard-write']}),page=await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-19T10:00:00Z'));
  const writes=[],requests=[],errors=[];let mode='normal',keys=structuredClone(fixture.keys),targets=[structuredClone(fixture.target)],reauthenticated=false;
  const tx=(fr,en)=>lang==='fr'?fr:en;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname;requests.push({path,method:req.method()});let data={},status=200;
    if(path==='/api/account/me')data=fixture.profile;
    else if(path==='/api/account/usage')data=fixture.usage;
    else if(path==='/api/account/notifications')data={items:[],unread:0,cursor:'0',serverTime:'2026-10-19T10:00:00Z'};
    else if(path==='/api/account/methods')data=fixture.methods;
    else if(path==='/api/account/csrf')data={csrf:'c'.repeat(43)};
    else if(path==='/api/account/ci/status'){
      data=mode==='closed'?{...fixture.status,enabled:false,eligible:false,limits:null}:fixture.status;
      if(mode==='error'){const {httpStatus,fr,en,...entry}=catalog.errors.FEATURE_NOT_AVAILABLE;void fr;void en;status=httpStatus;data={schemaVersion:1,requestId:fixture.targetId,error:{...entry,code:'FEATURE_NOT_AVAILABLE',retryAfterSeconds:null}};}
    }else if(path==='/api/account/ci/keys')data=mode==='empty'?{items:[],integrations:[],nextCursor:null}:mode==='states'?{...keys,items:[{...fixture.key,name:'Expired · '+ 'long '.repeat(10),expiresAt:'2026-10-18T10:00:00Z'}, {...fixture.key,id:'3'.repeat(32),name:'Revoked',revokedAt:'2026-10-18T10:00:00Z'}, {...fixture.key,id:'4'.repeat(32),name:'Overlap',overlapUntil:'2026-10-19T10:15:00Z',lastUsedAt:null}]}:keys;
    else if(path==='/api/account/ci/targets')data={items:mode==='empty'?[]:targets,nextCursor:null};
    if(req.method()!=='GET'){
      writes.push(path);
      if(path==='/api/account/auth/reauth'){reauthenticated=true;data={accepted:true};}
      else if(path.startsWith('/api/account/ci/')){
        assert.ok(reauthenticated,'Every browser mutation followed explicit reauthentication');reauthenticated=false;
        if(path==='/api/account/ci/keys'){
          const body=req.postDataJSON();assert.equal(body.targetIds.length,1);assert.deepEqual(body.scopes,['audits:write','results:read','usage:read']);
          const key={...fixture.issued.key,name:body.name};keys.items=[key,...keys.items];data={...fixture.issued,key};
        }else if(path==='/api/account/ci/targets'){
          const target={...fixture.target,state:'PENDING',verifiedAt:null,validUntil:null,challengeExpiresAt:'2026-10-20T10:00:00Z'};targets=[target];data={target,path:`/.well-known/argos-ci/${target.id}.txt`,content:'argos-ci-v1='+'x'.repeat(43)};
        }else if(path.endsWith('/verify')){targets=[fixture.target];data=fixture.target;}
        else if(path.endsWith('/rotate')){keys.items=[fixture.issued.key,{...fixture.key,overlapUntil:'2026-10-19T10:15:00Z'}];data=fixture.issued;}
        else if(path.startsWith('/api/account/ci/keys/')&&req.method()==='DELETE'){keys.items=keys.items.map(k=>k.id===path.split('/').at(-1)?{...k,revokedAt:'2026-10-19T10:00:00Z'}:k);data=keys.items.at(-1);}
      }
    }
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  await mockSessionRenewal(page);
  const url=base+(lang==='en'?'/en':'')+'/account/integrations';
  async function visit(){await page.goto(url);await page.getByRole('heading',{name:tx('Vos clés API','Your API keys'),exact:true}).waitFor();}
  async function check(name,dialog=false){
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('h1').count(),1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),name+': no page overflow');
    await injectAxe(page);const violations=await page.evaluate(async()=> (await window.axe.run(document.querySelector('[data-connected-shell]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));assert.deepEqual(violations,[],name);
    const filename=`${name}-${lang}-${theme}-${width}.png`;await page.screenshot({path:`${output}/${filename}`,fullPage:!dialog,mask:[page.locator('[data-ci-secret] pre')]});
    results.push({name,width,lang,theme,screenshot:filename,axeViolations:0,overflow:false,secretMasked:true});
  }
  async function confirm(){const dialog=page.getByRole('dialog');await dialog.getByLabel(tx('Mot de passe actuel','Current password')).fill('synthetic-password');await dialog.getByRole('button',{name:tx('Confirmer et continuer','Confirm and continue')}).click();}
  await visit();await check('keys');
  await page.getByRole('button',{name:tx('Créer une clé','Create key'),exact:true}).click();await page.getByLabel(tx('Nom de la clé','Key name')).fill('Déploiement · '+ 'long '.repeat(10));await page.getByRole('checkbox',{name:fixture.target.origin,exact:true}).check();await check('create');
  const actions=await page.getByRole('button',{name:tx('Continuer','Continue'),exact:true}).boundingBox(),cancel=await page.getByRole('button',{name:tx('Annuler','Cancel'),exact:true}).boundingBox();assert.ok(actions&&cancel&&Math.abs(actions.height-cancel.height)<=1,'Neighbouring actions have equal rendered heights');
  await page.getByRole('button',{name:tx('Continuer','Continue'),exact:true}).click();assert.equal(writes.length,0,'No mutation before reauthentication');await check('confirm',true);
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:tx('Continuer','Continue'),exact:true}).evaluate(el=>el===document.activeElement),true,'Cancel restores form focus');
  await page.getByRole('button',{name:tx('Continuer','Continue'),exact:true}).click();await confirm();await page.getByRole('heading',{name:tx('Copiez votre nouvelle clé maintenant','Copy your new key now')}).waitFor();await check('secret',true);
  await page.keyboard.press('Escape');assert.equal(await page.getByText(fixture.issued.credential,{exact:true}).count(),0,'Secret removed after dismissal');assert.equal(await page.locator('#ci-section-keys').evaluate(el=>el===document.activeElement),true,'Secret dismissal restores a stable control');
  await page.getByRole('button',{name:tx('Domaines autorisés','Allowed domains'),exact:true}).click();await check('domains');
  await page.getByLabel(tx('Origine HTTPS publique','Public HTTPS origin')).fill(fixture.target.origin);await page.getByRole('button',{name:tx('Préparer la preuve','Prepare proof'),exact:true}).click();await confirm();await page.getByRole('heading',{name:tx('Fichier à publier','File to publish')}).waitFor();await check('proof');
  await page.getByRole('button',{name:tx('Vérifier','Verify'),exact:true}).click();await confirm();await page.getByText(tx('Vérifié','Verified'),{exact:true}).waitFor();
  await page.getByRole('button',{name:tx('Configuration CI','CI configuration'),exact:true}).click();await page.getByRole('checkbox',{name:tx('Préparer la configuration optionnelle d’issues','Prepare optional issue configuration')}).check();
  await page.getByLabel(tx('Fournisseur','Provider'),{exact:true}).selectOption('gitlab');await page.getByLabel(tx('Chemin du dépôt/projet','Repository/project path')).fill('customer/site');await page.getByLabel(tx('ID numérique immuable du dépôt/projet','Immutable numeric repository/project ID')).fill('42');await page.getByLabel(tx('ID numérique du bot vérifié','Verified bot numeric ID')).fill('101');
  await page.getByRole('checkbox',{name:tx('J’autorise les constats catalogués et leurs empreintes dans les issues privées de cette destination.','I allow catalogued findings and their fingerprints in this destination’s private issues.')}).check();await page.getByLabel(tx('Mode de la configuration préparée','Prepared configuration mode')).selectOption('PREVIEW');
  const code=page.getByRole('region',{name:'ARGOS_PUBLICATION_CONFIG (JSON)'});await code.waitFor();assert.equal(JSON.parse(await code.innerText()).mode,'PREVIEW');
  await code.locator('..').getByRole('button',{name:tx('Copier','Copy'),exact:true}).click();assert.equal(JSON.parse(await page.evaluate(()=>navigator.clipboard.readText())).mode,'PREVIEW');await check('configuration');
  const counts=writes.length;await page.locator('section[aria-labelledby="ci-config-title"] details').first().locator('summary').click();await check('template');assert.equal(writes.length,counts,'Preparing/copying a configuration performs no write');
  if([320,1440].includes(width)){
    mode='empty';await visit();await page.getByText(tx('Aucune clé créée. Vérifiez votre domaine, puis créez une clé limitée à cette cible.','No keys yet. Verify your domain, then create a key limited to that target.')).waitFor();await check('empty');
    mode='states';await visit();await page.getByText(tx('Transition de rotation','Rotation overlap'),{exact:true}).waitFor();await check('key-states');
  }
  if(width===1440){
    mode='closed';await visit();assert.equal(await page.getByRole('button',{name:tx('Créer une clé','Create key'),exact:true}).isDisabled(),true);await check('closed');
    mode='error';await page.reload();await page.locator('main').getByRole('alert').waitFor();await check('error');mode='normal';await page.getByRole('button',{name:tx('Actualiser les lectures','Refresh reads')}).click();await page.getByRole('heading',{name:tx('Vos clés API','Your API keys'),exact:true}).waitFor();
    await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});await check('text-200');
  }
  assert.equal(requests.some(r=>r.path.startsWith('/api/ci/')||r.path==='/api/audits'||r.path==='/api/account/analyses'),false,'No machine admission, audit or Git request from the browser');assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(`${output}/results.json`,JSON.stringify({browser:browser.version(),fixture:'Controlled browser responses with invalid demonstration credential; not a production authorization, payment or hosted-provider test.',checks:results},null,2));console.log(`${results.length} Premium CI browser scenarios passed`);
}finally{await browser.close();}
