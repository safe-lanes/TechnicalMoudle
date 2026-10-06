import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../postgresClient', () => ({ getPostgresClient: vi.fn() }));
vi.mock('../repositories/certAdminRepository', () => ({
  getAllVessels: vi.fn(),
  getMasterCertificateByMasterId: vi.fn(),
  insertMasterCertificate: vi.fn(),
  updateMasterCertificate: vi.fn(),
  getApplicabilityByMasterIds: vi.fn(),
  insertApplicabilityBulk: vi.fn(),
  getCompanyApplicableMasterIds: vi.fn(),
  getAllApplicabilityRecords: vi.fn(),
  softDeleteApplicabilityByMasterIds: vi.fn(),
  getApplicabilityByVesselId: vi.fn(),
  getCompanyCertificates: vi.fn(),
  insertApplicability: vi.fn(),
  bulkUpdateApplicability: vi.fn(),
}));
vi.mock('../services/vesselEnsureService', () => ({ ensureVesselExists: vi.fn(async () => {}) }));
vi.mock('../../sync/fieldLogger', () => ({ logFieldChanges: vi.fn(async () => {}) }));

import { getPostgresClient } from '../../../postgresClient';
import * as repo from '../repositories/certAdminRepository';
import {
  bulkUpdateApplicability,
  initializeApplicability,
  saveMasterCertificates,
} from '../services/certAdminService';

type Master = { masterId: string; applicableToCompany: boolean; isActive?: boolean; isDeleted?: boolean };
type Applicability = { vesselId: string; vesselName: string; masterId: string; isApplicable: boolean; isDeleted?: boolean };
type State = {
  vessels: Array<{ vesselId: string; vesselName: string }>;
  masters: Master[];
  applicability: Applicability[];
};
type Tx = { stage: State; insert: () => { values: () => { onConflictDoNothing: () => { returning: () => Promise<never[]> } } } };

const vessels = [
  { vesselId: 'v1', vesselName: 'Vessel 1' },
  { vesselId: 'v2', vesselName: 'Vessel 2' },
];
let committed: State;
const current = (tx?: Tx) => tx?.stage ?? committed;
const active = (rows: Applicability[]) => rows.filter(row => !row.isDeleted);
const insert = (rows: Applicability | Applicability[], tx?: Tx) => {
  const stage = current(tx);
  const inserted: Applicability[] = [];
  for (const row of Array.isArray(rows) ? rows : [rows]) {
    if (active(stage.applicability).some(r => r.vesselId === row.vesselId && r.masterId === row.masterId)) continue;
    stage.applicability.push(row);
    inserted.push(row);
  }
  return inserted;
};

describe('certificate administration applicability', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    committed = { vessels: structuredClone(vessels), masters: [], applicability: [] };
    vi.mocked(getPostgresClient).mockReturnValue({
      db: {
        transaction: async (callback: (tx: Tx) => Promise<unknown>) => {
          const stage = structuredClone(committed);
          const tx: Tx = {
            stage,
            insert: () => ({
              values: () => ({
                onConflictDoNothing: () => ({ returning: async () => [] }),
              }),
            }),
          };
          const result = await callback(tx);
          committed = stage;
          return result;
        },
      },
    } as any);

    vi.mocked(repo.getAllVessels).mockImplementation(async (tx) => current(tx as Tx).vessels);
    vi.mocked(repo.getMasterCertificateByMasterId).mockImplementation(async (id, tx) =>
      current(tx as Tx).masters.filter(m => m.masterId === id) as any);
    vi.mocked(repo.insertMasterCertificate).mockImplementation(async (master, tx) => {
      current(tx as Tx).masters.push(master as Master);
      return [] as any;
    });
    vi.mocked(repo.updateMasterCertificate).mockImplementation(async (id, data, tx) => {
      Object.assign(current(tx as Tx).masters.find(m => m.masterId === id)!, data);
      return [] as any;
    });
    vi.mocked(repo.getApplicabilityByMasterIds).mockImplementation(async (ids, tx) =>
      active(current(tx as Tx).applicability).filter(r => ids.includes(r.masterId)) as any);
    vi.mocked(repo.insertApplicabilityBulk).mockImplementation(async (rows, tx) =>
      insert(rows, tx as Tx) as any);
    vi.mocked(repo.getCompanyApplicableMasterIds).mockImplementation(async (tx) =>
      current(tx as Tx).masters
        .filter(m => m.isActive !== false && !m.isDeleted && (m.applicableToCompany || m.masterId.startsWith('CMP-') || m.masterId.startsWith('VES-')))
        .map(m => ({ masterId: m.masterId })) as any);
    vi.mocked(repo.getAllApplicabilityRecords).mockImplementation(async (tx) =>
      active(current(tx as Tx).applicability) as any);
    vi.mocked(repo.softDeleteApplicabilityByMasterIds).mockImplementation(async (ids, tx) => {
      for (const row of current(tx as Tx).applicability) {
        if (ids.includes(row.masterId)) row.isDeleted = true;
      }
      return [] as any;
    });
    vi.mocked(repo.getApplicabilityByVesselId).mockImplementation(async (id) =>
      active(committed.applicability).filter(r => r.vesselId === id) as any);
    vi.mocked(repo.getCompanyCertificates).mockImplementation(async () =>
      committed.masters.filter(m => m.applicableToCompany || m.masterId.startsWith('CMP-')) as any);
    vi.mocked(repo.insertApplicability).mockImplementation(async (rows, tx) =>
      insert(rows, tx as Tx) as any);
    vi.mocked(repo.bulkUpdateApplicability).mockImplementation(async (ids, masterId, isApplicable, tx) => {
      const updated = active(current(tx as Tx).applicability)
        .filter(r => ids.includes(r.vesselId) && r.masterId === masterId);
      for (const row of updated) row.isApplicable = isApplicable;
      return updated as any;
    });
  });

  it('fills missing company rows without resetting an unchecked row or duplicating on repeat save', async () => {
    committed.masters = [{ masterId: 'CMP-1', applicableToCompany: true }];
    committed.applicability = [
      { vesselId: 'v1', vesselName: 'Vessel 1', masterId: 'CMP-1', isApplicable: false },
    ];
    const body = { certificates: [{ masterId: 'CMP-1', applicableToCompany: true }] };
    await saveMasterCertificates(body);
    await saveMasterCertificates(body);
    expect(committed.applicability).toEqual([
      { vesselId: 'v1', vesselName: 'Vessel 1', masterId: 'CMP-1', isApplicable: false },
      { vesselId: 'v2', vesselName: 'Vessel 2', masterId: 'CMP-1', isApplicable: true },
    ]);
  });

  it('targets new VES certificates only to selected vessels and leaves existing VES rows alone', async () => {
    await saveMasterCertificates({
      certificates: [{ masterId: 'VES-1', applicableToCompany: false }],
      targetVessels: [{ id: 'v2', name: 'Vessel 2' }],
    });
    await saveMasterCertificates({ certificates: [{ masterId: 'VES-1', applicableToCompany: false }] });
    expect(active(committed.applicability)).toEqual([
      { vesselId: 'v2', vesselName: 'Vessel 2', masterId: 'VES-1', isApplicable: true },
    ]);
  });

  it('rolls back a new VES certificate when no target vessel is selected', async () => {
    await expect(saveMasterCertificates({
      certificates: [{ masterId: 'VES-1', applicableToCompany: false }],
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(committed.masters).toEqual([]);
    expect(committed.applicability).toEqual([]);
  });

  it('cleans up stale non-company rows but not VES or unchecked company rows', async () => {
    committed.masters = [
      { masterId: 'CMP-1', applicableToCompany: true },
      { masterId: 'VES-1', applicableToCompany: false },
      { masterId: 'OTHER-1', applicableToCompany: false },
    ];
    committed.applicability = [
      { vesselId: 'v1', vesselName: 'Vessel 1', masterId: 'CMP-1', isApplicable: false },
      { vesselId: 'v1', vesselName: 'Vessel 1', masterId: 'VES-1', isApplicable: true },
      { vesselId: 'v1', vesselName: 'Vessel 1', masterId: 'OTHER-1', isApplicable: true },
    ];
    await saveMasterCertificates({ certificates: [] });
    expect(committed.applicability.find(r => r.masterId === 'OTHER-1')?.isDeleted).toBe(true);
    expect(committed.applicability.find(r => r.masterId === 'VES-1')?.isDeleted).toBeUndefined();
    expect(committed.applicability.find(r => r.masterId === 'CMP-1' && r.vesselId === 'v1')?.isApplicable).toBe(false);
    expect(committed.applicability.find(r => r.masterId === 'CMP-1' && r.vesselId === 'v2')?.isApplicable).toBe(true);
  });

  it('returns empty results without inserts and only initializes missing company rows', async () => {
    expect((await initializeApplicability({ vesselId: 'v1', vesselName: 'Vessel 1' })).records).toEqual([]);
    committed.masters = [
      { masterId: 'CMP-1', applicableToCompany: true },
      { masterId: 'CMP-2', applicableToCompany: true },
    ];
    committed.applicability = [
      { vesselId: 'v1', vesselName: 'Vessel 1', masterId: 'CMP-1', isApplicable: false },
    ];
    await initializeApplicability({ vesselId: 'v1', vesselName: 'Vessel 1' });
    await initializeApplicability({ vesselId: 'v1', vesselName: 'Vessel 1' });
    expect(committed.applicability).toHaveLength(2);
    expect(committed.applicability.find(r => r.masterId === 'CMP-1')?.isApplicable).toBe(false);
    expect(committed.applicability.find(r => r.masterId === 'CMP-2')?.isApplicable).toBe(true);
  });

  it('bulk-updates existing rows and inserts missing vessels with the requested applicability', async () => {
    committed.applicability = [
      { vesselId: 'v1', vesselName: 'Vessel 1', masterId: 'CMP-1', isApplicable: true },
    ];
    await bulkUpdateApplicability({
      vessels: [{ id: 'v1', name: 'Vessel 1' }, { id: 'v2', name: 'Vessel 2' }],
      masterId: 'CMP-1',
      isApplicable: false,
    });
    expect(committed.applicability).toHaveLength(2);
    expect(committed.applicability.every(r => r.isApplicable === false)).toBe(true);
  });

  it('does not commit master changes if applicability insertion fails mid-transaction', async () => {
    vi.mocked(repo.insertApplicabilityBulk).mockRejectedValueOnce(new Error('insert failed'));
    await expect(saveMasterCertificates({
      certificates: [{ masterId: 'CMP-1', applicableToCompany: true }],
    })).rejects.toThrow('insert failed');
    expect(committed.masters).toEqual([]);
    expect(committed.applicability).toEqual([]);
  });

  it('reports unavailable database before writing any certificates', async () => {
    vi.mocked(getPostgresClient).mockReturnValueOnce(null as any);
    await expect(saveMasterCertificates({ certificates: [] })).rejects.toMatchObject({ statusCode: 503 });
    expect(committed.masters).toEqual([]);
  });
});