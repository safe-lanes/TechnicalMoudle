import { describe, it, expect } from 'vitest';
import { mergeSpareClassification, spareClassificationTemplateMode, validateSpareClassification } from '@shared/spareClassification';

describe('spare classification policy', () => {
  const keys = new Set(['essential', 'optimum', 'general', 'custom-optimum-label']);
  it.each([undefined, null, '', 0, -1, 1.2, 'abc', '1.5', ' ', true, NaN, Infinity, 2147483648])('rejects invalid Optimum Qty %s', qty => {
    expect(() => validateSpareClassification({ spareCategory: 'optimum', optimumQty: qty })).toThrow('positive whole number');
  });
  it.each([1, '1', 2147483647])('accepts integer boundary %s', qty => {
    expect(validateSpareClassification({ spareCategory: 'optimum', optimumQty: qty }).optimumQty).toBe(Number(qty));
  });
  it('permits legacy unclassified creation but not normal creation', () => {
    expect(mergeSpareClassification(undefined, {})).toEqual({ spareCategory: null, optimumQty: null });
    expect(() => validateSpareClassification({}, { required: true })).toThrow('required');
  });
  it('preserves omitted fields, rejects invalid partial updates, accepts explicit clearing', () => {
    const saved = { spareCategory: 'optimum', optimumQty: 4 };
    expect(mergeSpareClassification(saved, {})).toEqual(saved);
    expect(() => mergeSpareClassification(saved, { spareCategory: 'essential' })).toThrow('blank');
    expect(() => mergeSpareClassification(saved, { optimumQty: null })).toThrow('positive');
    expect(mergeSpareClassification(saved, { spareCategory: 'essential', optimumQty: null })).toEqual({ spareCategory: 'essential', optimumQty: null });
  });
  it('does not infer policy from labels or allow unknown keys', () => {
    expect(validateSpareClassification({ spareCategory: 'custom-optimum-label' }, { categoryKeys: keys }).optimumQty).toBeNull();
    expect(() => validateSpareClassification({ spareCategory: 'Optimum', optimumQty: 2 }, { categoryKeys: keys })).toThrow('Unknown');
  });
  it('detects legacy structure, not empty cells; partial mappings are errors', () => {
    expect(spareClassificationTemplateMode(['Part Code'])).toBe('legacy');
    expect(spareClassificationTemplateMode(['Spare Category', 'Optimum Qty'])).toBe('classified');
    expect(() => spareClassificationTemplateMode(['Spare Category'])).toThrow('mapping');
    expect(() => spareClassificationTemplateMode(['Optimum Qty'])).toThrow('mapping');
  });
});
