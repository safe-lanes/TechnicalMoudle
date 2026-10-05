// Full current methods run in an isolated VM: no storage module, DB or logger imports.
// Baseline reverses only the three approved edits; explicit expectations protect
// payloads independently of the baseline/candidate comparison.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const p = require('./helpers/severeSourceProbe.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const fixedTime = '2026-10-05T09:00:00.000Z';
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedTime])); }
  static now() { return new Date(fixedTime).getTime(); }
}
const fixedMath = Object.create(Math);
fixedMath.random = () => 0.25;
const declaration = 'InsertComponent & { id?: Component["id"] }';

test('current source retains all three corrections and the unsupported recurrence field', () => {
  for (const name of ['createComponent', 'createFleetScopedComponent']) {
    assert.ok(p.methodText(name).includes(`component: ${declaration}`));
  }
  const recurring = p.methodText('calculateAndUpdateRecurringDefects');
  assert.ok(recurring.includes('of Array.from(defectGroups))'));
  assert.ok(recurring.includes('.set({ isRecurring: true, updatedAt: new Date() })'));
});

function methodText(name, candidate) {
  const current = p.methodText(name);
  if (name === 'calculateAndUpdateRecurringDefects') {
    const before = 'of defectGroups)';
    const after = 'of Array.from(defectGroups))';
    const baseline = current.replace(after, before);
    return candidate ? baseline.replace(before, after) : baseline;
  }
  const baseline = current.replace(declaration, 'InsertComponent');
  return candidate ? baseline.replace('component: InsertComponent',
    `component: ${declaration}`) : baseline;
}
function subject(name, globals, candidate) {
  return new (p.evaluate(`class Subject { ${methodText(name, candidate)} }\nmodule.exports=Subject;`,
    { Date: FixedDate, Math: fixedMath, ...globals }))();
}

for (const name of ['createComponent', 'createFleetScopedComponent']) {
  test(`${name}: declaration has identical executable emission`, () => {
    const wrap = text => `class Subject { ${text} }`;
    assert.equal(p.compile(wrap(methodText(name, true))),
      p.compile(wrap(methodText(name, false))));
  });

  for (const [label, extra] of [
    ['provided local ID', { id: 'local-007', dataScope: 'custom' }],
    ['empty local ID', { id: '', dataScope: '' }],
    ['absent local ID', {}],
    ['explicit undefined local ID and fleet scope', { id: undefined, dataScope: 'fleet' }],
  ]) {
    test(`${name}: preserves ${label}, UUID ownership, payload and returned record`, async () => {
      async function run(candidate) {
        const input = Object.freeze({
          cuuid: 'supplied-canonical-uuid', vesselId: 'ship-A', name: 'Pump',
          currentCumulativeRH: '123.40', notes: 'Unchanged', ...extra,
        });
        const calls = [];
        let uuidCalls = 0;
        const table = { table: 'components' };
        const returned = { persisted: true, id: 'returned-local-id' };
        const db = {
          insert(t) {
            calls.push(['insert', t]);
            return { values(payload) {
              calls.push(['values', payload]);
              return { returning: async () => {
                calls.push(['returning']);
                return [returned, { ignored: true }];
              } };
            } };
          },
        };
        const instance = subject(name, {
          getDb: async () => { calls.push(['getDb']); return db; },
          components: table,
          randomUUID: () => { uuidCalls++; return 'generated-canonical-uuid'; },
        }, candidate);
        const result = await instance[name](input);
        assert.equal(result, returned);
        const fleet = name === 'createFleetScopedComponent';
        const generatedId = `${fleet ? 'FC' : 'COMP'}-${FixedDate.now()}-${(0.25).toString(36).substr(2, 9)}`;
        assert.deepEqual(plain(calls), [
          ['getDb'], ['insert', table],
          ['values', plain({
            ...input, id: input.id || generatedId,
            cuuid: fleet ? input.cuuid : 'generated-canonical-uuid',
            dataScope: fleet ? 'fleet' : input.dataScope || 'vessel',
          })], ['returning'],
        ]);
        assert.equal(uuidCalls, fleet ? 0 : 1);
        return plain({ result, calls, uuidCalls, input });
      }
      assert.deepEqual(await run(true), await run(false));
    });
  }
}

const defect = (id, category, vesselId = 'ship-A') => Object.freeze({
  id: `local-${id}`, duuid: id, defectCategory: category, vesselId,
  notes: 'Preserve me', updatedAt: 'old-timestamp',
});
const recurrenceCases = [
  ['empty', [], []],
  ['single', [defect('a', 'engine')], []],
  ['unique categories', [defect('a', 'engine'), defect('b', 'deck')], []],
  ['repeated category', [defect('a', 'engine'), defect('b', 'engine')], ['a', 'b']],
  ['interleaved groups', [defect('a', 'engine'), defect('b', 'deck'), defect('c', 'engine'),
    defect('d', 'deck'), defect('e', 'single')], ['a', 'c', 'b', 'd']],
  ['uncategorized and vessel isolation', [defect('a', null), defect('b', ''),
    defect('c', 'engine', 'ship-B'), defect('d', 'engine', 'ship-B'),
    defect('e', 'engine')], ['a', 'b', 'c', 'd']],
  ['nullable vessel logger argument', [defect('a', 'engine', null),
    defect('b', 'engine', null)], ['a', 'b']],
];

async function runRecurrence(rows, order, candidate, { loggerFailure = false, missingUpdated = false } = {}) {
  const calls = [];
  const errors = [];
  const table = { vesselId: 'defects.vesselId', duuid: 'defects.duuid' };
  const eq = (column, value) => ['eq', column, value];
  const frozenRows = Object.freeze([...rows]);
  const db = {
    select() {
      calls.push(['select']);
      return { from(t) {
        calls.push(['from', t]);
        return { where: async predicate => {
          calls.push(['selectWhere', predicate]);
          return frozenRows;
        } };
      } };
    },
    update(t) {
      calls.push(['update', t]);
      return { set(payload) {
        calls.push(['set', payload]);
        return { where(predicate) {
          calls.push(['updateWhere', predicate]);
          return { returning: async () => {
            calls.push(['returning']);
            const original = rows.find(row => row.duuid === predicate[2]);
            return missingUpdated ? [] : [{ ...original, ...payload }];
          } };
        } };
      } };
    },
  };
  const instance = subject('calculateAndUpdateRecurringDefects', {
    getDb: async () => { calls.push(['getDb']); return db; },
    defects: table, eq,
    logFieldChanges: async (...args) => {
      calls.push(['log', ...args]);
      if (loggerFailure) throw Error('Fixture logging outage');
    },
    console: { error: (message, error) => errors.push([message, error.message]) },
  }, candidate);
  assert.equal(await instance.calculateAndUpdateRecurringDefects('requested-vessel'), undefined);
  const expected = [
    ['getDb'], ['select'], ['from', table],
    ['selectWhere', ['eq', table.vesselId, 'requested-vessel']],
  ];
  for (const id of order) {
    const original = rows.find(row => row.duuid === id);
    const payload = { isRecurring: true, updatedAt: fixedTime };
    expected.push(['update', table], ['set', payload],
      ['updateWhere', ['eq', table.duuid, id]], ['returning']);
    if (!missingUpdated) {
      expected.push(['log', 'defects', id, original.vesselId || null,
        original, { ...original, ...payload }, 'system']);
    }
  }
  assert.deepEqual(plain(calls), plain(expected));
  assert.deepEqual(errors, loggerFailure && !missingUpdated
    ? order.map(() => ['[FieldLogger] defect recurring:', 'Fixture logging outage']) : []);
  assert.deepEqual(frozenRows, rows);
  return plain({ calls, errors, rows });
}

for (const [label, rows, order] of recurrenceCases) {
  test(`recurrence: ${label} preserves selection, group order, updates and logs`, async () => {
    assert.deepEqual(await runRecurrence(rows, order, true), await runRecurrence(rows, order, false));
  });
}
for (const options of [{ loggerFailure: true }, { missingUpdated: true }]) {
  test(`recurrence: ${JSON.stringify(options)} preserves continued processing`, async () => {
    const rows = [defect('a', 'engine'), defect('b', 'engine'), defect('c', 'engine')];
    assert.deepEqual(await runRecurrence(rows, ['a', 'b', 'c'], true, options),
      await runRecurrence(rows, ['a', 'b', 'c'], false, options));
  });
}
