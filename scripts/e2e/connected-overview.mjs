import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "../../apps/playwright-service/node_modules/playwright/index.mjs";
import { response, pages } from "./connected-overview-fixture.mjs";
import fr from "../../apps/console-web/src/lib/i18n/fr.json" with { type: "json" };
import en from "../../apps/console-web/src/lib/i18n/en.json" with { type: "json" };
const base = process.env.CONNECTED_BASE_URL ?? "http://127.0.0.1:3030";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const output = "outputs/ui-review/clarte-overview";
await mkdir(output, { recursive: true });
const browser = await chromium.launch(
    process.env.CLARTE_BROWSER_PATH
      ? { executablePath: process.env.CLARTE_BROWSER_PATH }
      : {},
  ),
  evidence = [];
let lastPage;
try {
  for (const width of process.env.OVERVIEW_SMOKE
    ? [1056]
    : [320, 390, 768, 1056, 1440])
    for (const lang of ["fr", "en"])
      for (const theme of ["light", "dark"]) {
        const t = lang === "fr" ? fr : en,
          c = t.overviewPage,
          prefix = lang === "fr" ? "" : "/en",
          context = await browser.newContext({
            viewport: { width, height: 900 },
            colorScheme: theme,
          }),
          page = await context.newPage();
        lastPage = page;
        const errors = [],
          calls = [];
        let mode = "";
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route("**/api/account/**", async (route) => {
          const req = route.request(),
            url = new URL(req.url());
          calls.push({ method: req.method(), path: url.pathname });
          assert.equal(req.method(), "GET");
          let status = 200,
            data = response(url.pathname, url.searchParams, mode);
          if (
            url.pathname.endsWith("/overview") &&
            ["error", "stale", "denied"].includes(mode)
          ) {
            status = mode === "denied" ? 401 : 503;
            data = {
              error: status === 401 ? "session_invalid" : "account_unavailable",
            };
          }
          await route.fulfill({
            status: data ? status : 404,
            contentType: "application/json",
            body: JSON.stringify(data ?? { error: "resource_unavailable" }),
          });
        });
        const visit = async (query = "") => {
          await page.goto(base + prefix + "/account" + query);
          await page
            .getByRole("heading", { name: t.connected.overview, exact: true })
            .waitFor();
        };
        const check = async (name) => {
          assert.equal(await page.locator("h1").count(), 1);
          assert.equal(await page.locator("footer").count(), 1);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            true,
            `${name} overflow ${width}`,
          );
          await page.addScriptTag({
            path: "apps/console-web/node_modules/axe-core/axe.min.js",
          });
          const results = await page.evaluate(async () =>
            window.axe.run(document.querySelector("[data-connected-shell]"), {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21aa"],
              },
            }),
          );
          assert.deepEqual(
            results.violations.map((v) => v.id),
            [],
          );
          const screenshot = `${name}-${lang}-${theme}-${width}.png`;
          await page.screenshot({
            path: `${output}/${screenshot}`,
            fullPage: true,
          });
          evidence.push({ name, lang, theme, width, screenshot });
        };
        await visit();
        await page
          .getByRole("heading", { name: c.inventory, exact: true })
          .waitFor();
        await check("overview");
        assert.match(
          await page
            .getByRole("link", { name: new RegExp(c.priority + " 9") })
            .innerText(),
          /9/,
        );
        await page
          .getByRole("link", { name: new RegExp(c.priority + " 9") })
          .click();
        await page.waitForURL(/attention=priority/);
        await page.getByText(`9 ${c.results}`, { exact: true }).waitFor();
        const filtered = page.url();
        await page.reload();
        await page.getByText(`9 ${c.results}`, { exact: true }).waitFor();
        const link = page
            .getByRole("link", { name: new RegExp(c.diagnostic) })
            .first(),
          href = await link.getAttribute("href");
        assert.ok(href.includes("returnTo="));
        const run = /runs\/(\d+)/.exec(href)[1];
        assert.ok(pages.some((p) => p.latestAttempt.runId === run));
        await check("priority");
        await link.click();
        await page.getByRole("link", { name: c.back, exact: true }).click();
        assert.equal(page.url(), filtered);
        await page.getByText(`9 ${c.results}`, { exact: true }).waitFor();
        await visit("?attention=incomplete&limit=1");
        await page.getByText(`3 ${c.results}`, { exact: true }).waitFor();
        await page
          .getByRole("link", { name: t.domainPage.next, exact: true })
          .click();
        await page.waitForURL(/offset=1/);
        await page
          .getByRole("link", { name: t.domainPage.previous, exact: true })
          .waitFor();
        await check("incomplete");
        const other = lang === "fr" ? "EN" : "FR";
        assert.ok(
          (
            await page
              .getByRole("link", { name: other, exact: true })
              .getAttribute("href")
          ).includes("attention=incomplete"),
        );
        if ([320, 1056].includes(width)) {
          mode = "active";
          await visit();
          await page
            .getByRole("heading", { name: `${c.active} (1)`, exact: true })
            .waitFor();
          await check("active");
          mode = "";
          await visit();
          await page
            .getByRole("heading", { name: c.inventory, exact: true })
            .waitFor();
          mode = "stale";
          await page
            .getByRole("button", { name: c.refresh, exact: true })
            .click();
          await page.getByText(c.stale, { exact: true }).waitFor();
          await check("stale");
          assert.ok(
            await page
              .getByRole("heading", { name: c.inventory, exact: true })
              .count(),
          );
          for (const variant of ["empty", "error", "unlimited", "zero"]) {
            mode = variant;
            await visit();
            await page
              .getByText(
                variant === "empty"
                  ? c.empty
                  : variant === "error"
                    ? c.error
                    : variant === "zero"
                      ? c.quotaBlocked
                      : c.unlimited,
                { exact: true },
              )
              .first()
              .waitFor();
            await check(variant);
          }
          mode = "denied";
          await visit();
          await page
            .getByRole("link", { name: t.account.signIn, exact: true })
            .waitFor();
          assert.equal(
            await page
              .getByRole("heading", { name: c.inventory, exact: true })
              .count(),
            0,
          );
        }
        assert.deepEqual(errors, []);
        await context.close();
      }
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        fixtures:
          "Canonical synthetic UI data. Real Java/MariaDB assertions are separate.",
        checks: evidence,
      },
      null,
      2,
    ),
  );
  console.log(`${evidence.length} overview UI checks passed`);
} catch (e) {
  if (lastPage) {
    await lastPage.screenshot({
      path: `${output}/failure.png`,
      fullPage: true,
    });
    await writeFile(
      `${output}/failure.txt`,
      await lastPage.locator("body").innerText(),
    );
  }
  throw e;
} finally {
  await browser.close();
}
