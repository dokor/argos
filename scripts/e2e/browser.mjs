import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';
const base='http://127.0.0.1:3000';
const browser=await chromium.launch({args:['--no-sandbox']});
const cases=['healthy','errors','redirect','partial','empty','unavailable','antibot','timeout'];
const evidence=[];
let activeScenario='startup';let activeToken='';
try {
  for(const scenario of cases) {
    activeScenario=scenario;
    const page=await browser.newPage();
    const states=new Set(); let token; let creation; let submissions=0;
    page.on('request',request=>{
      if(new URL(request.url()).pathname==='/api/audits' && request.method()==='POST') submissions++;
    });
    page.on('response',async response=>{
      if(response.url().endsWith('/status') && response.ok()) {
        try {states.add((await response.json()).status);} catch { /* Navigation can cancel a poll. */ }
      }
    });
    await page.goto(base);
    const input=page.getByRole('textbox').first();
    await input.fill(`http://8.8.8.8/${scenario}`);
    const submitted=page.waitForResponse(response=>response.url().endsWith('/api/audits') && response.request().method()==='POST');
    await input.press('Enter');
    const response=await submitted;
    assert.equal(response.status(),200,'Controlled fixture submission must succeed');
    creation=await response.json();token=creation.reportToken;activeToken=token;assert.equal(creation.status,'QUEUED');states.add('QUEUED');
    assert.equal(typeof token,'string');
    // Let the application navigate; forcing goto would hide a broken submit flow.
    await page.waitForURL(url=>url.pathname===`/report/${token}`);
    await page.getByRole('heading',{name:/Analyse en (attente|cours)/}).waitFor({timeout:15000});
    let report;
    for(let attempt=0;attempt<180;attempt++) {
      const statusResponse=await page.request.get(`${base}/api/reports/${token}/status`);
      assert.equal(statusResponse.status(),200);
      const status=await statusResponse.json();states.add(status.status);
      assert.equal('runId' in status,false);assert.equal('reportToken' in status,false);assert.equal('lastError' in status,false);
      if(status.status==='COMPLETED') {
        const publicResponse=await page.request.get(`${base}/api/reports/${token}`);assert.equal(publicResponse.status(),200);
        report=await publicResponse.json();
        const modules=typeof status.moduleStatuses==='string'?JSON.parse(status.moduleStatuses):status.moduleStatuses;
        assert.equal(modules.length,8);assert.ok(modules.every(module=>!['RUNNING','PENDING'].includes(module.status)),'Every module must be terminal');break;
      }
      assert.notEqual(status.status,'FAILED','Controlled audit must preserve partial results');
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    assert.ok(report,'Audit must publish within the fixture budget');
    assert.ok(states.has('RUNNING'),'A running state must be observed');
    assert.ok(report.scores.coverage,'Coverage must be explicitly published');
    await page.getByRole('heading',{name:'Score Argos',exact:true}).waitFor({timeout:20000});
    const summary=page.getByRole('region',{name:report.domain,exact:true});
    assert.equal(await summary.getByRole('heading',{level:1}).textContent(),report.domain);
    const weightedCoverage=`${Math.round(report.scores.coverage.global.ratio*100)} %`;
    const summaryCoverage=summary.getByText('Couverture pondérée du barème',{exact:true}).locator('..');
    assert.ok((await summaryCoverage.textContent()).includes(weightedCoverage),'Summary must show persisted weighted coverage beside the score');
    assert.equal(report.access,'summary');
    assert.ok(report.issues.every(issue=>!issue.structuredEvidence&&!issue.evidence&&!issue.recommendation),'Anonymous report must omit technical proofs and corrections');
    assert.equal(await page.locator('#report-method').count(),0,'Retired methodology block must remain absent');
    const measures=page.getByRole('region',{name:'Mesures observ\u00e9es',exact:true});
    await measures.waitFor();
    for(const family of ['Chargement','Ressources','Erreurs']) await measures.getByRole('heading',{name:family,exact:true}).waitFor();
    assert.equal(await measures.locator('dt').count(),13);
    assert.equal(await page.getByLabel('Format PDF').locator('option[value="full"]').count(),0,'Anonymous export must only offer the summary');
    if(scenario==='healthy') {
      await page.reload();
      await page.getByRole('heading',{name:'Score Argos',exact:true}).waitFor();
      const persisted=await page.request.get(`${base}/api/reports/${token}`);
      assert.equal(persisted.status(),200);
      assert.deepEqual((await persisted.json()).scores,report.scores,'Reopening must retain the published scores');
      assert.equal(submissions,1,'Reopening a report must not submit another audit');
    }
    if(scenario==='errors') {
      assert.ok(process.env.REPORT_FIXTURE_SESSION,'Verified fixture session is supplied in memory');
      const denied=await page.request.get(`${base}/api/account/reports/${token}`);
      assert.equal(denied.status(),401,'Technical details require authentication');
      await page.context().addCookies([{name:'argos_account',value:process.env.REPORT_FIXTURE_SESSION,url:base,httpOnly:true,sameSite:'Lax'}]);
      const detailedResponse=await page.request.get(`${base}/api/account/reports/${token}`);
      assert.equal(detailedResponse.status(),200);
      const detailed=await detailedResponse.json();
      assert.equal(detailed.access,'full');
      const network=detailed.issues.find(issue=>issue.id==='runtime.network.5xx')?.structuredEvidence?.observed;
      assert.ok(network?.items.some(item=>item.status===503 && item.ownership==='FIRST_PARTY'),'Real Runtime 503 observation must survive publication');
      const element=detailed.issues.filter(issue=>issue.id.startsWith('lighthouse.audit.')).flatMap(issue=>issue.structuredEvidence?.observed?.items??[]).find(item=>item.kind==='element');
      assert.ok(element,'Real Lighthouse DOM observation must survive publication');
      assert.ok(!JSON.stringify(detailed).includes('synthetic-proof-secret'),'Private request parameters must not reach the published report');
      await mkdir('outputs/ui-review/clarte-evidence',{recursive:true});
      for(const lang of ['fr','en']) {
        await page.goto(base+(lang==='en'?'/en':'')+'/report/'+token);
        await page.getByLabel(lang==='fr'?'Format PDF':'PDF format').locator('option[value="full"]').waitFor({state:'attached'});
  await page.locator('details').filter({has:page.locator('summary').filter({hasText:lang==='fr'?'Exporter en PDF':'Export PDF'})}).locator('summary').click();
        await page.getByLabel(lang==='fr'?'Format PDF':'PDF format').selectOption('full');
        const opened=page.waitForEvent('popup');
        await page.getByRole('button',{name:lang==='fr'?'Exporter en PDF':'Export PDF',exact:true}).click();
        const popup=await opened;await popup.locator('main').waitFor();
        await page.getByText(lang==='fr'?'Prévisualisation prête.':'Preview ready.',{exact:false}).waitFor();
        const content=await popup.locator('main').textContent();
        assert.ok(content.includes(network.items[0].resourceRef),'Full PDF must retain the same resource reference');
        assert.ok(content.includes(element.nodePath),'Full PDF must retain the same observed DOM path');
        assert.ok(!content.includes('synthetic-proof-secret'),'PDF must exclude private request parameters');
        await popup.evaluate(()=>document.fonts.ready);await popup.emulateMedia({media:'print'});
        await popup.pdf({path:`outputs/ui-review/clarte-evidence/real-${lang}.pdf`,format:'A4',preferCSSPageSize:true,tagged:true});await popup.close();
      }
    }
    if(scenario==='partial') {
      const lh=report.scores.coverage.checks.filter(check=>check.module==='lighthouse');
      assert.equal(lh.find(check=>check.key==='lighthouse.score.performance').state,'MEASURED');
      assert.equal(lh.find(check=>check.key==='lighthouse.score.accessibility').state,'UNAVAILABLE');
    }
    if(['empty','unavailable'].includes(scenario)) {
      assert.ok(report.scores.coverage.checks.filter(check=>check.module==='lighthouse').every(check=>check.state==='UNAVAILABLE'));
      assert.ok(report.scores.coverage.checks.some(check=>check.module==='http' && check.state==='MEASURED'));
    }
    if(scenario==='antibot') {
      assert.ok(report.antiBot,'Explicit challenge evidence must be published');assert.equal(report.antiBot.detected,true);assert.equal(report.scores.coverage.provisional,true);
      assert.ok(report.scores.coverage.checks.some(check=>check.state==='BLOCKED_BY_ANTIBOT'));
      assert.ok(!report.issues.some(issue=>['html','runtime','lighthouse','tech'].includes(issue.module)),'Challenge page must not create site findings');
    }
    if(scenario==='timeout') assert.ok(report.scores.coverage.checks.some(check=>check.state==='UNAVAILABLE'));
    const retiredResponse=await page.request.get(`${base}/api/audits/runs/${creation.runId}`);
    assert.equal(retiredResponse.status(),410,'Legacy numeric reads must remain retired in the BFF');
    assert.equal(retiredResponse.headers()['cache-control'],'private, no-store');
    assert.deepEqual(await retiredResponse.json(),{error:'resource_unavailable'},'Retired reads must expose no run data');
    const privateResponse=await page.request.get(`http://127.0.0.1:8081/api/audits/runs/${creation.runId}`);
    assert.equal(privateResponse.status(),401,'Direct backend reads must still require a server credential');
    const guessed=await page.request.get(`${base}/api/reports/synthetic-unknown-report`);assert.equal(guessed.status(),404);
    evidence.push({scenario,states:[...states],terminal:'COMPLETED',coverage:report.scores.coverage.global.ratio,provisional:report.scores.coverage.provisional});
    await page.close();
  }
  console.log(JSON.stringify({version:'controlled-e2e-v1',scenarios:evidence}));
} catch(error) {
  // No browser URLs, tokens, screenshots, traces or raw report JSON in failure artefacts.
  const safeMessage=String(error.message).replace(/https?:\/\/[^\s]+/g,'[fixture URL]').split(activeToken || 'never-a-token').join('[fixture token]');
  console.error(`Controlled browser fixture ${activeScenario} failed: ${error.name}: ${safeMessage}`);
  console.log(JSON.stringify({version:'controlled-e2e-v1',completed:false,scenarios:evidence}));process.exitCode=1;
} finally {await browser.close();}
