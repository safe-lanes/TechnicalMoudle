import { describe, it, expect } from 'vitest';
import {
  computeSpareConsumptionDelta,
  makeCompositeKey,
  ConsumedSpareEntry,
} from '../spareConsumptionDelta';

describe('makeCompositeKey', () => {
  it('creates key from partKey and lowercased trimmed location', () => {
    expect(makeCompositeKey('PART001', 'Engine Room')).toBe('PART001::engine room');
  });

  it('handles empty location', () => {
    expect(makeCompositeKey('PART001', '')).toBe('PART001::');
  });

  it('trims whitespace from location', () => {
    expect(makeCompositeKey('PART001', '  Deck Store  ')).toBe('PART001::deck store');
  });
});

describe('computeSpareConsumptionDelta', () => {
  it('returns positive deltas on first save (no previous consumed)', () => {
    const current: ConsumedSpareEntry[] = [
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 3, location: 'Engine Room' },
      { partNo: 'P002', quantityConsumed: 2, location: 'Deck Store' },
    ];
    const result = computeSpareConsumptionDelta(current, []);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ partKey: 'PC001', qty: 3, reverseQty: 0, locationName: 'Engine Room', lineIndex: 0 });
    expect(result[1]).toMatchObject({ partKey: 'P002', qty: 2, reverseQty: 0, locationName: 'Deck Store', lineIndex: 1 });
  });

  it('returns empty array when re-saved with same quantities (no delta)', () => {
    const current: ConsumedSpareEntry[] = [
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 3, location: 'Engine Room' },
    ];
    const previous: ConsumedSpareEntry[] = [
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 3, location: 'Engine Room', _deductedQty: 3 },
    ];
    const result = computeSpareConsumptionDelta(current, previous);

    expect(result).toHaveLength(0);
  });

  it('returns positive delta when quantity is increased', () => {
    const current: ConsumedSpareEntry[] = [
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 5, location: 'Engine Room' },
    ];
    const previous: ConsumedSpareEntry[] = [
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 3, location: 'Engine Room', _deductedQty: 3 },
    ];
    const result = computeSpareConsumptionDelta(current, previous);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ partKey: 'PC001', qty: 2, reverseQty: 0, lineIndex: 0 });
  });

  it('returns reversal when quantity is decreased', () => {
    const current: ConsumedSpareEntry[] = [
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 1, location: 'Engine Room' },
    ];
    const previous: ConsumedSpareEntry[] = [
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 3, location: 'Engine Room', _deductedQty: 3 },
    ];
    const result = computeSpareConsumptionDelta(current, previous);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ partKey: 'PC001', qty: 0, reverseQty: 2, lineIndex: 0 });
  });

  it('returns full reversal when a line is removed', () => {
    const current: ConsumedSpareEntry[] = [];
    const previous: ConsumedSpareEntry[] = [
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 5, location: 'Engine Room', _deductedQty: 5 },
    ];
    const result = computeSpareConsumptionDelta(current, previous);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ partKey: 'PC001', qty: 0, reverseQty: 5, lineIndex: -1 });
  });

  it('tracks same spare at two different locations independently', () => {
    const current: ConsumedSpareEntry[] = [
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 2, location: 'Engine Room' },
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 3, location: 'Deck Store' },
    ];
    const previous: ConsumedSpareEntry[] = [
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 1, location: 'Engine Room', _deductedQty: 1 },
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 3, location: 'Deck Store', _deductedQty: 3 },
    ];
    const result = computeSpareConsumptionDelta(current, previous);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ partKey: 'PC001', qty: 1, reverseQty: 0, locationName: 'Engine Room', lineIndex: 0 });
  });

  it('matches location names case-insensitively', () => {
    const current: ConsumedSpareEntry[] = [
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 5, location: 'engine room' },
    ];
    const previous: ConsumedSpareEntry[] = [
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 5, location: 'Engine Room', _deductedQty: 5 },
    ];
    const result = computeSpareConsumptionDelta(current, previous);

    expect(result).toHaveLength(0);
  });

  it('parses string quantities correctly', () => {
    const current: ConsumedSpareEntry[] = [
      { partNo: 'P001', quantityConsumed: '4', location: 'Engine Room' },
    ];
    const previous: ConsumedSpareEntry[] = [
      { partNo: 'P001', quantityConsumed: '2', location: 'Engine Room', _deductedQty: 2 },
    ];
    const result = computeSpareConsumptionDelta(current, previous);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ partKey: 'P001', qty: 2, reverseQty: 0 });
  });

  it('treats zero quantity as no consumption (no positive delta)', () => {
    const current: ConsumedSpareEntry[] = [
      { partNo: 'P001', quantityConsumed: 0, location: 'Engine Room' },
    ];
    const result = computeSpareConsumptionDelta(current, []);

    expect(result).toHaveLength(0);
  });

  it('uses partNo as fallback when partCode is missing', () => {
    const current: ConsumedSpareEntry[] = [
      { partNo: 'FIG-123', quantityConsumed: 2, location: 'Deck Store' },
    ];
    const previous: ConsumedSpareEntry[] = [
      { partNo: 'FIG-123', quantityConsumed: 1, location: 'Deck Store', _deductedQty: 1 },
    ];
    const result = computeSpareConsumptionDelta(current, previous);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ partKey: 'FIG-123', qty: 1, reverseQty: 0 });
  });

  it('skips entries with empty or null location', () => {
    const current: ConsumedSpareEntry[] = [
      { partNo: 'P001', quantityConsumed: 5, location: '' },
      { partNo: 'P002', quantityConsumed: 3 },
      { partNo: 'P003', quantityConsumed: 2, location: 'Valid Location' },
    ];
    const result = computeSpareConsumptionDelta(current, []);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ partKey: 'P003', qty: 2, locationName: 'Valid Location' });
  });

  it('handles mixed scenario: increase, decrease, removal, and new entry', () => {
    const current: ConsumedSpareEntry[] = [
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 5, location: 'Engine Room' },
      { partNo: 'P002', partCode: 'PC002', quantityConsumed: 1, location: 'Deck Store' },
      { partNo: 'P004', partCode: 'PC004', quantityConsumed: 4, location: 'Bridge' },
    ];
    const previous: ConsumedSpareEntry[] = [
      { partNo: 'P001', partCode: 'PC001', quantityConsumed: 3, location: 'Engine Room', _deductedQty: 3 },
      { partNo: 'P002', partCode: 'PC002', quantityConsumed: 3, location: 'Deck Store', _deductedQty: 3 },
      { partNo: 'P003', partCode: 'PC003', quantityConsumed: 2, location: 'Galley', _deductedQty: 2 },
    ];
    const result = computeSpareConsumptionDelta(current, previous);

    const increase = result.find(r => r.partKey === 'PC001');
    expect(increase).toMatchObject({ qty: 2, reverseQty: 0, lineIndex: 0 });

    const decrease = result.find(r => r.partKey === 'PC002');
    expect(decrease).toMatchObject({ qty: 0, reverseQty: 2, lineIndex: 1 });

    const removed = result.find(r => r.partKey === 'PC003');
    expect(removed).toMatchObject({ qty: 0, reverseQty: 2, lineIndex: -1 });

    const newEntry = result.find(r => r.partKey === 'PC004');
    expect(newEntry).toMatchObject({ qty: 4, reverseQty: 0, lineIndex: 2 });

    expect(result).toHaveLength(4);
  });

  it('uses locationName field when location field is absent', () => {
    const current: ConsumedSpareEntry[] = [
      { partNo: 'P001', quantityConsumed: 3, locationName: 'Engine Room' },
    ];
    const previous: ConsumedSpareEntry[] = [
      { partNo: 'P001', quantityConsumed: 2, locationName: 'Engine Room', _deductedQty: 2 },
    ];
    const result = computeSpareConsumptionDelta(current, previous);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ partKey: 'P001', qty: 1, reverseQty: 0 });
  });

  it('does not produce delta for previous entries with zero _deductedQty', () => {
    const current: ConsumedSpareEntry[] = [];
    const previous: ConsumedSpareEntry[] = [
      { partNo: 'P001', quantityConsumed: 5, location: 'Engine Room', _deductedQty: 0 },
    ];
    const result = computeSpareConsumptionDelta(current, previous);

    expect(result).toHaveLength(0);
  });
});
