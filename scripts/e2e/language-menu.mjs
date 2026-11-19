import assert from 'node:assert/strict';

const triggerSelector = 'details:has(> nav a[hreflang]) > summary';

// Exercise the disclosure before selecting a language, as a keyboard user would.
export async function openLanguageMenu(page) {
  const trigger = page.locator(triggerSelector);
  await trigger.press('Enter');
  const menu = trigger.locator('..').getByRole('navigation');
  await menu.waitFor();
  assert.equal(await menu.getByRole('link').count(), 22, 'Every supported language is offered');
  return menu;
}

export async function languageHref(page, name) {
  const menu = await openLanguageMenu(page);
  const href = await menu.getByRole('link', { name, exact: true }).getAttribute('href');
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  assert.ok(await page.locator(triggerSelector)
    .evaluate(element => element === document.activeElement), 'Escape returns focus to the language trigger');
  return href;
}

export async function switchLanguage(page, name) {
  const menu = await openLanguageMenu(page);
  await menu.getByRole('link', { name, exact: true }).click();
}
