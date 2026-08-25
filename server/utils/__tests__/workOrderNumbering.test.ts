import { describe, expect, it } from 'vitest';
import {
  generatePlannedWorkOrderNumber,
  generateUnplannedWorkOrderNumber,
} from '../workOrderNumbering';
import {
  extractJobNoFromWorkOrderNo,
  isUnplannedWorkOrderNo,
} from '../workOrderStatus';

const year = new Date().getFullYear();
const vesselId = 'vessel-001';

function numberingStorage(vCode: string | null, workOrderNos: string[] = []) {
  return {
    getVessel: async (requestedVesselId: string) =>
      requestedVesselId === vesselId ? { vuuid: vesselId, vCode } : undefined,
    getWorkOrders: async (requestedVesselId?: string) => {
      expect(requestedVesselId).toBe(vesselId);
      return workOrderNos.map(workOrderNo => ({ workOrderNo }));
    },
  } as any;
}

describe('vessel-coded work order numbering', () => {
  it('uses the exact vessel UUID lookup and preserves leading zeroes in v_code', async () => {
    const number = await generatePlannedWorkOrderNumber(
      numberingStorage(' 001 '),
      'MKR-IN-00001',
      '601.001',
      vesselId,
    );

    expect(number).toBe(`001-MKR-IN-00001-601.001-${year}-001`);
  });

  it('continues planned sequences across legacy and vessel-prefixed numbers', async () => {
    const number = await generatePlannedWorkOrderNumber(
      numberingStorage('001', [
        `MKR-IN-00001-601.001-${year}-001`,
        `001-MKR-IN-00001-601.001-${year}-002`,
        `001-MKR-IN-00001-999.999-${year}-009`,
      ]),
      'MKR-IN-00001',
      '601.001',
      vesselId,
    );

    expect(number).toBe(`001-MKR-IN-00001-601.001-${year}-003`);
  });

  it('generates vessel-prefixed unplanned numbers and continues the legacy sequence', async () => {
    const number = await generateUnplannedWorkOrderNumber(
      numberingStorage('001', [
        `UWO-601.001-${year}-001`,
        `001-UWO-601.001-${year}-002`,
      ]),
      vesselId,
      '601.001',
    );

    expect(number).toBe(`001-UWO-601.001-${year}-003`);
  });

  it('rejects generation when the exact vessel has no external code', async () => {
    await expect(
      generatePlannedWorkOrderNumber(
        numberingStorage(null),
        'MKR-IN-00001',
        '601.001',
        vesselId,
      ),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      details: {
        code: 'VESSEL_CODE_REQUIRED_FOR_WO_NUMBER',
        vesselId,
      },
    });
  });
});

describe('work order number compatibility', () => {
  it('extracts the job number from both legacy and vessel-prefixed planned numbers', () => {
    expect(
      extractJobNoFromWorkOrderNo(`MKR-IN-00001-601.001-${year}-001`),
    ).toBe('MKR-IN-00001');
    expect(
      extractJobNoFromWorkOrderNo(`001-MKR-IN-00001-601.001-${year}-001`),
    ).toBe('MKR-IN-00001');
    expect(
      extractJobNoFromWorkOrderNo(`GAS-MIA-MKR-IN-00001-601.001-${year}-001`, 'GAS-MIA'),
    ).toBe('MKR-IN-00001');
    expect(
      extractJobNoFromWorkOrderNo(`GAS-MIA-JOB-42-601.001-${year}-001`, 'GAS-MIA'),
    ).toBe('JOB-42');
  });

  it('classifies legacy and vessel-prefixed UWO numbers as unplanned', () => {
    expect(isUnplannedWorkOrderNo(`UWO-601.001-${year}-001`)).toBe(true);
    expect(isUnplannedWorkOrderNo(`001-UWO-601.001-${year}-001`)).toBe(true);
    expect(extractJobNoFromWorkOrderNo(`001-UWO-601.001-${year}-001`)).toBeNull();
  });
});