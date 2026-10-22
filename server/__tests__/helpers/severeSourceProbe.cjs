// Read-only probes for contracts that cannot safely import the live storage module.
// Imports and side effects are denied unless a test explicitly supplies a fake.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const dateFns = require('date-fns');

function source(file) {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

function extract(file, predicate) {
  const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true);
  const matches = [];
  function visit(node) {
    if (predicate(node)) matches.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (matches.length !== 1) {
    throw new Error(`Expected one source match in ${file}, found ${matches.length}`);
  }
  return matches[0];
}

function compile(text) {
  return ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
}

function evaluate(text, globals = {}, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(compile(text), {
    module,
    exports: module.exports,
    console: { log() {}, warn() {}, error() {} },
    ...globals,
    require(id) {
      if (!Object.prototype.hasOwnProperty.call(imports, id)) {
        throw new Error(`Impact probe blocked import: ${id}`);
      }
      return imports[id];
    },
  }, { timeout: 15000 });
  return module.exports;
}

function functionText(file, name) {
  return extract(file, node => ts.isFunctionDeclaration(node) && node.name?.text === name);
}

function methodText(name) {
  return extract('server/postgresStorage.ts',
    node => ts.isMethodDeclaration(node) && node.name?.getText() === name);
}

function method(name, globals) {
  return evaluate(`class Probe { ${methodText(name)} }\nmodule.exports = Probe;`, globals);
}

function exported(text, name, globals, imports) {
  return evaluate(`${text}\nmodule.exports = ${name};`, globals, imports);
}

function inheritanceGuard() {
  const text = source('server/modules/components/services/componentService.ts');
  const start = text.indexOf('  const effectiveRhType = data.rhCounterType || existingComponent.rhCounterType');
  const end = text.indexOf('    // Downgrade protection', start);
  if (start < 0 || end < start) throw new Error('Inherited update guard moved; review probe');
  return `${text.slice(start, end)}\n}`;
}

module.exports = {
  ts, source, extract, compile, evaluate, functionText, methodText, method,
  exported, inheritanceGuard, dateFns,
};
