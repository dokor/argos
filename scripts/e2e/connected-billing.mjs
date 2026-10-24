import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../../apps/playwright-service/node_modules/playwright/index.mjs';
import {injectAxe} from './inject-axe.mjs';
import {variants} from '../../apps/console-web/src/components/connected/billing/fixtures/billing.mjs';
import {profile,usage,methods} from './ci-integrations-fixture.mjs';
const base=process.env.CONNECTED_BASE_URL??'http://127.0.0.1:3020';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output='outputs/ui-review/stripe-billing';await mkdir(output,{recursive:true});const browser=await chromium.launch(),results=[];
try{
 for(const width of [320,390,768,1440])for(const lang of ['fr','en'])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();const writes=[],errors=[],external=[];let mode='disabled',unknown=false,oauth=false;
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;let status=200,data={enabled:false,choice:'unset'};
   if(req.method()!=='GET')writes.push(path);
   if(path==='/api/account/me')data={...profile,email:oauth?null:profile.email};
   else if(path==='/api/account/usage')data={...usage,offer:'FREE'};
   else if(path==='/api/account/methods')data=oauth?[]:methods;
   else if(path==='/api/account/notifications')data={items:[],unread:0,cursor:'0',serverTime:'2026-10-19T12:00:00Z'};
   else if(path==='/api/account/csrf')data={csrf:'c'.repeat(43)};
   else if(path==='/api/account/auth/reauth')data={ok:true};
   else if(path==='/api/account/billing'){
     if(mode==='error'){status=503;data={error:'billing_unavailable',requestId:'73300000-0000-4000-8000-000000000001'};}
     else data=variants[mode];
   }else if(path==='/api/account/billing/checkout'){
     assert.deepEqual(Object.keys(req.postDataJSON()),['interval']);
     if(unknown){status=409;data={error:'billing_sync_pending',requestId:'73300000-0000-4000-8000-000000000001'};}
     else data={url:'https://checkout.stripe.com/c/pay/cs_test_fixture733'};
   }else if(path==='/api/account/billing/sync')data=variants.active;
   else if(path==='/api/account/billing/portal')data={url:'https://billing.stripe.com/p/session?secret=fixture_only'};
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.route('https://**/*',route=>{external.push(new URL(route.request().url()).origin);return route.fulfill({contentType:'text/html',body:'<h1>Fictional hosted payment destination</h1>'});});
  const path=(lang==='en'?'/en':'')+'/account/billing',tx=(fr,en)=>lang==='fr'?fr:en;
  async function capture(name){
    await page.getByRole('heading',{name:tx('Abonnement Premium','Premium subscription'),exact:true}).waitFor();
    await page.getByRole('heading',{name:tx('Votre souscription','Your subscription'),exact:true}).waitFor();
    await page.evaluate(()=>document.fonts.ready);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+'/'+width+'/'+lang);
    if((width===1440&&lang==='fr'&&theme==='light')||(width===390&&lang==='en'&&theme==='dark')){
      await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:output+'/'+name+'-'+width+'-'+lang+'-'+theme+'.png',fullPage:true});
    }
    results.push({name,width,lang,theme,overflow:false});
  }
  for(const name of ['disabled','active','ending','unpaid','refund','dispute','delayed','pending','expired','manual']){
    mode=name;await page.goto(base+path);await capture(name);
    if(name==='disabled'){
      await page.getByRole('heading',{name:tx('Paiements désactivés','Payments disabled'),exact:true}).waitFor();
      assert.equal(await page.getByText(tx('Tarif à confirmer','Price to be confirmed'),{exact:true}).count(),2);
      assert.ok(await page.getByRole('button',{name:tx('Continuer avec Stripe Checkout','Continue with Stripe Checkout'),exact:true}).isDisabled());
      assert.equal(writes.filter(p=>p.startsWith('/api/account/billing/')).length,0);
    }
    if(name==='pending')assert.ok(await page.getByRole('radio',{name:/Annuel|Annual/}).isDisabled());
  }
  mode='disabled';await page.goto(base+path+'?payment=return&customer=cus_forged');
  await page.getByRole('heading',{name:tx('Paiements désactivés','Payments disabled')}).waitFor();
  assert.equal(writes.filter(p=>p.startsWith('/api/account/billing/')).length,0);
  assert.deepEqual(external,[]);
  mode='error';await page.goto(base+path);await page.getByRole('heading',{name:tx('Action non confirmée','Action not confirmed')}).waitFor();
  assert.equal(await page.getByRole('button',{name:tx('Continuer avec Stripe Checkout','Continue with Stripe Checkout'),exact:true}).count(),0);
  mode='ready';await page.getByRole('button',{name:tx('Actualiser l’état','Refresh status'),exact:true}).click();
  const checkout=page.getByRole('button',{name:tx('Continuer avec Stripe Checkout','Continue with Stripe Checkout'),exact:true});await checkout.waitFor();await checkout.click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.ok(await checkout.evaluate(el=>el===document.activeElement));
  unknown=true;await checkout.click();const password=page.getByLabel(tx('Mot de passe actuel','Current password'),{exact:true});
  await password.fill('fixture password');await password.press('Enter');
  await page.getByRole('heading',{name:tx('Action non confirmée','Action not confirmed')}).waitFor();
  assert.equal(writes.filter(p=>p==='/api/account/billing/checkout').length,1);
  assert.equal(await page.getByRole('button',{name:tx('Continuer avec Stripe Checkout','Continue with Stripe Checkout'),exact:true}).count(),0);
  assert.deepEqual(external,[]);
  mode='disabled';await page.getByRole('button',{name:tx('Actualiser l’état','Refresh status'),exact:true}).click();
  await page.getByRole('heading',{name:tx('Paiements désactivés','Payments disabled')}).waitFor();
  await injectAxe(page);const violations=await page.evaluate(async()=>(await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
  assert.deepEqual(violations,[]);assert.deepEqual(errors,[]);
  // OAuth-only account: the server, not a local age estimate, checks recent sign-in.
  mode='ready';unknown=false;oauth=true;await page.goto(base+path);
  await page.getByRole('button',{name:tx('Continuer avec Stripe Checkout','Continue with Stripe Checkout'),exact:true}).click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByLabel(tx('Mot de passe actuel','Current password'),{exact:true}).count(),0);
  if((width===1440&&lang==='fr'&&theme==='light')||(width===390&&lang==='en'&&theme==='dark'))await page.screenshot({path:output+'/oauth-confirm-'+width+'-'+lang+'-'+theme+'.png',fullPage:true});
  const reauthBefore=writes.filter(p=>p==='/api/account/auth/reauth').length;
  await page.getByRole('button',{name:tx('Confirmer et continuer','Confirm and continue'),exact:true}).click();
  await page.getByRole('heading',{name:'Fictional hosted payment destination'}).waitFor();
  assert.deepEqual(external,['https://checkout.stripe.com']);
  assert.equal(writes.filter(p=>p==='/api/account/auth/reauth').length,reauthBefore);
  assert.equal(writes.filter(p=>p==='/api/account/billing/checkout').length,2);
  await context.close();
 }
 await writeFile(output+'/results.json',JSON.stringify({browser:browser.version(),cases:results},null,2));
 console.log(results.length+' Stripe billing UI cases passed; synthetic snapshots, no provider payment.');
}finally{await browser.close();}
