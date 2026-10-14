import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "../../apps/playwright-service/node_modules/playwright/index.mjs";
import {
  response,
  discovery,
  batch,
  pages,
} from "./connected-domains-fixture.mjs";
import fr from "../../apps/console-web/src/lib/i18n/fr.json" with { type: "json" };
import en from "../../apps/console-web/src/lib/i18n/en.json" with { type: "json" };
const base = process.env.CONNECTED_BASE_URL ?? "http://127.0.0.1:3030";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const output = "outputs/ui-review/clarte-domains";
await mkdir(output, { recursive: true });
const browser = await chromium.launch(
    process.env.CLARTE_BROWSER_PATH
      ? { executablePath: process.env.CLARTE_BROWSER_PATH }
      : {},
  ),
  evidence = [];
let lastPage;
try {
  for (const width of process.env.DOMAIN_SMOKE
    ? [1056]
    : [320, 390, 768, 1056, 1440])
    for (const lang of ["fr", "en"])
      for (const theme of ["light", "dark"]) {
        const c = (lang === "fr" ? fr : en).domainPage,
          prefix = lang === "en" ? "/en" : "",
          context = await browser.newContext({
            viewport: { width, height: 900 },
            colorScheme: theme,
          }),
          page = await context.newPage(),
          errors = [];
        let mode = "",
          posts = [],
          firstLost = true,
          cancelRequested = false;
        lastPage = page;
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route("**/api/account/**", async (route) => {
          const url = new URL(route.request().url()),
            path = url.pathname,
            method = route.request().method();
          let data = response(path, url.searchParams),
            status = 200;
          if (method === "POST") {
            posts.push({
              path,
              body: route.request().postDataJSON(),
              key: route.request().headers()["idempotency-key"],
            });
            if (path.endsWith("/domain-discoveries")) data = discovery;
            else if (path.endsWith("/domain-batches")) {
              if (mode === "quota-changed") {
                status = 429;
                data = { error: "quota_exceeded" };
              } else if (mode === "lost" && firstLost) {
                firstLost = false;
                await route.abort();
                return;
              } else
                data = {
                  id: "700",
                  domainId: "7",
                  status: "QUEUED",
                  reservedCredits: 6,
                  stablePath: "/account/domains/7/batches/700",
                };
            } else if (path.endsWith("/cancel")) {
              cancelRequested = true;
              data = { ...batch, cancelRequested: true };
            }
          }
          if (mode === "expired" && path.endsWith("/domain-discoveries/600"))
            data = { ...discovery, expiresAt: "2000-01-01T00:00:00Z" };
          if (mode === "zero" && path.endsWith("/usage"))
            data = { ...data, available: 0, canLaunch: false };
          if (mode === "unknown" && path.endsWith("/usage")) {
            status = 503;
            data = { error: "account_unavailable" };
          }
          if (mode === "unlimited" && path.endsWith("/usage"))
            data = { ...data, available: null, limit: null };
          if (mode === "active" && path.endsWith("/batches/700"))
            data = {
              ...batch,
              cancelRequested,
              status: "RUNNING",
              finishedAt: null,
              counts: { ...batch.counts, activePages: 3 },
            };
          if (mode === "empty" && path.endsWith("/domains"))
            data = { items: [], total: 0, limit: 20, offset: 0 };
          if (mode === "missing" && path.endsWith("/batches/700")) {
            status = 404;
            data = { error: "resource_unavailable" };
          }
          if (!data) {
            status = 404;
            data = { error: "resource_unavailable" };
          }
          await route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify(data),
          });
        });
        const visit = async (path) => {
          await page.goto(base + prefix + path);
          await page.locator("h1").waitFor();
        };
        async function check(name) {
          await page.evaluate(() => document.fonts.ready);
          assert.equal(await page.locator("h1").count(), 1);
          assert.equal(await page.locator("footer").count(), 1);
          assert.ok(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth + 1,
            ),
            name + ": overflow",
          );
          await page.addScriptTag({
            path: "apps/console-web/node_modules/axe-core/axe.min.js",
          });
          const violations = await page.evaluate(async () =>
            (
              await window.axe.run(
                document.querySelector("[data-connected-shell]"),
                {
                  runOnly: {
                    type: "tag",
                    values: ["wcag2a", "wcag2aa", "wcag21aa"],
                  },
                },
              )
            ).violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => n.target),
            })),
          );
          assert.deepEqual(violations, [], name);
          const file = `${name}-${lang}-${theme}-${width}.png`;
          await page.screenshot({
            path: `${output}/${file}`,
            fullPage: name !== "confirmation",
          });
          evidence.push({ name, lang, theme, width, screenshot: file });
        }
        await visit("/account/domains");
        await page
          .getByRole("heading", { name: "atelier.example", exact: true })
          .waitFor();
        await check("list");
        await page.getByRole("link", { name: c.open, exact: true }).click();
        await page
          .getByRole("heading", { name: c.common, exact: true })
          .waitFor();
        await page
          .getByRole("link", { name: new RegExp(c.diagnostic) })
          .first()
          .waitFor();
        await check("summary");
        await page
          .getByRole("link", { name: c.affectedPages + " (3)", exact: true })
          .click();
        await page.getByRole("table").waitFor();
        assert.match(page.url(), /rule=http.hsts/);
        assert.equal(await page.locator("tbody tr").count(), 3);
        await check("filtered-pages");
        const filtered = page.url();
        const language = page.getByRole("link", {
          name: lang === "fr" ? "English" : "Français",
          exact: true,
        });
        assert.ok(
          (await language.getAttribute("href")).includes("rule=http.hsts"),
          "Language switch keeps filters",
        );
        await page
          .getByRole("link", { name: new RegExp(c.diagnostic) })
          .first()
          .click();
        await page.waitForURL(/account\/runs\/43/);
        const back = page.getByRole("link", { name: c.backBatch, exact: true });
        await back.waitFor();
        assert.equal(
          new URL(await back.getAttribute("href"), base).href,
          filtered,
        );
        await page.reload();
        await back.click();
        await page.getByRole("table").waitFor();
        assert.equal(page.url(), filtered);
        await visit("/account/domains/new");
        await page
          .getByRole("button", { name: c.discover, exact: true })
          .waitFor();
        await page
          .getByLabel(c.hostname, { exact: true })
          .fill("atelier.example");
        await check("scope");
        await page
          .getByRole("button", { name: c.discover, exact: true })
          .click();
        await page.waitForURL(/discovery=600/);
        await page
          .getByRole("button", { name: c.confirm, exact: true })
          .waitFor();
        await check("selection");
        const before = posts.length;
        await page.reload();
        await page
          .getByRole("button", { name: c.confirm, exact: true })
          .click();
        assert.equal(posts.length, before, "Reload never submits");
        await page.getByRole("dialog").waitFor();
        await check("confirmation");
        await page.keyboard.press("Escape");
        assert.equal(await page.getByRole("dialog").count(), 0);
        assert.equal(
          await page
            .getByRole("button", { name: c.confirm, exact: true })
            .evaluate((el) => el === document.activeElement),
          true,
        );
        await page
          .getByRole("button", { name: c.confirm, exact: true })
          .click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: c.launch, exact: true })
          .click();
        await page.waitForURL(/\/batches\/700$/);
        await page
          .getByRole("heading", { name: c.common, exact: true })
          .waitFor();
        assert.equal(
          posts.filter((p) => p.path.endsWith("/domain-batches")).length,
          1,
        );
        assert.equal(posts.at(-1).body.selectedPageIds.length, 6);
        if (width === 1056 || width === 320) {
          for (const state of ["zero", "unknown", "unlimited", "expired"]) {
            mode = state;
            await visit("/account/domains/new?discovery=600");
            await page.getByLabel(c.profile, { exact: true }).waitFor();
            if (state === "expired")
              await page.getByText(c.expired, { exact: true }).waitFor();
            if (state === "unknown")
              await page
                .getByText(c.quotaUnknown, { exact: true })
                .first()
                .waitFor();
            await check(state);
            assert.equal(
              await page
                .getByRole("button", { name: c.confirm, exact: true })
                .isEnabled(),
              state === "unlimited",
            );
          }
          mode = "quota-changed";
          await visit("/account/domains/new?discovery=600");
          await page
            .getByRole("button", { name: c.confirm, exact: true })
            .click();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: c.launch, exact: true })
            .click();
          await page.locator("main").getByRole("alert").waitFor();
          await check("quota-changed");
          assert.equal(
            await page.getByRole("checkbox", { checked: true }).count(),
            6,
          );
          assert.equal(new URL(page.url()).searchParams.has("request"), false);
          mode = "lost";
          await visit("/account/domains/new?discovery=600");
          await page
            .getByRole("button", { name: c.confirm, exact: true })
            .click();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: c.launch, exact: true })
            .click();
          await page
            .getByRole("button", { name: c.retryRequest, exact: true })
            .waitFor();
          const last = posts.at(-1);
          await page.reload();
          await page
            .getByRole("button", { name: c.retryRequest, exact: true })
            .waitFor();
          await check("lost-response");
          await page
            .getByRole("button", { name: c.retryRequest, exact: true })
            .click();
          await page.waitForURL(/\/batches\/700$/);
          assert.deepEqual(
            posts.at(-1),
            last,
            "Explicit retry preserves exact idempotency/body across reload",
          );
          mode = "active";
          await visit("/account/domains/7/batches/700");
          await page
            .getByRole("button", { name: c.cancelBatch, exact: true })
            .waitFor();
          await check("running");
          await page
            .getByRole("button", { name: c.cancelBatch, exact: true })
            .click();
          await page.getByRole("dialog").waitFor();
          await page.keyboard.press("Escape");
          assert.equal(
            posts.filter((p) => p.path.endsWith("/cancel")).length,
            0,
          );
          await page
            .getByRole("button", { name: c.cancelBatch, exact: true })
            .click();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: c.cancelBatch, exact: true })
            .click();
          await page.getByText(c.cancelRequested, { exact: true }).waitFor();
          await check("cancel-requested");
          mode = "missing";
          await visit("/account/domains/7/batches/700");
          await page.locator("main").getByRole("alert").waitFor();
          await check("missing");
          mode = "empty";
          await visit("/account/domains");
          await page
            .getByRole("heading", { name: c.empty, exact: true })
            .waitFor();
          await check("empty");
        }
        assert.deepEqual(errors, []);
        await context.close();
      }
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        fixtures:
          "Synthetic UI responses; see domain-browser.mjs for real Java/MariaDB lifecycle.",
        checks: evidence,
      },
      null,
      2,
    ),
  );
  console.log(`${evidence.length} domain UI checks passed`);
} catch (error) {
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
  throw error;
} finally {
  await browser.close();
}
