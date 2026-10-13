import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../../apps/playwright-service/node_modules/playwright/index.mjs';
import {response,profile,methods,sessions} from './connected-account-fixture.mjs';
const base=process.env.CONNECTED_BASE_URL??'http://127.0.0.1:3020';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output='outputs/ui-review/clarte-account';await mkdir(output,{recursive:true});
const browser=await chromium.launch(process.env.CLARTE_BROWSER_PATH ? {executablePath:process.env.CLARTE_BROWSER_PATH}:{}),evidence=[];
try {
 for(const width of [320,390,768,1056,1440]) for(const lang of ['fr','en']) for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme}),page=await context.newPage();
  const errors=[],writes=[];let mode='normal',localMethods=structuredClone(methods),localProfile={...profile},localSessions=structuredClone(sessions),reauthFailure=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/account/**',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname;let status=200,data=response(path);
   if(path.endsWith('/csrf'))data={csrf:'c'.repeat(43)};
   if(path.endsWith('/me'))data=localProfile;
   if(path.endsWith('/methods'))data=localMethods;
   if(path.endsWith('/sessions'))data=localSessions;
   if(mode==='unavailable'&&path.endsWith('/auth/providers'))data={providers:[],enabled:true};
   if(mode==='load-error'&&path.endsWith('/methods')){status=503;data={error:'account_unavailable'};}
   if(mode==='denied'&&path.endsWith('/me')){status=401;data={error:'session_invalid'};}
   if(request.method()!=='GET') {
    const body=request.postDataJSON();writes.push({path,body});data={accepted:true};
    if(path.endsWith('/auth/reauth')&&reauthFailure){status=400;data={error:'token_invalid'};}
    if(path.endsWith('/me')&&request.method()==='PATCH')localProfile={...localProfile,...body};
    if(path.endsWith('/methods/password'))localMethods=[{id:'1',provider:'password'},...localMethods.filter(m=>m.provider!=='password')];
    if(path.endsWith('/methods/2/remove'))localMethods=localMethods.filter(m=>m.id!=='2');
    if(path.endsWith('/sessions/revoke-others'))localSessions=localSessions.filter(s=>s.current);
    if(path.endsWith('/auth/oauth/google/start')){status=503;data={error:'provider_unavailable'};}
   }
   if(!data){status=404;data={error:'resource_unavailable'};}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  const prefix=lang==='en' ? '/en':'',labels=lang==='fr' ? {profile:'Profil',security:'Sécurité',connections:'Connexions',save:'Enregistrer',close:'Fermer mon compte',cancel:'Annuler',confirm:'Confirmer et continuer',password:'Mot de passe actuel',newPassword:'Nouveau mot de passe',savePassword:'Enregistrer le mot de passe',others:'Révoquer les autres sessions'} : {profile:'Profile',security:'Security',connections:'Connections',save:'Save',close:'Close my account',cancel:'Cancel',confirm:'Confirm and continue',password:'Current password',newPassword:'New password',savePassword:'Save password',others:'Revoke other sessions'};
  async function visit(section='profile'){await page.goto(base+prefix+'/account/settings?section='+section);await page.getByRole('heading',{name:lang==='fr'?'Mon compte':'My account',exact:true}).waitFor();}
  async function check(name,dialog=false) {
   await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('footer').count(),1);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),name+': page overflow');
   if(dialog)assert.ok(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),name+': dialog overflow');
   await page.addScriptTag({path:'apps/console-web/node_modules/axe-core/axe.min.js'});
   const violations=await page.evaluate(async()=> (await window.axe.run(document.querySelector('[data-connected-shell]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
   assert.deepEqual(violations,[],name);const file=`${name}-${lang}-${theme}-${width}.png`;await page.screenshot({path:`${output}/${file}`,fullPage:!dialog});evidence.push({name,lang,theme,width,screenshot:file,axeViolations:0,overflow:false});
  }
  await visit();await page.getByLabel(lang==='fr'?'Nom d’affichage':'Display name').waitFor();await check('profile');
  await page.getByLabel(lang==='fr'?'Nom d’affichage':'Display name').fill('Camille · Modifié');await page.getByRole('button',{name:labels.save,exact:true}).click();
  await page.getByRole('status').filter({hasText:lang==='fr'?'Opération effectuée.':'Action completed.'}).waitFor();
  assert.equal(localProfile.displayName,'Camille · Modifié');
  const settingsNav=page.getByRole('navigation',{name:lang==='fr'?'Réglages du compte':'Account settings'});
  await settingsNav.getByRole('link',{name:labels.security,exact:true}).click();await page.getByLabel(labels.newPassword).waitFor();await check('security');
  assert.ok((await page.getByRole('link',{name:lang==='fr'?'English':'Français',exact:true}).getAttribute('href')).endsWith('settings?section=security'));
  await page.getByLabel(labels.newPassword).fill('synthetic next password');await page.getByRole('button',{name:labels.savePassword,exact:true}).click();
  let dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(writes.filter(w=>w.path.endsWith('methods/password')).length,0);
  await dialog.getByLabel(labels.password).fill('synthetic current password');await dialog.getByRole('button',{name:labels.confirm}).click();
  await dialog.waitFor({state:'hidden'});assert.equal(writes.filter(w=>w.path.endsWith('methods/password')).length,1);
  const last=writes.slice(-2).map(w=>w.path);assert.deepEqual(last,['/api/account/auth/reauth','/api/account/methods/password']);
  await settingsNav.getByRole('link',{name:labels.connections,exact:true}).click();await page.getByRole('button',{name:lang==='fr'?'Associer Google':'Link Google'}).waitFor();await check('connections');
  assert.equal(await page.getByText('LinkedIn',{exact:true}).count(),0,'Unconfigured and unlinked providers are absent');
  await page.getByRole('button',{name:lang==='fr'?'Retirer GitHub':'Remove GitHub'}).click();await page.getByRole('dialog').getByLabel(labels.password).fill('synthetic password');await page.getByRole('dialog').getByRole('button',{name:labels.confirm}).click();
  await page.getByRole('button',{name:lang==='fr'?'Associer GitHub':'Link GitHub'}).waitFor();
  if([320,1440].includes(width)) {
   await visit('security');await page.getByRole('button',{name:labels.close,exact:true}).waitFor();
   const trigger=page.getByRole('button',{name:labels.close,exact:true});await trigger.focus();await page.keyboard.press('Enter');dialog=page.getByRole('dialog');await dialog.waitFor();await check('archive-confirm',true);
   assert.equal(await dialog.getByRole('button',{name:labels.confirm}).isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
   assert.equal(writes.filter(w=>w.path.endsWith('me/archive')).length,0);
   localMethods=[{id:'2',provider:'github'}];await visit('security');await page.getByLabel(labels.newPassword).fill('synthetic password');await page.getByRole('button',{name:labels.savePassword}).click();dialog=page.getByRole('dialog');
   assert.equal(await dialog.getByLabel(labels.password).count(),0);await dialog.getByRole('button',{name:lang==='fr'?'Recevoir un code':'Send me a code'}).click();await dialog.getByRole('status').waitFor();await check('email-reauth',true);
   reauthFailure=true;await dialog.getByLabel(lang==='fr'?'Code reçu par email':'Email confirmation code').fill('synthetic-code');await dialog.getByRole('button',{name:labels.confirm}).click();await dialog.getByRole('alert').waitFor();await check('reauth-error',true);
   assert.equal(writes.filter(w=>w.path.endsWith('methods/password')).length,1);reauthFailure=false;await dialog.getByRole('button',{name:labels.cancel}).click();
   mode='unavailable';await visit('connections');await page.getByText(lang==='fr'?'Associé, mais fournisseur temporairement indisponible':'Linked, but provider temporarily unavailable').waitFor();await check('provider-unavailable');
   mode='normal';localProfile={...profile,verified:false,email:null};await visit();await page.getByRole('button',{name:lang==='fr'?'Envoyer l’email de vérification':'Send verification email'}).waitFor();await check('email-required');
   localProfile={...profile};mode='load-error';await visit();await page.locator('main').getByRole('alert').waitFor();await check('load-error');mode='normal';await page.getByRole('button',{name:lang==='fr'?'Réessayer':'Try again',exact:true}).click();await page.getByLabel(lang==='fr'?'Nom d’affichage':'Display name').waitFor();
   await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});await check('text-200');
   mode='denied';await page.reload();await page.getByRole('heading',{name:lang==='fr'?'Connectez-vous à votre espace':'Sign in to your workspace'}).waitFor();assert.equal(await page.getByText(profile.email,{exact:true}).count(),0);await check('session-expired');
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(`${output}/results.json`,JSON.stringify({browser:browser.version(),fixtures:'Synthetic browser responses; identity authorization remains covered by AccountLifecycleIT and OAuth tests, not by this mocked recipe.',checks:evidence},null,2));
 console.log(`${evidence.length} Clarte account scenarios passed`);
}finally{await browser.close();}
