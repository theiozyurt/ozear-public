import { createRequire } from "node:module";
import vm from "node:vm";
import fs from "node:fs";
const rootRequire = createRequire(new URL("../package.json", import.meta.url));
let dependencyRequire = rootRequire;
try {
  dependencyRequire.resolve("typescript");
} catch {
  dependencyRequire = createRequire(
    new URL("../.sites-runtime/check-deps/package.json", import.meta.url),
  );
}
export const ts = dependencyRequire("typescript");
export function loadTs(file, mocks = {}) {
  const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
    reportDiagnostics: true,
    fileName: String(file),
  });
  const loadedModule = { exports: {} };
  const require = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith(".")) {
      if (name.endsWith(".json"))
        return JSON.parse(fs.readFileSync(new URL(name, new URL(file, import.meta.url)), "utf8"));
      const candidate = new URL(name + ".ts", new URL(file, import.meta.url));
      if (fs.existsSync(candidate)) return loadTs(candidate);
    }
    return dependencyRequire(name);
  };
  const compiled = vm.runInThisContext(
    `(function(require,module,exports){${output.outputText}\n})`,
    { filename: String(file) },
  );
  compiled(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
