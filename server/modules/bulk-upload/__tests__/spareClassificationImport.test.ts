import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { mergeSpareClassification } from '@shared/spareClassification';

vi.mock('../../../storage', () => ({ storage: { getMasterLists: async () => [
  { listKey: 'essential', listValue: 'Essential', isActive: true },
  { listKey: 'optimum', listValue: 'Target Stock', isActive: true },
  { listKey: 'general', listValue: 'General', isActive: true },
  { listKey: 'special', listValue: 'Optimum', isActive: true },
] } }));
vi.mock('../../spares/classification', () => ({ classificationForWrite: async (patch: any) =>
  mergeSpareClassification(undefined, patch, { required: true, categoryKeys: new Set(['essential', 'optimum', 'general', 'special']) }) }));

import { spareClassificationImport } from '../services/spareClassificationImport';
import { extractRawExcelData, normalizeColumnNames } from '../services/helpers';

describe('spare import compatibility', () => {
  it('keeps legacy fields absent rather than injecting General or null', async () => {
    expect(await spareClassificationImport({ 'Part Code': 'PT-OLD' })).toEqual({});
  });
  it('preserves headers with empty cells; blank category is not legacy', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([['Part Code', 'Spare Category', 'Optimum Qty'], ['PT-NEW', '', '']]);
    const rows = extractRawExcelData(sheet);
    expect(Object.keys(rows[0])).toContain('Spare Category');
    await expect(spareClassificationImport(rows[0])).rejects.toThrow('blank');
  });
  it('rejects partial structural mapping', async () => {
    await expect(spareClassificationImport({ 'Part Code': 'PT-X', 'Optimum Qty': '' })).rejects.toThrow('mapping');
  });
  it('accepts keys/current renamed labels without granting label-based Optimum semantics', async () => {
    expect(await spareClassificationImport({ 'Spare Category': 'Target Stock', 'Optimum Qty': 3 })).toEqual({ spareCategory: 'optimum', optimumQty: 3 });
    expect(await spareClassificationImport({ 'Spare Category': 'Optimum', 'Optimum Qty': '' })).toEqual({ spareCategory: 'special', optimumQty: null });
    await expect(spareClassificationImport({ 'Spare Category': 'Optimum', 'Optimum Qty': 3 })).rejects.toThrow('blank');
  });
  it('normalizes mappings for both templates and rejects non-integers', async () => {
    for (const type of ['spares', 'fleet-spares']) {
      const rows = normalizeColumnNames([{ spare_category: 'optimum', optimum_qty: '2.5' }], type);
      expect(rows[0]['Spare Category']).toBe('optimum');
      await expect(spareClassificationImport(rows[0])).rejects.toThrow('positive whole');
    }
  });
});
