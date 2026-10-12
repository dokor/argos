import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const markers = /(?:\bas an ai language model\b|\ben tant que modèle de langage\b|\[INSERT (?:TEXT|COPY) HERE\]|\[INSÉRER LE TEXTE\]|<\|(?:im_start|im_end|system|assistant)\|>)/i;
const variables = value => (value.match(/\{[A-Za-z][A-Za-z0-9_]*\}/g) ?? []).sort();

// Structural checks only. Naturalness, accuracy and completeness require a reader.
export function checkPair(fr, en, prefix = '') {
  const errors = [];
  const visit = (a, b, key) => {
    if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || a === null || b === null) {
      errors.push(`${key}: different or unsupported structures`); return;
    }
    if (typeof a === 'string') {
      for (const [lang, value] of [['fr', a], ['en', b]]) {
        if (!value.trim()) errors.push(`${key} (${lang}): empty text`);
        if (markers.test(value)) errors.push(`${key} (${lang}): explicit drafting marker`);
      }
      if (JSON.stringify(variables(a)) !== JSON.stringify(variables(b))) errors.push(`${key}: interpolation variables differ`);
    } else if (typeof a === 'object') {
      for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const child = key ? `${key}.${name}` : name;
        if (!(name in a) || !(name in b)) errors.push(`${child}: missing translation`);
        else visit(a[name], b[name], child);
      }
    } else errors.push(`${key}: expected text, array or object`);
  };
  visit(fr, en, prefix);
  return errors;
}

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? files(name) : [name];
  }).sort();
}

export function inventory() {
  const sourceFiles = files(path.join(app, 'src')).filter(file => /\.(?:tsx?|json)$/.test(file) && !/\.(?:test|spec)\./.test(file));
  const pages = sourceFiles.filter(file => file.endsWith(`${path.sep}page.tsx`)).map(file => {
    const source = path.relative(app, file).replaceAll(path.sep, '/');
    const route = '/' + source.replace(/^src\/app\//, '').replace(/(?:\([^/]+\)\/)?page\.tsx$/, '').replace(/\([^/]+\)\//g, '').replace(/\/$/, '');
    return { route, language: route.startsWith('/en') ? 'en' : 'fr', source };
  });
  const candidates = [];
  for (const file of sourceFiles.filter(file => /\.tsx?$/.test(file))) {
    const text = fs.readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const source = path.relative(app, file).replaceAll(path.sep, '/');
    const visit = node => {
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) && node.text.trim().length > 10
        && !ts.isImportDeclaration(node.parent) && !ts.isExportDeclaration(node.parent)) {
        candidates.push({ source, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, text: node.text.trim() });
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  return { note: 'Source candidates, including technical literals. Visibility, language coverage, tone and factual accuracy require human review in the rendered pages.', pages, dictionaries: ['src/lib/i18n/fr.json', 'src/lib/i18n/en.json'], candidates };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const read = lang => JSON.parse(fs.readFileSync(path.join(app, `src/lib/i18n/${lang}.json`), 'utf8'));
  const errors = checkPair(read('fr'), read('en'));
  const result = inventory();
  for (const candidate of result.candidates) if (markers.test(candidate.text)) errors.push(`${candidate.source}:${candidate.line}: explicit drafting marker`);
  const index = process.argv.indexOf('--inventory');
  if (index >= 0) {
    if (!process.argv[index + 1]) throw new Error('--inventory requires an output file');
    fs.writeFileSync(process.argv[index + 1], JSON.stringify(result, null, 2) + '\n');
  }
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log(`Editorial structure OK: FR/EN keys, non-empty texts and variables; ${result.pages.length} routes and ${result.candidates.length} source candidates inventoried. Human review still required.`);
}
