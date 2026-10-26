import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importSpareClassification, mergeSpareClassification } from '../shared/spareClassification';
import { applyClassificationEvent, validateFullRowClassification } from '../server/modules/sync/spareClassificationSync';

const options = [
  { listKey: 'essential', listValue: 'Essential' },
  { listKey: 'optimum', listValue: 'Optimal quantity' },
  { listKey: 'general', listValue: 'General' },
  { listKey: 'custom', listValue: 'Other supplies' },
];
test('legacy import omits both properties; new/partial format is not legacy', () => {
  assert.deepEqual(importSpareClassification({}, options), {});
  assert.throws(() => importSpareClassification({ 'Spare Category': '' }, options), /both/);
  assert.throws(() => importSpareClassification({ 'Spare Category': '', 'Optimum Qty': '' }, options), /valid/);
  assert.deepEqual(importSpareClassification({ 'Spare Category': 'Optimal quantity', 'Optimum Qty': '12' }, options),
    { spareCategory: 'optimum', optimumQty: 12 });
});
test('edited labels do not change the designated optimum key; custom categories need no quantity', () => {
  assert.deepEqual(importSpareClassification({ 'Spare Category': 'Other supplies', 'Optimum Qty': '' }, options),
    { spareCategory: 'custom', optimumQty: null });
  assert.throws(() => importSpareClassification({ 'Spare Category': 'Other supplies', 'Optimum Qty': 2 }, options));
});
test('quantity rejects decimals, zero, negatives, overflow, junk and booleans', () => {
  for (const value of [0, -1, 1.5, '1.5', '2junk', '1e3', true, {}, 2147483648, NaN, Infinity]) {
    assert.throws(() => mergeSpareClassification({}, { spareCategory: 'optimum', optimumQty: value }), String(value));
  }
  assert.equal(mergeSpareClassification({}, { spareCategory: 'optimum', optimumQty: 2147483647 }).optimumQty, 2147483647);
});
test('omitted sync fields preserve the receiver; explicit null clears only a valid pair', () => {
  const saved = { spareCategory: 'optimum', optimumQty: 8 };
  assert.deepEqual(mergeSpareClassification(saved, {}), saved);
  assert.deepEqual(mergeSpareClassification(saved, { optimum_qty: '9' }), { spareCategory: 'optimum', optimumQty: 9 });
  assert.throws(() => mergeSpareClassification(saved, { spare_category: 'essential' }));
  assert.throws(() => mergeSpareClassification(saved, { optimum_qty: null }));
  assert.deepEqual(mergeSpareClassification(saved, { spare_category: 'essential', optimum_qty: null }),
    { spareCategory: 'essential', optimumQty: null });
  assert.throws(() => mergeSpareClassification({}, {}, true), /required/);
});
test('push/pull event applies companion fields once in one SQL update with no sync echo', async () => {
  const calls: Array<{ text: string; values?: any[] }> = [];
  const conn = { query: async (text: string, values?: any[]) => {
    calls.push({ text, values });
    if (text.startsWith('SELECT spare')) return { rows: [{ spare_category: 'general', optimum_qty: null }] };
    if (text.includes('FROM sync_field_log')) return { rows: [] };
    return { rows: [], rowCount: 1 };
  } };
  const logs = ['spareCategory', 'optimumQty'].map((fieldName, i) => ({
    tableName: 'spares', fieldName, rowUuid: 'spare', instanceId: 'sender',
    changedAt: '2026-10-26T00:00:00Z', oldValue: null, newValue: i ? '5' : 'optimum',
  }));
  const guard = async () => ({ skip: false });
  assert.equal(await applyClassificationEvent(conn, logs[0], logs, 'receiver', 'batch', guard), true);
  assert.equal(await applyClassificationEvent(conn, logs[1], logs, 'receiver', 'batch', guard), true);
  const updates = calls.filter(call => call.text.startsWith('UPDATE'));
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].values?.slice(0, 2), ['optimum', 5]);
  assert.equal(calls.filter(call => call.text.startsWith('INSERT INTO sync_field_log')).length, 0);
});
test('old schema with classification values is retryable, never silently ACKed', async () => {
  await assert.rejects(validateFullRowClassification(
    { query: async () => ({ rows: [] }) }, 'fleet_spares', { spare_category: 'general' },
  ), /Retryable/);
  await validateFullRowClassification({ query: async () => { throw new Error('must not query'); } },
    'fleet_spares', { part_name: 'older sender' });
});
