import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import ts from "typescript";

// These local modules build editorial copy from rule tables and shared sentences.
// Evaluate those pure tables so composed descriptions are inventoried as rendered,
// including rows whose English text is passed through a factory argument.
export function reportMessages(root) {
  const require = createRequire(import.meta.url);
  const previousExtension = Module._extensions[".ts"];
  const previousResolve = Module._resolveFilename;
  try {
    Module._extensions[".ts"] = (module, filename) => {
      const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      }).outputText;
      module._compile(source, filename);
    };
    Module._resolveFilename = function (request, ...args) {
      return previousResolve.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args);
    };
    const { rulePlaybooks } = require(path.join(root, "components/report/findingPlaybooks.ts"));
    const { supportedFindingKeys, findingEditorial } = require(path.join(root, "components/report/findingCatalogue.ts"));
    const values = [];
    function visit(value, key) {
      if (["example", "reference", "verifiedAt", "keys"].includes(key)) return;
      if (typeof value === "string") values.push(value);
      else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => visit(item, key));
    }
    Object.values(rulePlaybooks).forEach(entry => visit(entry.en));
    supportedFindingKeys.forEach(key => visit(findingEditorial(key, "en")));
    return values;
  } finally {
    if (previousExtension) Module._extensions[".ts"] = previousExtension;
    else delete Module._extensions[".ts"];
    Module._resolveFilename = previousResolve;
  }
}
