import { vi } from 'vitest';

/** Shared service-test adapter. SQL paging itself is covered separately. */
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
  const getVesselCertificateMetadata = vi.fn(async () => {
    const records = await repo.getAllVesselCertificateData();
    return records?.map(({ attachments, ...metadata }: any) => metadata);
  });
  const getCertificatePage = vi.fn(async (rows: any[], page: number, limit: number) => {
    const data = await repo.getAllVesselCertificateData.mock.results.at(-1)?.value;
    const offset = (page - 1) * limit;
    return rows.slice(offset, offset + limit).map(({ _certificateDataId, ...row }) => ({
      ...row,
      attachments: data?.find((item: any) => item.id === _certificateDataId)?.attachments || [],
    }));
  });
  return {
    ...repo,
    getVesselCertificateMetadata,
    getCertificatePage,
    withCertificateReadSnapshot: vi.fn(async (read: (reader: any) => unknown) =>
      read({ ...repo, getVesselCertificateMetadata, getCertificatePage })),
  };
}
