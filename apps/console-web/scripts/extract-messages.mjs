// Static inventory: UI copy only. Does not contact any service or read user data.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import ts from "typescript";
import { reportMessages } from "./report-message-inventory.mjs";
const root = path.resolve(__dirname, "../src");
const sources = { en: new Set(), fr: new Set() };
const protectedKeys = new Set(["code", "id", "key", "keys", "route", "englishRoute", "path", "slug", "sourceUrl", "verifiedAt", "dateTime", "href", "className", "@type", "@context", "inLanguage"]);
function add(value, language) {
  const text = value.trim().replace(/\r\n/g, "\n");
  if (["fr", "en", "styles", "use client", "Argos", "Antoine LE LOUËT"].includes(text)) return;
  if (!/[A-Za-zÀ-ž]/.test(text) || text.length < 2 || /^(https?:|\/|#|@|--|\.|\w+\.[\w.]+$)/.test(text)) return;
  if (/^[A-Z_\d-]+$/.test(text) && !["URL", "HTML", "CSS", "SEO", "HTTP", "HTTPS", "SSL", "TLS", "API", "CMS", "LCP", "FCP", "CLS", "TTI", "TBT", "OK"].includes(text)) return;
  if (/<\/?[a-z]|=>/i.test(text)) return;
  sources[language].add(text);
}
function strings(node, language) {
  if (ts.isJsxElement(node) && ["code", "pre"].includes(node.openingElement.tagName.getText())) return;
  if (ts.isPropertyAssignment(node)) {
    if (protectedKeys.has(node.name.getText().replace(/["']/g, ""))) return;
    if (node.name.getText().replace(/["']/g, "") === "example" && /findingPlaybooks|findingRuleGuidance/.test(node.getSourceFile().fileName)) return;
    if (["before", "after"].includes(node.name.getText().replace(/["']/g, "")) && /englishTopicAudits/.test(node.getSourceFile().fileName)) return;
    strings(node.initializer, language); return;
  }
  if (ts.isJsxAttribute(node) && !["title", "aria-label", "alt", "placeholder", "contents", "related"].includes(node.name.getText())) return;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) { add(node.text, language); return; }
  if (ts.isJsxText(node)) { add(node.text.replace(/&(?:amp|apos|quot|lt|gt|nbsp);/g, entity => ({ "&amp;": "&", "&apos;": "'", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&nbsp;": " " })[entity]).replace(/\s+/g, " "), language); return; }
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
  ts.forEachChild(node, child => strings(child, language));
}
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]); }
for (const file of walk(root).filter(file => /\.tsx?$/.test(file) && !/\.test\./.test(file))) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const frenchOnly = /guides[\\/](?:cls-eleve|refonte-site-web|accessibilite-moteurs-ia)[\\/]page\.tsx$|guides[\\/](?:GuideArticle|ClsDemo)\.tsx$|lib[\\/]diagnosticGuides\.ts$/.test(file);
  if (frenchOnly) { strings(source, "fr"); continue; }
  if (file.endsWith("englishTopicAudits.ts")) { strings(source, "en"); continue; }
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(source).replace(/["']/g, "") === "en") strings(node.initializer, "en");
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(source);
      if (["localizeValue", "translateText"].includes(name) && node.arguments[0]) strings(node.arguments[0], frenchOnly ? "fr" : "en");
      if (name === "add" && node.arguments.length === 3) strings(node.arguments[2], "en");
      if (name === "localizedMetadata" && node.arguments[1]?.getText(source) === '"en"') for (const item of node.arguments.slice(2)) strings(item, "en");
      if (name === "requestMetadata" && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
        for (const property of node.arguments[0].properties) {
          if (ts.isPropertyAssignment(property) && ["title", "description", "keywords"].includes(property.name.getText(source))) {
            if (ts.isObjectLiteralExpression(property.initializer)) {
              for (const title of property.initializer.properties)
                if (ts.isPropertyAssignment(title) && title.name.getText(source) !== "template") strings(title.initializer, "en");
            } else if (ts.isStringLiteral(property.initializer) || ts.isArrayLiteralExpression(property.initializer)) strings(property.initializer, "en");
          }
        }
      }
    }
    // Older copy tables store [French, English] label pairs.
    if (ts.isArrayLiteralExpression(node) && node.elements.length === 2 && node.elements.every(ts.isStringLiteral)
      && /collector-reason|findingPresentation|CollectionGaps/.test(file)) strings(node.elements[1], "en");
    ts.forEachChild(node, visit);
  }
  visit(source);
}
function leaves(value) { if (typeof value === "string") add(value, "en"); else if (value && typeof value === "object") Object.values(value).forEach(leaves); }
leaves(JSON.parse(fs.readFileSync(path.join(root, "lib/i18n/en.json"), "utf8")));
reportMessages(root).forEach(text => add(text, "en"));
const email = fs.readFileSync(path.resolve(__dirname, "../../api-backend/src/main/java/com/dokor/argos/services/account/AccountEmail.java"), "utf8");
for (const match of email.matchAll(/copy\(lang,\s*("(?:\\.|[^"\\])*")/g)) add(JSON.parse(match[1]), "en");
const checklist = fs.readFileSync(path.resolve(__dirname, "../public/downloads/grille-recette-refonte.csv"), "utf8");
checklist.split(/[;\r\n]/).filter(Boolean).forEach(text => add(text, "fr"));
add("Démonstration de décalage de mise en page", "fr");
const inventory = Object.fromEntries(Object.entries(sources).map(([language, values]) => [language, [...values].sort()]));
const target = path.join(root, "lib/i18n/catalogues/source.json");
const rendered = JSON.stringify(inventory, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== rendered) { console.error("Translation source inventory needs updating: npm run i18n:extract"); process.exitCode = 1; }
} else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, rendered); }
console.log(Object.fromEntries(Object.entries(inventory).map(([language, values]) => [language, { messages: values.length, characters: values.join("").length }])));
