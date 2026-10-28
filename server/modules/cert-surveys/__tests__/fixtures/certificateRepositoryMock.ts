import { vi } from 'vitest';

/** Service-delegation fixtures only; actual SQL parity is checked in PostgreSQL. */
export function createCertificateRepositoryMock() {
  const repo = {
    getApplicableCertificates: vi.fn(),
    getMasterCertificatesByIds: vi.fn(),
    getAllVesselCertificateData: vi.fn(),
    getCertificateApplicability: vi.fn(),
    getMasterCertificateById: vi.fn(),
    getVesselCertificateDataByKey: vi.fn(),
    updateCertificateData: vi.fn(),
    insertCertificateData: vi.fn(),
  };
  return {
    ...repo,
    getCertificateListPage: vi.fn(async filters => {
      const { getLegacyCertificates } = await import('./legacyCertificateList');
      return getLegacyCertificates(filters, repo);
    }),
  };
}
