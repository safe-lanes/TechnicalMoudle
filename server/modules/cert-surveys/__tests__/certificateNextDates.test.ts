import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/certificateRepository', () => ({
  getApplicableCertificates: vi.fn(),
  getMasterCertificatesByIds: vi.fn(),
  getAllVesselCertificateData: vi.fn(),
  getCertificateApplicability: vi.fn(),
  getMasterCertificateById: vi.fn(),
  getVesselCertificateDataByKey: vi.fn(),
  updateCertificateData: vi.fn(),
  insertCertificateData: vi.fn(),
}));

vi.mock('../../sync', () => ({
  logFieldChanges: vi.fn(async () => {}),
}));

import * as certRepo from '../repositories/certificateRepository';
import { logFieldChanges } from '../../sync';
import { getCertificates, updateCertificate } from '../services/certificateService';

const mockedRepo = vi.mocked(certRepo);
const mockedLogFieldChanges = vi.mocked(logFieldChanges);

describe('Certificate next annual and interim dates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns and sorts vessel-specific next dates in the certificate list', async () => {
    mockedRepo.getApplicableCertificates.mockResolvedValue([
      { vesselId: 'vessel-1', vesselName: 'Vessel 1', masterId: 'master-1' },
      { vesselId: 'vessel-1', vesselName: 'Vessel 1', masterId: 'master-2' },
    ] as any);
    mockedRepo.getMasterCertificatesByIds.mockResolvedValue([
      { masterId: 'master-1', companyId: 'CA1-001', certificateName: 'Certificate 1', companySequence: 1 },
      { masterId: 'master-2', companyId: 'CA1-002', certificateName: 'Certificate 2', companySequence: 2 },
    ] as any);
    mockedRepo.getAllVesselCertificateData.mockResolvedValue([
      {
        vesselId: 'vessel-1',
        masterId: 'master-1',
        nextAnnual: '20 Jan 2027',
        nextInterm: '20 Jul 2027',
      },
      {
        vesselId: 'vessel-1',
        masterId: 'master-2',
        nextAnnual: '10 Jan 2027',
        nextInterm: '10 Jul 2027',
      },
    ] as any);

    const result = await getCertificates({
      sortBy: 'nextAnnual',
      sortOrder: 'asc',
      page: 1,
      limit: 100,
    });

    expect(result.certificates.map((cert) => cert.id)).toEqual(['CA1-002', 'CA1-001']);
    expect(result.certificates[0]).toMatchObject({
      vesselId: 'vessel-1',
      masterId: 'master-2',
      nextAnnual: '10 Jan 2027',
      nextInterm: '10 Jul 2027',
    });
  });

  it('persists, returns, and logs changes to both next date fields', async () => {
    const existingRow = {
      id: 1,
      vcduuid: 'certificate-data-1',
      vesselId: 'vessel-1',
      vesselName: 'Vessel 1',
      masterId: 'master-1',
      nextAnnual: null,
      nextInterm: null,
    };
    const updatedRow = {
      ...existingRow,
      nextAnnual: '15 Mar 2027',
      nextInterm: '15 Sep 2027',
    };

    mockedRepo.getCertificateApplicability.mockResolvedValue([
      { vesselId: 'vessel-1', vesselName: 'Vessel 1', masterId: 'master-1' },
    ] as any);
    mockedRepo.getMasterCertificateById.mockResolvedValue([
      { masterId: 'master-1', companyId: 'CA1-001', certificateName: 'Certificate 1' },
    ] as any);
    mockedRepo.getVesselCertificateDataByKey.mockResolvedValue([existingRow] as any);
    mockedRepo.updateCertificateData.mockResolvedValue([updatedRow] as any);

    const result = await updateCertificate('vessel-1::master-1', {
      nextAnnual: '15 Mar 2027',
      nextInterm: '15 Sep 2027',
    });

    expect(mockedRepo.updateCertificateData).toHaveBeenCalledWith('vessel-1', 'master-1', {
      nextAnnual: '15 Mar 2027',
      nextInterm: '15 Sep 2027',
    });
    expect(result).toMatchObject({
      vesselId: 'vessel-1',
      masterId: 'master-1',
      nextAnnual: '15 Mar 2027',
      nextInterm: '15 Sep 2027',
    });
    expect(mockedLogFieldChanges).toHaveBeenCalledWith(
      'vessel_certificate_data',
      'certificate-data-1',
      'vessel-1',
      existingRow,
      updatedRow,
      'system',
    );
  });

  it('supports clearing both next date fields', async () => {
    const existingRow = {
      id: 1,
      vcduuid: 'certificate-data-1',
      vesselId: 'vessel-1',
      vesselName: 'Vessel 1',
      masterId: 'master-1',
      nextAnnual: '15 Mar 2027',
      nextInterm: '15 Sep 2027',
    };
    const updatedRow = {
      ...existingRow,
      nextAnnual: '',
      nextInterm: '',
    };

    mockedRepo.getCertificateApplicability.mockResolvedValue([
      { vesselId: 'vessel-1', vesselName: 'Vessel 1', masterId: 'master-1' },
    ] as any);
    mockedRepo.getMasterCertificateById.mockResolvedValue([
      { masterId: 'master-1', companyId: 'CA1-001', certificateName: 'Certificate 1' },
    ] as any);
    mockedRepo.getVesselCertificateDataByKey.mockResolvedValue([existingRow] as any);
    mockedRepo.updateCertificateData.mockResolvedValue([updatedRow] as any);

    const result = await updateCertificate('vessel-1::master-1', {
      nextAnnual: '',
      nextInterm: '',
    });

    expect(mockedRepo.updateCertificateData).toHaveBeenCalledWith('vessel-1', 'master-1', {
      nextAnnual: '',
      nextInterm: '',
    });
    expect(result.nextAnnual).toBe('');
    expect(result.nextInterm).toBe('');
  });
});