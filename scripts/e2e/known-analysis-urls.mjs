// UI regression with synthetic account responses. Does not exercise the real backend or consume credits.
// Start the built console locally, then set CONNECTED_BASE_URL and optionally CLARTE_BROWSER_PATH.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "../../apps/playwright-service/node_modules/playwright/index.mjs";
const base = process.env.CONNECTED_BASE_URL ?? "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Local fixtures only");
const browser = await chromium.launch({ executablePath: process.env.CLARTE_BROWSER_PATH || undefined });
const output = "outputs/ui-review/594";
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
      else if (path === "/api/account/analysis-profiles") data = { defaultProfileId: "server-default-v1", items: [{ id: "server-default-v1", snapshot: profile }] };
      else if (path === "/api/account/overview") data = { recentRuns: [{ pageId: "7", normalizedUrl: "https://atelier.example/produit?taille=M&couleur=bleu#details" }, { pageId: "8", normalizedUrl: "https://atelier.example/contact" }] };
      else return route.fulfill({ status: 404, json: {} });
      return route.fulfill({ json: data });
    });
    const prefix = lang === "en" ? "/en" : "";
    await page.goto(base + prefix + "/account/analyses/new");
    const label = lang === "en" ? "Use this URL" : "Utiliser cette URL";
    await page.getByRole("link", { name: label, exact: true }).first().waitFor();
    const nav = page.getByRole("link", { name: lang === "en" ? "URL history" : "Historique des URL", exact: true });
    await nav.press("Enter");
    await page.waitForURL(url => url.hash === "#known-urls");
    assert.equal(new URL(page.url()).hash, "#known-urls");
    const use = page.getByRole("link", { name: label, exact: true }).first();
    await use.press("Enter");
    const input = page.getByLabel(lang === "en" ? "Page URL" : "URL de la page", { exact: true });
    await page.waitForURL(url => url.searchParams.has("url"));
    assert.equal(await input.inputValue(), "https://atelier.example/produit?taille=M&couleur=bleu#details");
    await page.getByText("server-default-v1", { exact: true }).waitFor();
    const history = page.getByRole("link", { name: lang === "en" ? "History for this URL" : "Historique de cette URL", exact: true }).first();
    assert.equal(await history.getAttribute("href"), prefix + "/account/urls/7/history");
    assert.ok((await history.boundingBox()).height >= 44, "History touch target");
    await history.focus(); assert.equal(await history.evaluate(el => getComputedStyle(el).outlineStyle), "solid");
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
