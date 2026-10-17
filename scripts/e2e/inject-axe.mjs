import { readFile } from 'node:fs/promises';

let source;
/** Inject trusted test tooling through the debugger; keep the page's actual CSP enforced. */
export async function injectAxe(page) {
  source ??= readFile(new URL('../../apps/console-web/node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
  await page.evaluate(await source);
}
