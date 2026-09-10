import fs from 'node:fs';
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
import { fieldNameToColumn } from '../../sync/oneWayApplier';
import { shouldRetryUnknownSyncColumn } from '../../sync/unknownColumnRetryPolicy';

const mockedRepo = vi.mocked(certRepo);
const mockedLogFieldChanges = vi.mocked(logFieldChanges);

describe('Certificate number', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses an idempotent file-based migration', () => {
    const sql = fs.readFileSync('migrations/175_vessel_certificate_number.sql', 'utf8');
    expect(sql).toMatch(/ALTER TABLE vessel_certificate_data/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS certificate_number TEXT/i);
  });

  it('maps the application field name to the sync database column', () => {
    expect(fieldNameToColumn('certificateNumber')).toBe('certificate_number');
  });

  it('keeps certificate number changes retryable on a pre-migration receiver', () => {
    expect(
      shouldRetryUnknownSyncColumn('vessel_certificate_data', 'certificate_number'),
    ).toBe(true);
    expect(
      shouldRetryUnknownSyncColumn('vessel_certificate_data', 'issue_date'),
    ).toBe(false);
    expect(
      shouldRetryUnknownSyncColumn('other_table', 'certificate_number'),
    ).toBe(false);
  });

  it('returns and sorts vessel-specific certificate numbers', async () => {
    mockedRepo.getApplicableCertificates.mockResolvedValue([
      { vesselId: 'vessel-1', vesselName: 'Vessel 1', masterId: 'master-1' },
      { vesselId: 'vessel-1', vesselName: 'Vessel 1', masterId: 'master-2' },
    ] as any);
    mockedRepo.getMasterCertificatesByIds.mockResolvedValue([
      { masterId: 'master-1', companyId: 'CA1-001', certificateName: 'Certificate 1', companySequence: 1 },
      { masterId: 'master-2', companyId: 'CA1-002', certificateName: 'Certificate 2', companySequence: 2 },
    ] as any);
    mockedRepo.getAllVesselCertificateData.mockResolvedValue([
      { vesselId: 'vessel-1', masterId: 'master-1', certificateNumber: 'CERT-200' },
      { vesselId: 'vessel-1', masterId: 'master-2', certificateNumber: 'CERT-100' },
    ] as any);

    const result = await getCertificates({
      sortBy: 'certificateNumber',
      sortOrder: 'asc',
      page: 1,
      limit: 100,
    });

    expect(result.certificates.map((cert) => cert.certificateNumber)).toEqual(['CERT-100', 'CERT-200']);
  });

  it('persists and logs certificate number updates for sync', async () => {
    const existingRow = {
      id: 1,
      vcduuid: 'certificate-data-1',
      vesselId: 'vessel-1',
      vesselName: 'Vessel 1',
      masterId: 'master-1',
      certificateNumber: null,
    };
    const updatedRow = { ...existingRow, certificateNumber: 'ABC / 123' };

    mockedRepo.getCertificateApplicability.mockResolvedValue([
      { vesselId: 'vessel-1', vesselName: 'Vessel 1', masterId: 'master-1' },
    ] as any);
    mockedRepo.getMasterCertificateById.mockResolvedValue([
      { masterId: 'master-1', companyId: 'CA1-001', certificateName: 'Certificate 1' },
    ] as any);
    mockedRepo.getVesselCertificateDataByKey.mockResolvedValue([existingRow] as any);
    mockedRepo.updateCertificateData.mockResolvedValue([updatedRow] as any);

    const result = await updateCertificate('vessel-1::master-1', {
      certificateNumber: 'ABC / 123',
    });

    expect(mockedRepo.updateCertificateData).toHaveBeenCalledWith('vessel-1', 'master-1', {
      certificateNumber: 'ABC / 123',
    });
    expect(result.certificateNumber).toBe('ABC / 123');
    expect(mockedLogFieldChanges).toHaveBeenCalledWith(
      'vessel_certificate_data',
      'certificate-data-1',
      'vessel-1',
      existingRow,
      updatedRow,
      'system',
    );
  });

  it('supports clearing a certificate number', async () => {
    const existingRow = {
      id: 1,
      vcduuid: 'certificate-data-1',
      vesselId: 'vessel-1',
      vesselName: 'Vessel 1',
      masterId: 'master-1',
      certificateNumber: 'CERT-OLD',
    };
    const updatedRow = { ...existingRow, certificateNumber: '' };

    mockedRepo.getCertificateApplicability.mockResolvedValue([
      { vesselId: 'vessel-1', vesselName: 'Vessel 1', masterId: 'master-1' },
    ] as any);
    mockedRepo.getMasterCertificateById.mockResolvedValue([
      { masterId: 'master-1', companyId: 'CA1-001', certificateName: 'Certificate 1' },
    ] as any);
    mockedRepo.getVesselCertificateDataByKey.mockResolvedValue([existingRow] as any);
    mockedRepo.updateCertificateData.mockResolvedValue([updatedRow] as any);

    const result = await updateCertificate('vessel-1::master-1', { certificateNumber: '' });

    expect(result.certificateNumber).toBe('');
    expect(mockedLogFieldChanges).toHaveBeenCalledOnce();
  });
});