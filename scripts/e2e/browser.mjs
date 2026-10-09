import assert from 'node:assert/strict';
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
    const states=new Set(); let token; let creation;
    page.on('response',async response=>{
      if(response.url().endsWith('/status') && response.ok()) {
        try {states.add((await response.json()).status);} catch { /* Navigation can cancel a poll. */ }
      }
    });
    await page.goto(base);
    const input=page.getByRole('textbox').first();
    await input.fill(`http://203.0.113.10:3020/${scenario}`);
    const submitted=page.waitForResponse(response=>response.url().endsWith('/api/audits') && response.request().method()==='POST');
    await input.press('Enter');
    const response=await submitted;
    assert.equal(response.status(),200,'Controlled fixture submission must succeed');
    creation=await response.json();token=creation.reportToken;activeToken=token;assert.equal(creation.status,'QUEUED');states.add('QUEUED');
    assert.equal(typeof token,'string');
    await page.goto(`${base}/report/${token}`);
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
    await summary.getByRole('link',{name:'Comprendre la mesure',exact:true}).click();
    const method=page.locator('#report-method');
    await method.getByRole('heading',{name:'Méthode et limites',exact:true}).waitFor();
    assert.notEqual(await method.getAttribute('open'),null,'Summary link must open measurement details');
    assert.equal(await page.locator(':focus').getAttribute('id'),'report-method-toggle','Measurement details must receive keyboard focus');
    const methodCoverage=method.locator('dl > div').filter({has:page.getByText('Couverture pondérée du barème',{exact:true})});
    assert.equal(await methodCoverage.locator('dd').textContent(),weightedCoverage,'Method must retain the same weighted coverage');
    if(typeof report.scores.completeness==='number') {
      const completeness=method.locator('dl > div').filter({has:page.getByText('Complétude opérationnelle des modules',{exact:true})});
      assert.equal(await completeness.locator('dd').textContent(),`${report.scores.completeness} %`,'Module completeness must remain distinct from weighted coverage');
    }
    if(scenario==='errors') assert.ok(report.issues.some(issue=>issue.id.startsWith('runtime.')),'Runtime errors must surface');
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
    const privateResponse=await page.request.get(`${base}/api/audits/runs/${creation.runId}`);assert.equal(privateResponse.status(),401);
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
