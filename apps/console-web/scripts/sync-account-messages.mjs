import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const backend = path.join(root, "apps/api-backend/src/main");
const source = fs.readFileSync(path.join(backend, "java/com/dokor/argos/services/account/AccountEmail.java"), "utf8");
const keys = [...new Set([...source.matchAll(/copy\(lang,\s*("(?:\\.|[^"\\])*")/g)].map(match => JSON.parse(match[1]).trim()))].sort();
const locales = JSON.parse(fs.readFileSync(path.join(root, "apps/console-web/src/lib/i18n/emergency.json"), "utf8"));
const check = process.argv.includes("--check");
for (const lang of Object.keys(locales).filter(lang => !["fr", "en"].includes(lang))) {
  const messages = JSON.parse(fs.readFileSync(path.join(root, `apps/console-web/src/lib/i18n/catalogues/${lang}.json`), "utf8"));
  for (const key of keys) if (!messages[key]?.trim()) throw new Error(`Missing ${lang} account message: ${key}`);
  const content = JSON.stringify(Object.fromEntries(keys.map(key => [key, messages[key]])), null, 2) + "\n";
  const target = path.join(backend, `resources/i18n/account/${lang}.json`);
  if (check) {
    if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== content) throw new Error(`Account catalogue out of date: ${lang}`);
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}
console.log(`Account messages: ${keys.length} entries per language.`);
