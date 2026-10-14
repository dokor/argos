// Real browser -> Next BFF -> Jersey -> MariaDB -> queue/collectors/publication. No response stubs.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "../../apps/playwright-service/node_modules/playwright/index.mjs";
import fr from "../../apps/console-web/src/lib/i18n/fr.json" with { type: "json" };
const base = "http://127.0.0.1:3000",
  c = fr.domainPage;
assert.ok(
  process.env.DOMAIN_FIXTURE_SESSION,
  "Fixture session is supplied in memory, never logged",
);
const browser = await chromium.launch(),
  context = await browser.newContext({
    viewport: { width: 1056, height: 900 },
  }),
  page = await context.newPage();
const output = "outputs/ui-review/clarte-domains/real";
await mkdir(output, { recursive: true });
const errors = [],
  mutations = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (req) => {
  if (
    req.method() === "POST" &&
    /\/api\/account\/(domain-discoveries|domain-batches)$/.test(
      new URL(req.url()).pathname,
    )
  )
    mutations.push({
      path: new URL(req.url()).pathname,
      key: req.headers()["idempotency-key"],
    });
});
await context.addCookies([
  {
    name: "argos_account",
    value: process.env.DOMAIN_FIXTURE_SESSION,
    url: base,
    httpOnly: true,
    sameSite: "Lax",
  },
  {
    name: "argos_account_csrf",
    value: "c".repeat(43),
    url: base,
    sameSite: "Lax",
  },
]);
try {
  await page.goto(base + "/account/domains");
  await page.getByRole("heading", { name: c.empty, exact: true }).waitFor();
  await page.getByRole("link", { name: c.new, exact: true }).first().click();
  await page.getByLabel(c.hostname, { exact: true }).fill("8.8.8.8");
  await page.getByLabel(c.maxUrls, { exact: true }).fill("4");
  await page.getByLabel(c.maxDepth, { exact: true }).fill("1");
  await page.getByRole("button", { name: c.discover, exact: true }).click();
  await page.waitForURL(/discovery=\d+$/);
  const discovery = new URL(page.url()).searchParams.get("discovery");
  await page
    .getByRole("button", { name: c.confirm, exact: true })
    .waitFor({ timeout: 60000 });
  await page.getByRole("checkbox", { checked: true }).first().waitFor();
  assert.equal(await page.getByRole("checkbox", { checked: true }).count(), 2);
  await page.reload();
  await page.getByRole("button", { name: c.confirm, exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: output + "/confirmation.png", fullPage: true });
  const accepted = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === "/api/account/domain-batches" &&
      res.request().method() === "POST",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: c.launch, exact: true })
    .click();
  const admissionResponse = await accepted;
  assert.equal(admissionResponse.status(), 202);
  const admitted = await admissionResponse.json();
  const stable =
    "/account/domains/" + admitted.domainId + "/batches/" + admitted.id;
  await page.waitForURL(base + stable);
  assert.equal(admitted.stablePath, stable);
  await page.getByRole("heading", { name: "8.8.8.8", exact: true }).waitFor();
  await page.reload();
  let summary;
  for (let n = 0; n < 100; n++) {
    const response = await context.request.get(
      base +
        "/api/account/domains/" +
        admitted.domainId +
        "/batches/" +
        admitted.id,
    );
    assert.equal(response.status(), 200);
    summary = await response.json();
    if (!["QUEUED", "RUNNING"].includes(summary.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(
    summary && !["QUEUED", "RUNNING"].includes(summary.status),
    "Batch reaches a terminal state",
  );
  assert.equal(summary.counts.selectedPages, 2);
  assert.equal(summary.usage.reserved, 0);
  assert.equal(summary.usage.counted, 2);
  assert.ok(
    summary.commonFindings.length > 0,
    "Real shared findings are projected",
  );
  await page.getByRole("button", { name: c.refresh, exact: true }).click();
  await page
    .getByRole("link", { name: new RegExp(c.affectedPages) })
    .first()
    .waitFor();
  await page.screenshot({ path: output + "/summary.png", fullPage: true });
  await page
    .getByRole("link", { name: new RegExp(c.affectedPages) })
    .first()
    .click();
  await page.getByRole("table").waitFor();
  const filtered = page.url();
  assert.ok(new URL(filtered).searchParams.get("rule"));
  await page.reload();
  await page.getByRole("table").waitFor();
  const reportLink = page
      .getByRole("link", { name: new RegExp(c.diagnostic) })
      .first(),
    href = await reportLink.getAttribute("href"),
    run = /\/runs\/(\d+)/.exec(href)[1];
  const reportResponse = page.waitForResponse(
    (res) => new URL(res.url()).pathname === `/api/account/runs/${run}/report`,
  );
  await reportLink.click();
  assert.equal((await reportResponse).status(), 200);
  await page.getByRole("link", { name: c.backBatch, exact: true }).waitFor();
  await page.reload();
  await page.getByRole("link", { name: c.backBatch, exact: true }).click();
  await page.getByRole("table").waitFor();
  assert.equal(page.url(), filtered);
  await page.getByRole("link", { name: `← ${c.back}`, exact: true }).click();
  await page.getByRole("link", { name: c.open, exact: true }).click();
  await page.waitForURL(base + stable);
  await page.getByRole("heading", { name: c.history, exact: true }).waitFor();
  assert.ok(
    await page
      .getByRole("link", { name: new RegExp("#" + admitted.id + "$") })
      .count(),
  );
  // A second launch is a distinct historical resource; canceling it cannot replace the first.
  await page.goto(base + "/account/domains/new?discovery=" + discovery);
  await page.getByRole("button", { name: c.selectNone, exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll("input[type=checkbox]:checked").length === 0,
  );
  await page.getByRole("checkbox").first().check();
  await page.waitForFunction(
    () =>
      document.querySelectorAll("input[type=checkbox]:checked").length === 1,
  );
  await page.getByRole("button", { name: c.confirm, exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: c.launch, exact: true })
    .click();
  await page.waitForURL(
    (url) => /\/batches\/\d+$/.test(url.pathname) && url.pathname !== stable,
  );
  const secondPath = new URL(page.url()).pathname;
  await page.getByRole("button", { name: c.cancelBatch, exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: c.cancelBatch, exact: true })
    .click();
  await page.getByText(c.cancelRequested, { exact: true }).waitFor();
  const older = page.getByRole("link", {
    name: new RegExp("#" + admitted.id + "$"),
  });
  await older.click();
  await page.waitForURL(base + stable);
  const retained = await (
    await context.request.get(
      base +
        "/api/account/domains/" +
        admitted.domainId +
        "/batches/" +
        admitted.id,
    )
  ).json();
  assert.equal(retained.usage.counted, 2);
  assert.equal(retained.counts.selectedPages, 2);
  await page.screenshot({
    path: output + "/history-preserved.png",
    fullPage: true,
  });
  assert.equal(
    mutations.filter((m) => m.path.endsWith("domain-discoveries")).length,
    1,
  );
  assert.equal(
    mutations.filter((m) => m.path.endsWith("domain-batches")).length,
    2,
  );
  assert.deepEqual(errors, []);
  await page.goto(base + "/account");
  await page
    .getByRole("heading", { name: fr.overviewPage.inventory, exact: true })
    .waitFor();
  const overview = await (
    await context.request.get(base + "/api/account/overview")
  ).json();
  assert.equal(overview.trackedUrls, 2);
  assert.equal(overview.pages.total, 2);
  const incomplete = await (
    await context.request.get(base + "/api/account/pages?attention=incomplete")
  ).json();
  assert.equal(incomplete.total, overview.incompleteUrls);
  const priority = await (
    await context.request.get(base + "/api/account/pages?attention=priority")
  ).json();
  assert.equal(priority.total, overview.priorityUrls);
  assert.ok(
    overview.pages.items.some(
      (p) =>
        p.latestAvailableReport &&
        p.latestAvailableReport.runId !== p.latestAttempt.runId,
    ),
  );
  await page
    .getByRole("link", {
      name: new RegExp(
        fr.overviewPage.incomplete + " " + overview.incompleteUrls,
      ),
    })
    .click();
  await page.waitForURL(/attention=incomplete/);
  await page.reload();
  await page
    .getByRole("heading", { name: fr.overviewPage.inventory, exact: true })
    .waitFor();
  const overviewReturn = page.url(),
    attemptLink = page
      .getByRole("link", { name: new RegExp(fr.overviewPage.openRun + " ") })
      .first();
  await attemptLink.click();
  await page
    .getByRole("link", { name: fr.overviewPage.back, exact: true })
    .click();
  assert.equal(page.url(), overviewReturn);
  await page
    .getByRole("heading", { name: fr.overviewPage.inventory, exact: true })
    .waitFor();
  await page.screenshot({ path: output + "/overview.png", fullPage: true });
  const proof = {
    stack:
      "Browser / Next BFF / Jersey / MariaDB / real queue, scoring and publication; controlled HTTP/headless transport",
    overview: {
      tracked: overview.trackedUrls,
      priority: overview.priorityUrls,
      incomplete: overview.incompleteUrls,
      filteredTotalsMatch: true,
      returnPreserved: true,
    },
    discoveryId: discovery,
    batchId: admitted.id,
    domainId: admitted.domainId,
    exactChildRunId: run,
    selected: summary.counts.selectedPages,
    counted: summary.usage.counted,
    commonFindings: summary.commonFindings.length,
    stablePath: stable,
    refreshDidNotResubmit: true,
    filteredReturnPreserved: true,
    domainListUsesSameResource: true,
    olderBatchPreserved: true,
    secondBatchPath: secondPath,
  };
  await writeFile(output + "/proof.json", JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally {
  await browser.close();
}
