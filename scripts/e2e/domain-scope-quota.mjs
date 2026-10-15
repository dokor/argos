// UI regression with synthetic account responses. Does not exercise the real backend or consume credits.
// Start the built console locally, then set CONNECTED_BASE_URL and optionally CLARTE_BROWSER_PATH.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "../../apps/playwright-service/node_modules/playwright/index.mjs";
const base = process.env.CONNECTED_BASE_URL ?? "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Local fixtures only");
const browser = await chromium.launch({ executablePath: process.env.CLARTE_BROWSER_PATH || undefined });
const output = "outputs/ui-review/595";
await mkdir(output, { recursive: true });
const results = [];
const usage = { offer: "DEMO", available: 36, canLaunch: true, limit: 50, used: 12, reserved: 2, period: "2026-10", timezone: "UTC", startsAt: "2026-10-01T00:00:00Z", resetsAt: "2026-11-01T00:00:00Z" };
const profile = { profileId: "server-default-v1", contractVersion: 1, scoringVersion: 12, settingsProvenance: "COLLECTOR_DEFAULTS", scoringFingerprint: "fixture" };
try {
  for (const [width, lang, theme] of [[1056,"fr","light"],[1056,"fr","dark"],[390,"fr","light"],[390,"fr","dark"],[1056,"en","light"],[1056,"en","dark"],[390,"en","light"],[390,"en","dark"],[320,"en","dark"],[768,"fr","light"]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
    const page = await context.newPage(), errors = [], mutations = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/account/**", async route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      if (req.method() !== "GET") { mutations.push(path); return route.fulfill({ status: 405, json: {} }); }
      let data;
      if (path === "/api/account/me") data = { displayName: "Compte fictif", email: "fixture@atelier.example", verified: true, admin: false };
      else if (path === "/api/account/usage") data = usage;
      else if (path === "/api/account/domain-discoveries" || path === "/api/account/domain-batches") data = [];
      else return route.fulfill({ status: 404, json: {} });
      return route.fulfill({ json: data });
    });
    const prefix = lang === "en" ? "/en" : "";
    await page.goto(base + prefix + "/account/domains/new");
    const guide = page.getByRole("complementary", { name: lang === "en" ? "Before the analysis" : "Avant l’analyse" });
    await guide.getByText("36", { exact: true }).waitFor();
    const link = guide.getByRole("link", { name: lang === "en" ? "Open my quotas" : "Ouvrir mes quotas", exact: true });
    assert.equal(await link.getAttribute("href"), prefix + "/account/usage");
    const form = page.locator("form").filter({ has: page.locator("input[name=hostname]") });
    const formRect = await form.boundingBox(), guideRect = await guide.boundingBox();
    if (width > 900) assert.ok(guideRect.x > formRect.x + formRect.width, "Guide beside form");
    else assert.ok(guideRect.y > formRect.y + formRect.height, "Guide below form");
    const depth = page.locator("input[name=maxDepth]"); await depth.fill("4");
    assert.equal(await depth.evaluate(el => el.validity.rangeOverflow), true); await depth.fill("2");
    await link.focus(); assert.equal(await link.evaluate(el => getComputedStyle(el).outlineStyle), "solid");
    assert.equal(await page.locator("h1").count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No page overflow");
    assert.deepEqual(errors, []); assert.deepEqual(mutations, []);
    await page.screenshot({ path: `${output}/${lang}-${theme}-${width}.png`, fullPage: true });
    results.push({ width, lang, theme, passed: true });
    await context.close();
  }
  await writeFile(output + "/results.json", JSON.stringify(results, null, 2));
  console.log(`Passed ${results.length} responsive UI cases`);
} finally { await browser.close(); }
