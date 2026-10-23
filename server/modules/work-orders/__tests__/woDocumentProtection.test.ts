import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findDoc: vi.fn(), findWo: vi.fn(), remove: vi.fn() }));
vi.mock('../repositories/documentRepository', () => ({ findById: mocks.findDoc }));
vi.mock('../repositories/workOrderRepository', () => ({ findById: mocks.findWo }));
vi.mock('../services/woDocumentService', () => ({ deleteDocument: mocks.remove }));
vi.mock('../../../utils/tenantConnectionManager', () => ({ captureTenantFromReq: vi.fn() }));
import { deleteDocument } from '../controllers/woDocumentController';

describe('document deletion uses persisted parent UUID', () => {
  beforeEach(() => vi.resetAllMocks());
  const response = () => { const res: any = { json: vi.fn(), status: vi.fn() }; res.status.mockReturnValue(res); return res; };
  it('blocks completed attachment deletion before storage mutation', async () => {
    mocks.findDoc.mockResolvedValue({ id: 'doc', workOrderId: 'canonical-wo' });
    mocks.findWo.mockResolvedValue({ wouuid: 'canonical-wo', status: 'Completed' });
    const res = response();
    await deleteDocument({ params: { documentId: 'doc' } } as any, res);
    expect(mocks.findWo).toHaveBeenCalledWith('canonical-wo');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it.each(['Due', 'Pending Approval'])('preserves editable deletion for %s', async status => {
    mocks.findDoc.mockResolvedValue({ workOrderId: 'canonical-wo' });
    mocks.findWo.mockResolvedValue({ status });
    await deleteDocument({ params: { documentId: 'doc' } } as any, response());
    expect(mocks.remove).toHaveBeenCalledWith('doc');
  });
  it('preserves the missing-document service error', async () => {
    mocks.findDoc.mockResolvedValue(undefined);
    mocks.remove.mockRejectedValue(new Error('Document not found'));
    await expect(deleteDocument({ params: { documentId: 'missing' } } as any, response())).rejects.toThrow('Document not found');
    expect(mocks.findWo).not.toHaveBeenCalled();
  });
});
