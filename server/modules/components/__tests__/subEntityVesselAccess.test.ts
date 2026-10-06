import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  findById: vi.fn(),
  findDocuments: vi.fn(),
  findDocument: vi.fn(),
  findClassRegulatory: vi.fn(),
  findClassRegulatoryItem: vi.fn(),
  createClassRegulatory: vi.fn(),
  updateClassRegulatory: vi.fn(),
  findAllRequisitions: vi.fn(),
  findRequisitionItem: vi.fn(),
  findRequisitions: vi.fn(),
  createRequisition: vi.fn(),
  updateRequisition: vi.fn(),
  findMaintenanceHistoryByVessel: vi.fn(),
  findMaintenanceHistory: vi.fn(),
  findMaintenanceHistoryItem: vi.fn(),
}));

vi.mock('../repositories/componentRepository', () => repo);
vi.mock('../../../objectStorage', () => ({ objectStorageClient: {}, ObjectNotFoundError: class extends Error {} }));
vi.mock('../../sync/fileSyncProcessor', () => ({ FileSyncProcessor: { queueFileForSync: vi.fn() } }));

import * as documents from '../services/documentService';
import * as entities from '../services/subEntityService';

const ship = (vesselId?: string) => ({ username: 'crew', role: 'Ship', vesselId });
const office = { username: 'office', role: 'Office' };
const admin = { username: 'admin', role: 'Sail Admin' };
const component = { cuuid: 'c1', componentCode: '401.010', vesselCode: 'V1' };
const forbidden = { name: 'ForbiddenError', statusCode: 403 };

beforeEach(() => {
  vi.resetAllMocks();
  repo.findById.mockResolvedValue(component);
  repo.findDocuments.mockResolvedValue([{ canShipView: true }, { canShipView: false }]);
  repo.findRequisitions.mockResolvedValue([]);
  repo.findAllRequisitions.mockResolvedValue([]);
  repo.findClassRegulatory.mockResolvedValue([]);
  repo.findMaintenanceHistory.mockResolvedValue([]);
  repo.findMaintenanceHistoryByVessel.mockResolvedValue([]);
  repo.findDocument.mockResolvedValue({ vesselCode: 'V1', canShipDownload: true });
  repo.findRequisitionItem.mockResolvedValue({ vesselCode: 'V1', componentId: 'c1' });
  repo.findMaintenanceHistoryItem.mockResolvedValue({ vesselCode: 'V1' });
  repo.findClassRegulatoryItem.mockResolvedValue({ vesselCode: 'V1', componentId: 'c1', componentCode: '401.010' });
});

describe('Component sub-entity Ship vessel access', () => {
  it('denies an unassigned Ship identity before reading documents, classification, requisitions or history', async () => {
    await expect(documents.listDocuments('c1', ship())).rejects.toMatchObject(forbidden);
    await expect(documents.downloadDocument(1, ship())).rejects.toMatchObject(forbidden);
    await expect(entities.listClassRegulatory('c1', ship())).rejects.toMatchObject(forbidden);
    await expect(entities.listRequisitions('c1', ship())).rejects.toMatchObject(forbidden);
    await expect(entities.listAllRequisitions(ship())).rejects.toMatchObject(forbidden);
    await expect(entities.getRequisition(1, ship())).rejects.toMatchObject(forbidden);
    await expect(entities.listVesselMaintenanceHistory('V1', ship())).rejects.toMatchObject(forbidden);
    await expect(entities.listMaintenanceHistory('c1', ship())).rejects.toMatchObject(forbidden);
    await expect(entities.getMaintenanceHistoryItem(1, ship())).rejects.toMatchObject(forbidden);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.findDocument).not.toHaveBeenCalled();
    expect(repo.findAllRequisitions).not.toHaveBeenCalled();
  });

  it('denies cross-vessel reads and allows matching-vessel reads', async () => {
    await expect(documents.listDocuments('c1', ship('V2'))).rejects.toMatchObject(forbidden);
    await expect(documents.downloadDocument(1, ship('V2'))).rejects.toMatchObject(forbidden);
    await expect(entities.listClassRegulatory('c1', ship('V2'))).rejects.toMatchObject(forbidden);
    await expect(entities.listRequisitions('c1', ship('V2'))).rejects.toMatchObject(forbidden);
    await expect(entities.getRequisition(1, ship('V2'))).rejects.toMatchObject(forbidden);
    await expect(entities.listVesselMaintenanceHistory('V1', ship('V2'))).rejects.toMatchObject(forbidden);
    await expect(entities.listMaintenanceHistory('c1', ship('V2'))).rejects.toMatchObject(forbidden);
    await expect(entities.getMaintenanceHistoryItem(1, ship('V2'))).rejects.toMatchObject(forbidden);

    expect(await documents.listDocuments('c1', ship('V1'))).toHaveLength(1);
    expect(await entities.listClassRegulatory('c1', ship('V1'))).toEqual([]);
    expect(await entities.listRequisitions('c1', ship('V1'))).toEqual([]);
    await entities.listAllRequisitions(ship('V1'), 'V2');
    expect(repo.findAllRequisitions).toHaveBeenCalledWith('V1');
    await entities.listVesselMaintenanceHistory('V1', ship('V1'));
    expect(repo.findMaintenanceHistoryByVessel).toHaveBeenCalledWith('V1');
  });

  it('denies missing and cross-vessel Ship mutations before writing', async () => {
    const classBody = { componentId: 'c1', componentCode: '401.010', vesselCode: 'V1' };
    await expect(documents.createDocument(classBody, {} as Express.Multer.File, ship())).rejects.toMatchObject(forbidden);
    await expect(documents.createDocument(classBody, {} as Express.Multer.File, ship('V2'))).rejects.toMatchObject(forbidden);
    await expect(entities.createClassRegulatory(classBody, ship())).rejects.toMatchObject(forbidden);
    await expect(entities.createClassRegulatory(classBody, ship('V2'))).rejects.toMatchObject(forbidden);
    await expect(entities.createClassRegulatory({ ...classBody, vesselCode: 'V2' }, ship('V1'))).rejects.toMatchObject(forbidden);
    await expect(entities.updateClassRegulatory(1, {}, ship())).rejects.toMatchObject(forbidden);
    await expect(entities.updateClassRegulatory(1, {}, ship('V2'))).rejects.toMatchObject(forbidden);
    await expect(entities.updateClassRegulatory(1, { componentId: 'c2' }, ship('V1'))).rejects.toMatchObject(forbidden);
    await expect(entities.createRequisition({ componentId: 'c1' }, ship())).rejects.toMatchObject(forbidden);
    await expect(entities.createRequisition({ componentId: 'c1' }, ship('V2'))).rejects.toMatchObject(forbidden);
    await expect(entities.createRequisition({ componentId: 'c1', componentCode: '401.010', vesselCode: 'V2' }, ship('V1'))).rejects.toMatchObject(forbidden);
    await expect(entities.createRequisition({ componentId: 'c1', componentCode: 'other' }, ship('V1'))).rejects.toMatchObject(forbidden);
    await expect(entities.updateRequisition(1, {}, ship())).rejects.toMatchObject(forbidden);
    await expect(entities.updateRequisition(1, {}, ship('V2'))).rejects.toMatchObject(forbidden);
    expect(repo.createClassRegulatory).not.toHaveBeenCalled();
    expect(repo.updateClassRegulatory).not.toHaveBeenCalled();
    expect(repo.createRequisition).not.toHaveBeenCalled();
    expect(repo.updateRequisition).not.toHaveBeenCalled();
  });

  it('allows matching Ship creates and preserves Office/admin access', async () => {
    const classBody = {
      componentId: 'c1', componentCode: '401.010', vesselCode: 'V1',
      classificationSociety: 'DNV', surveyType: 'Annual Survey',
    };
    repo.createClassRegulatory.mockImplementation(async (data) => data);
    const created = await entities.createClassRegulatory(classBody, ship('V1'));
    expect(created).toMatchObject({ vesselCode: 'V1', createdBy: 'crew' });
    repo.updateClassRegulatory.mockImplementation(async (_id, data) => data);
    expect(await entities.updateClassRegulatory(1, { remarks: 'Reviewed' }, ship('V1')))
      .toMatchObject({ remarks: 'Reviewed', updatedBy: 'crew' });

    repo.createRequisition.mockImplementation(async (data) => data);
    const requisition = await entities.createRequisition({
      componentId: 'c1', componentCode: '401.010', requisitionNo: 'REQ-001',
      raisedOn: '2026-09-28', itemOrService: 'Filter', quantity: 1, uom: 'PC',
    }, ship('V1'));
    expect(requisition).toMatchObject({ vesselCode: 'V1', requestedBy: 'crew' });

    expect(await documents.listDocuments('c1', office)).toHaveLength(2);
    expect(await documents.listDocuments('c1', admin)).toHaveLength(2);
    await entities.listAllRequisitions(office);
    expect(repo.findAllRequisitions).toHaveBeenCalledWith(undefined);
    await entities.listAllRequisitions(admin, 'V2');
    expect(repo.findAllRequisitions).toHaveBeenCalledWith('V2');
  });
});