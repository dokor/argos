import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../../apps/playwright-service/node_modules/playwright/index.mjs';
const base=process.env.CONNECTED_BASE_URL??'http://127.0.0.1:3000';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output='outputs/ui-review/clarte-admin/real';await mkdir(output,{recursive:true});
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1056,height:900}}),regular=await browser.newContext();
const csrf='c'.repeat(43);
async function cookies(ctx,session){assert.ok(session);await ctx.addCookies([{name:'argos_account',value:session,url:base,httpOnly:true},{name:'argos_account_csrf',value:csrf,url:base,httpOnly:true}]);}
await cookies(context,process.env.ADMIN_FIXTURE_SESSION);await cookies(regular,process.env.ADMIN_TARGET_SESSION);
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
async function api(ctx,path,method='GET',data){return ctx.request.fetch(base+'/api/account/'+path,{method,data,headers:method==='GET'?{}:{Origin:base,'X-Argos-CSRF':csrf}});}
async function confirm(reason){const d=page.getByRole('dialog');await d.getByLabel('Motif de la modification').selectOption(reason);await d.getByRole('checkbox').check();await d.getByRole('button',{name:'Confirmer la modification',exact:true}).click();return d;}
try {
 assert.equal((await api(regular,'admin/users')).status(),403);
 await page.goto(base+'/account/admin/users?q=domain-fixture');
 await page.getByRole('link',{name:'Gérer le compte Domain fixture'}).click();
 await page.getByLabel('Plafond individuel par mois').waitFor();
 const initial=await (await api(context,'admin/users/70')).json(),committed=initial.usage.used+initial.usage.reserved;
 assert.ok(committed>0);
 await page.getByLabel('Plafond individuel par mois').fill(String(committed+5));
 await page.getByRole('button',{name:'Vérifier la modification'}).click();
 const dialog=await confirm('PLAN_ADJUSTMENT');
 await dialog.getByLabel('Mot de passe actuel').fill('a long synthetic fixture passphrase');
 await dialog.getByRole('button',{name:'Confirmer la modification',exact:true}).click();
 await page.getByText('Modification enregistrée et journalisée.',{exact:true}).waitFor();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 const updated=await (await api(context,'admin/users/70')).json();assert.equal(updated.monthlyLimit,committed+5);assert.equal(updated.version,initial.version+1);
 const stale=await api(context,'admin/users/70/entitlement','PATCH',{offer:initial.offer,monthlyLimit:100,expectedVersion:initial.version,reasonCode:'PLAN_ADJUSTMENT',confirmation:true});assert.equal(stale.status(),409);
 const below=await api(context,'admin/users/70/entitlement','PATCH',{offer:updated.offer,monthlyLimit:0,expectedVersion:updated.version,reasonCode:'PLAN_ADJUSTMENT',confirmation:true});assert.equal(below.status(),409);
 assert.equal((await (await api(context,'admin/users/70/events')).json()).items.length,1);
 await page.getByRole('button',{name:'Suspendre le compte',exact:true}).click();await confirm('ABUSE_REVIEW');await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Rétablir l’accès',exact:true}).waitFor();
 assert.equal((await api(regular,'auth/renew','POST',{})).status(),401);
 assert.equal((await (await api(context,'admin/users/70')).json()).state,'SUSPENDED');
 await page.getByRole('button',{name:'Rétablir l’accès',exact:true}).click();await confirm('ACCOUNT_RECOVERY');await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Suspendre le compte',exact:true}).waitFor();
 assert.equal((await api(regular,'me')).status(),401);
 const final=await (await api(context,'admin/users/70')).json(),events=await (await api(context,'admin/users/70/events')).json();
 assert.equal(final.state,'ACTIVE');assert.equal(events.items.length,3);assert.equal(final.usage.used,initial.usage.used);assert.equal(final.usage.reserved,initial.usage.reserved);
 await page.screenshot({path:output+'/detail.png',fullPage:true});
 await page.getByRole('link',{name:'Tous les comptes',exact:true}).click();await page.waitForURL(base+'/account/admin/users?q=domain-fixture');
 assert.equal(await page.getByLabel('Rechercher un nom ou un e-mail').inputValue(),'domain-fixture');assert.deepEqual(errors,[]);
 const proof={stack:'Browser / Next BFF / Jersey / MariaDB; real admin mutations and reauthentication',targetId:'70',initialVersion:initial.version,finalVersion:final.version,events:events.items.length,committed,limit:final.monthlyLimit,staleVersion:stale.status(),belowCommitted:below.status(),regularDenied:true,sessionsRemainRevoked:true,usagePreserved:true,returnPreserved:true};
 await writeFile(output+'/proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
} catch(e){await page.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});throw e;}finally{await browser.close();}
