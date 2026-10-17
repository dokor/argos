// Build an offline gallery from the synthetic exports of the production renderer.
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'docs/accounts/email-previews');
const kinds = ['verify', 'reset', 'reauth', 'password_changed', 'method_added', 'method_removed'];
const messages = [];
for (const kind of kinds) for (const language of ['fr', 'en']) {
  const name = `${kind}-${language}`;
  const html = await readFile(path.join(directory, `${name}.html`), 'utf8');
  const text = await readFile(path.join(directory, `${name}.txt`), 'utf8');
  // These are controlled renderer exports, not arbitrary HTML or user input.
  const preview = html.match(/<body\b[^>]*>\s*<div\b[^>]*>([\s\S]*?)<\/div>/)?.[1];
  if (!preview || !html.includes('https://argos.example/') || !text.startsWith('Argos — ')) {
    throw new Error(`Invalid synthetic export: ${name}`);
  }
  messages.push({kind, language, html, text, subject: text.split(/\r?\n/)[0], preview});
}
const template = await readFile(path.join(root, 'scripts/templates/account-email-gallery.html'), 'utf8');
// Keep script termination and HTML entities inert when embedding the exported messages.
const data = JSON.stringify(messages).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
const output = path.join(directory, 'index.html');
await writeFile(output, template.replace('/* EMAIL_DATA */ []', data));
console.log(`Built ${messages.length} synthetic email previews: ${output}`);
