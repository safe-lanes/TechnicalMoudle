import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { isVisibleMaintenanceHistory } from '../../../../shared/workOrders/maintenanceHistoryVisibility';
const seam = vi.hoisted(() => ({ wo: {} as any, job: {} as any, component: {} as any, rows: [] as any[] }));
const woRepo = vi.hoisted(() => ({
  findById: vi.fn(), findComponent: vi.fn(), findJob: vi.fn(), findWorkOrdersByJobId: vi.fn(),
  findRunningHoursAudits: vi.fn(), findMaintenanceHistoryByWorkOrderId: vi.fn(), findMaintenanceHistoryByJobId: vi.fn(),
}));
const jobRepo = vi.hoisted(() => ({
  findById: vi.fn(), findComponent: vi.fn(), findWorkOrdersByJobId: vi.fn(),
  findMaintenanceHistoryByJobId: vi.fn(), findSpareInventoryByPartCodes: vi.fn(),
}));
const compRepo = vi.hoisted(() => ({
  findById: vi.fn(), findMaintenanceHistory: vi.fn(), findMaintenanceHistoryItem: vi.fn(),
  findAllMaintenanceHistory: vi.fn(), findMaintenanceHistoryByVessel: vi.fn(),
}));
vi.mock('../repositories/workOrderRepository', () => woRepo);
vi.mock('../../jobs/repositories/jobRepository', () => jobRepo);
vi.mock('../../components/repositories/componentRepository', () => compRepo);
vi.mock('../../components/services/shipVesselAccess', () => ({ assertShipVesselAccess: vi.fn() }));
import { getWorkOrderContext } from '../services/workOrderContextService';
import { getJobContext } from '../../jobs/services/jobContextService';
import { listAllMaintenanceHistory, listMaintenanceHistory, listVesselMaintenanceHistory,
  getMaintenanceHistoryItem } from '../../components/services/subEntityService';

beforeEach(() => {
  vi.clearAllMocks();
  seam.wo = { wouuid: 'source', component: 'component', componentCode: '601', vesselId: 'vessel',
    jobId: 'job', status: 'Completed', dateCompleted: '2026-07-20' };
  seam.job = { juuid: 'job', componentId: 'component', vesselId: 'vessel', requiredSpareParts: [] };
  seam.component = { cuuid: 'component', componentCode: '601', name: 'Pump', vesselCode: 'VES-9' };
  seam.rows = [
    { workOrderId: 'other-source', workOrderNo: 'ACTUAL-WO', status: 'Approved', dateCompleted: '2026-07-19' },
    { workOrderId: 'source', workOrderNo: 'SECRET-SKIP-CODE', status: 'SKIPPED', isSkipped: true },
    { workOrderId: 'source', workOrderNo: 'LEGACY-SKIP-CODE', status: 'SKIPPED', isSkipped: null },
  ];
  woRepo.findById.mockResolvedValue(seam.wo);
  woRepo.findComponent.mockResolvedValue(seam.component);
  woRepo.findJob.mockResolvedValue(seam.job);
  woRepo.findWorkOrdersByJobId.mockResolvedValue([]);
  woRepo.findRunningHoursAudits.mockResolvedValue([]);
  woRepo.findMaintenanceHistoryByWorkOrderId.mockResolvedValue(seam.rows[1]);
  woRepo.findMaintenanceHistoryByJobId.mockResolvedValue(seam.rows);
  jobRepo.findById.mockResolvedValue(seam.job);
  jobRepo.findComponent.mockResolvedValue(seam.component);
  jobRepo.findWorkOrdersByJobId.mockResolvedValue([]);
  jobRepo.findMaintenanceHistoryByJobId.mockResolvedValue(seam.rows);
  jobRepo.findSpareInventoryByPartCodes.mockResolvedValue(new Map());
  compRepo.findById.mockResolvedValue(seam.component);
  compRepo.findMaintenanceHistory.mockResolvedValue(seam.rows);
  compRepo.findAllMaintenanceHistory.mockResolvedValue(seam.rows);
  compRepo.findMaintenanceHistoryByVessel.mockResolvedValue(seam.rows);
});

describe('backend-only maintenance history presentation', () => {
  it('WO and Job contexts never expose skip codes, including stale legacy rows and own-history lookup', async () => {
    const wo = await getWorkOrderContext('source');
    const job = await getJobContext('job');
    for (const context of [wo, job]) {
      const text = JSON.stringify(context);
      expect(text).not.toContain('SECRET-SKIP-CODE');
      expect(text).not.toContain('LEGACY-SKIP-CODE');
      expect(text).toContain('ACTUAL-WO');
      expect(context.templateData.workHistory).toHaveLength(1);
    }
    expect(seam.rows).toHaveLength(3); // Read filtering never deletes backend rows.
  });

  it('component list, vessel list and direct detail hide skips without hiding actual records', async () => {
    const user = { username: 'office', role: 'Office' };
    expect(await listAllMaintenanceHistory()).toHaveLength(1);
    expect(await listVesselMaintenanceHistory('vessel', user)).toHaveLength(1);
    expect(await listMaintenanceHistory('component', user)).toHaveLength(1);
    compRepo.findMaintenanceHistoryItem.mockResolvedValue(seam.rows[1]);
    await expect(getMaintenanceHistoryItem(1, user)).rejects.toThrow('not found');
    compRepo.findMaintenanceHistoryItem.mockResolvedValue(seam.rows[0]);
    expect(await getMaintenanceHistoryItem(1, user)).toBe(seam.rows[0]);
  });

  it('cached client rows are excluded before visible counts, pagination and export input', () => {
    const rows = [seam.rows[0], ...seam.rows.slice(1), { status: 'Approved', is_skipped: 'true' }];
    const visible = rows.filter(isVisibleMaintenanceHistory);
    expect(visible).toHaveLength(1);
    expect(visible.slice(0, 10)).toEqual([seam.rows[0]]);
    expect(JSON.stringify(visible)).not.toContain('SKIP-CODE');
    for (const name of ['JobsFormPage', 'WorkOrderFormPage']) {
      const source = fs.readFileSync(`client/src/pages/pms/${name}.tsx`, 'utf8');
      expect(source).toContain('const raw = (templateData.workHistory || []).filter(isVisibleMaintenanceHistory)');
      expect(source).toContain('const rawHistory = (templateData.workHistory || []).filter(isVisibleMaintenanceHistory)');
    }
    for (const path of ['client/src/pages/pms/Components.tsx', 'client/src/components/AddEditComponentForm.tsx',
      'client/src/components/ComponentRegisterAddEdit.tsx']) {
      expect(fs.readFileSync(path, 'utf8')).toContain('select: rows => rows.filter(isVisibleMaintenanceHistory)');
    }
  });

  it('startup existence checks stay internal so UI filtering cannot activate historical repairs', () => {
    const source = fs.readFileSync('server/routes.ts', 'utf8');
    const startup = source.slice(source.indexOf('// STARTUP BACKFILL: Create missing maintenance history'));
    expect(startup).toContain('(await findMaintenanceHistoryForSource(woAny.wouuid)).length > 0');
    expect(startup).not.toContain('storage.getMaintenanceHistoryByWorkOrderId(woAny.wouuid)');
  });
});
