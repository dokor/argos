import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Run only against AccountBrowserFixture with all three explicit fixture flags.
const base=process.env.ARGOS_E2E_BASE ?? 'http://localhost:3000';
const backend=process.env.ARGOS_E2E_BACKEND ?? 'http://127.0.0.1:33317';
assert.match(base,/^http:\/\/localhost:3000$/);
assert.match(backend,/^http:\/\/127\.0\.0\.1:33317$/);
const entry=process.env.ARGOS_PLAYWRIGHT_ENTRY;
const {chromium}=await import(entry?pathToFileURL(entry).href:'../../apps/playwright-service/node_modules/playwright/index.mjs');
const output='outputs/feedback-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.ARGOS_BROWSER_EXECUTABLE?{executablePath:process.env.ARGOS_BROWSER_EXECUTABLE}:{})});
const evidence=[];
async function accessibility(page) {
  await page.addScriptTag({path:'apps/console-web/node_modules/axe-core/axe.min.js'});
  const issues=await page.evaluate(async()=> (await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
  assert.deepEqual(issues.map(issue=>({id:issue.id,nodes:issue.nodes.length})),[]);
}
try {
  for(const [lang,width,theme] of [['fr',1280,'light'],['en',360,'dark']]) {
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme});
    const page=await context.newPage(),errors=[],prefix=lang==='en'?'/en':'';
    page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(20000);
    page.on('pageerror',error=>errors.push(error.message));
    const text={description:lang==='fr'?'Description / explication':'Description / explanation',send:lang==='fr'?'Envoyer le retour':'Send feedback',type:lang==='fr'?'Type de retour':'Feedback type',detail:lang==='fr'?'Détail':'Details',status:lang==='fr'?'Statut':'Status'};
    const received=lang==='fr'?'Votre retour a été reçu. Merci !':'Your feedback has been received. Thank you!';
    const response=await page.goto(base+prefix+'/feedback');assert.equal(response.status(),200);
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
    assert.equal(await page.locator('h1').count(),1);
    await page.getByLabel(text.description).focus();assert.equal(await page.locator(':focus').getAttribute('name'),'description');
    assert.notEqual(await page.locator(':focus').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
    await page.getByLabel(text.description).fill('Controlled suggestion: improve the finding explanation.');
    const suggestion=page.waitForResponse(r=>r.url().endsWith('/api/feedback')&&r.request().method()==='POST');
    await page.getByRole('button',{name:text.send,exact:true}).click();assert.equal((await suggestion).status(),200);await page.getByText(received,{exact:true}).waitFor();

    await page.goto(base+prefix+'/feedback');await page.getByLabel(text.type).selectOption('BUG');
    await page.getByLabel(text.description).fill('<script>controlled bug fixture</script>');
    await page.getByLabel(lang==='fr'?'Étapes pour reproduire (facultatif)':'Steps to reproduce (optional)').fill('Click the synthetic button.');
    await accessibility(page);await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:`${output}/${lang}-form-${theme}.png`,fullPage:true});
    await page.getByRole('button',{name:text.send,exact:true}).click();await page.getByText(received,{exact:true}).waitFor();
    console.log(lang+': suggestion and bug deposited');

    const created=await page.evaluate(async()=>{
      const csrf=(await (await fetch('/api/account/csrf')).json()).csrf;
      const result=await fetch('/api/audits',{method:'POST',headers:{'Content-Type':'application/json','X-Argos-CSRF':csrf},body:JSON.stringify({url:'https://example.com/feedback-fixture'})});
      if(!result.ok)throw new Error('Controlled audit creation failed');return result.json();
    });
    const published=await fetch(backend+'/api/__test/usage/'+created.runId+'/publish',{method:'POST',signal:AbortSignal.timeout(15000)});assert.equal(published.status,200);await published.json();
    console.log(lang+': fixture report published');
    const frozen=await (await context.request.get(base+'/api/reports/'+created.reportToken,{timeout:15000})).json();
    assert.ok(frozen.issues.some(issue=>issue.id==='http.hsts'));
    await page.goto(base+prefix+'/report/'+created.reportToken);
    console.log(lang+': report displayed');
    await page.getByRole('button',{name:lang==='fr'?'Constats techniques':'Technical findings',exact:true}).click();
    // Open the only controlled finding; its translated title comes from the real catalogue.
    await page.locator('[id^="finding-"] > summary').first().click();
    const falsePositive=page.getByRole('button',{name:lang==='fr'?'Signaler un faux positif':'Report a false positive',exact:true});
    await falsePositive.click();await page.getByLabel(text.description).fill('Controlled false positive: confirm this fixture manually.');
    const sent=page.waitForResponse(r=>r.url().endsWith('/api/feedback')&&r.request().method()==='POST');await page.getByRole('button',{name:text.send,exact:true}).click();
    console.log(lang+': false positive submitted');
    const receipt=(await (await sent).json()).receipt;assert.ok(receipt);await page.getByText(received,{exact:true}).waitFor();
    console.log(lang+': false positive received');

    const denied=await context.request.get(base+'/api/account/admin/feedback',{timeout:15000});assert.equal(denied.status(),401);
    console.log(lang+': anonymous admin access refused');
    await page.goto(base+prefix+'/account/sign-in');await page.locator('input[type="email"]').fill('admin@example.com');await page.locator('input[type="password"]').fill('a long synthetic fixture passphrase');
    await page.getByRole('button',{name:lang==='fr'?'Se connecter':'Sign in',exact:true}).click();await page.waitForURL(url=>!url.pathname.endsWith('/sign-in'));
    await page.goto(base+prefix+'/account/admin/feedback');await page.getByRole('button',{name:text.detail+' '+receipt,exact:true}).waitFor();
    await page.getByLabel(text.type).selectOption('FALSE_POSITIVE');await page.getByRole('button',{name:lang==='fr'?'Filtrer':'Filter',exact:true}).click();
    await page.getByRole('button',{name:text.detail+' '+receipt,exact:true}).click();await page.getByText('Controlled false positive: confirm this fixture manually.',{exact:true}).waitFor();
    assert.ok(await page.getByRole('link',{name:lang==='fr'?'Ouvrir le rapport (administration)':'Open report (administration)',exact:true}).getAttribute('href'));
    await page.getByLabel(text.status).nth(1).selectOption('CONFIRMED');
    await page.getByRole('button',{name:lang==='fr'?'Enregistrer le statut':'Save status',exact:true}).click();await page.getByText(lang==='fr'?'Statut enregistré.':'Status saved.',{exact:true}).waitFor();
    await page.locator('h3').filter({hasText:lang==='fr'?'Historique du traitement':'Treatment history'}).locator('..').getByText(/→/).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No horizontal overflow');
    await accessibility(page);await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:`${output}/${lang}-admin-${theme}.png`,fullPage:true});
    const unchanged=await (await context.request.get(base+'/api/reports/'+created.reportToken)).json();assert.deepEqual(unchanged,frozen);
    assert.deepEqual(errors,[]);evidence.push({lang,width,theme,suggestion:true,bug:true,falsePositive:true,adminDeniedAnonymously:true,adminTreatment:true,reportUnchanged:true,keyboardFocus:true,overflow:false,pageErrors:0,axeViolations:0});
    await context.close();
  }
  await writeFile(output+'/results.json',JSON.stringify({fixture:'Next production + Java + MariaDB; no intercepted application responses',checks:evidence},null,2));
  console.log('Two feedback browser journeys passed (FR desktop light / EN mobile dark).');
} finally {await browser.close();}
