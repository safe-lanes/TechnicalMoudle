// Execute uniquely selected current source with explicit fake boundaries only.
// Baseline variants reverse only the approved local corrections; independent
// output/payload assertions in the suites protect the surrounding contracts.
const probe = require('./severeSourceProbe.cjs');
const changes = [
  ['[...new Set(history.map(h => h.workOrderId))]', 'Array.from(new Set(history.map(h => h.workOrderId)))'],
  ['[...new Set([...existingLinks, ...linkedDefectIds])]', 'Array.from(new Set([...existingLinks, ...linkedDefectIds]))'],
  ['for (const spareId of linkedSpareIds)', 'for (const spareId of Array.from(linkedSpareIds))'],
  ['for (const uuid of teamUuids)', 'for (const uuid of Array.from(teamUuids))'],
  ['componentName: component.description ||', 'componentName: component.name ||'],
];

function variant(text, candidate) {
  for (const [before, after] of changes) {
    text = text.replace(after, before);
    if (candidate) text = text.replace(before, after);
  }
  return text;
}

function method(name, globals, candidate, file = 'server/postgresStorage.ts', imports = {}) {
  const text = probe.extract(file,
    n => probe.ts.isMethodDeclaration(n) && n.name.getText() === name);
  return probe.evaluate(`class Subject { ${variant(text, candidate)} }\nmodule.exports=Subject;`,
    { Date, ...globals }, imports);
}

function fn(file, name, globals, candidate, imports = {}, prefix = '') {
  return probe.exported(prefix + '\n' + variant(probe.functionText(file, name), candidate),
    name, { Date, ...globals }, imports);
}

// A thenable query builder captures predicates/projections/order, but never
// imports a DB client or executes SQL. Rows are exclusively fixture-supplied.
function queryDb(rows) {
  const calls = [];
  let index = 0;
  return {
    calls,
    db: {
      select(projection) {
        const result = rows[index++];
        if (result === undefined) throw Error('Unexpected fixture query');
        const call = { projection };
        const q = {
          from(table) { call.from = table; return q; },
          where(predicate) { call.where = predicate; return q; },
          innerJoin(table, predicate) { call.join = [table, predicate]; return q; },
          orderBy(order) { call.orderBy = order; return q; },
          then(resolve, reject) {
            calls.push(call);
            return Promise.resolve(result).then(resolve, reject);
          },
        };
        return q;
      },
    },
  };
}

const eq = (column, value) => ['eq', column, value];
const and = (...conditions) => ['and', ...conditions];
const or = (...conditions) => ['or', ...conditions];
const desc = column => ['desc', column];
const sql = (strings, ...values) => ({ strings: [...strings], values });
sql.join = (values, separator) => ({ values, separator });
module.exports = { probe, variant, method, fn, queryDb, eq, and, or, desc, sql };
