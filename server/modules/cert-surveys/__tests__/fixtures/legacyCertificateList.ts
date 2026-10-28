// Frozen pre-pagination read oracle. Keep independent of the optimized service.
import * as certRepo from "../../repositories/certificateRepository";

interface CertificateFilters {
  vesselId?: string;
  vesselIds?: string[];
  vesselName?: string;
  vesselNames?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

// ── GET /certificates ──

export async function getLegacyCertificates(filters: CertificateFilters) {
  const page = filters.page || 1;
  const limit = filters.limit || 100;
  const offset = (page - 1) * limit;
  const sortBy = filters.sortBy;
  const sortOrder = (filters.sortOrder)?.toLowerCase() === 'desc' ? 'desc' : 'asc';

  const applicabilityRecords = await certRepo.getApplicableCertificates();
  if (!applicabilityRecords) {
    throw Object.assign(new Error("Database not available"), { statusCode: 500 });
  }

  if (applicabilityRecords.length === 0) {
    return { certificates: [], total: 0, page, limit };
  }

  let filteredApplicability = applicabilityRecords;
  if (filters.vesselId && filters.vesselId !== 'all') {
    filteredApplicability = applicabilityRecords.filter(r => r.vesselId === filters.vesselId);
  } else if (filters.vesselId === 'all' && filters.vesselIds?.length) {
    filteredApplicability = applicabilityRecords.filter(r => filters.vesselIds!.includes(r.vesselId));
  } else if (filters.vesselName) {
    const normalizedFilter = filters.vesselName.toLowerCase().trim();
    filteredApplicability = applicabilityRecords.filter(r =>
      r.vesselName.toLowerCase().trim() === normalizedFilter
    );
  } else if (filters.vesselNames) {
    const vesselNamesList = filters.vesselNames.split(',').map(n => n.toLowerCase().trim());
    filteredApplicability = applicabilityRecords.filter(r =>
      vesselNamesList.includes(r.vesselName.toLowerCase().trim())
    );
  }

  if (filteredApplicability.length === 0) {
    return { certificates: [], total: 0, page, limit };
  }

  const masterIds = Array.from(new Set(filteredApplicability.map(r => r.masterId)));
  const masterRecords = await certRepo.getMasterCertificatesByIds(masterIds);
  if (!masterRecords) {
    throw Object.assign(new Error("Database not available"), { statusCode: 500 });
  }

  const masterMap = new Map(masterRecords.map(m => [m.masterId, m]));

  const vesselCertDataRecords = await certRepo.getAllVesselCertificateData();
  if (!vesselCertDataRecords) {
    throw Object.assign(new Error("Database not available"), { statusCode: 500 });
  }

  const certDataMap = new Map<string, typeof vesselCertDataRecords[0]>();
  for (const data of vesselCertDataRecords) {
    const key = `${data.vesselId}-${data.masterId}`;
    certDataMap.set(key, data);
  }

  const certificates: any[] = [];

  const vesselGroups = new Map<string, typeof filteredApplicability>();
  for (const app of filteredApplicability) {
    if (!vesselGroups.has(app.vesselId)) {
      vesselGroups.set(app.vesselId, []);
    }
    vesselGroups.get(app.vesselId)!.push(app);
  }

  for (const [vesselId, apps] of Array.from(vesselGroups)) {
    const sortedApps = apps.sort((a: any, b: any) => {
      const masterA = masterMap.get(a.masterId);
      const masterB = masterMap.get(b.masterId);
      const seqA = masterA?.companySequence ?? masterA?.sequence ?? 9999;
      const seqB = masterB?.companySequence ?? masterB?.sequence ?? 9999;
      return seqA - seqB;
    });

    for (const app of sortedApps) {
      const master = masterMap.get(app.masterId);
      if (!master) continue;

      const dataKey = `${app.vesselId}-${app.masterId}`;
      const certData = certDataMap.get(dataKey);

      const effectiveSequence = master.companySequence ?? master.sequence ?? 9999;

      certificates.push({
        id: master.companyId || master.masterId,
        certificateName: master.certificateLabel || master.certificateName,
        type: master.companyGroup || '',
        vessel: app.vesselName,
        vesselId: app.vesselId,
        masterId: app.masterId,
        companySequence: effectiveSequence,
        certificateNumber: certData?.certificateNumber || '',
        issueDate: certData?.issueDate || '',
        expiryDate: certData?.expiryDate || '',
        lastAnnual: certData?.lastAnnual || '',
        nextAnnual: certData?.nextAnnual || '',
        lastInterm: certData?.lastInterm || '',
        nextInterm: certData?.nextInterm || '',
        endorsementDate: certData?.endorsementDate || '',
        lastEditUpload: certData?.lastEditUpload || '',
        attachments: certData?.attachments || [],
      });
    }
  }

  if (sortBy) {
    certificates.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortBy) {
        case 'id':
        case 'companyId':
          valA = a.id || '';
          valB = b.id || '';
          break;
        case 'certificateName':
        case 'name':
          valA = a.certificateName || '';
          valB = b.certificateName || '';
          break;
        case 'vessel':
          valA = a.vessel || '';
          valB = b.vessel || '';
          break;
        case 'certificateNumber':
          valA = a.certificateNumber || '';
          valB = b.certificateNumber || '';
          break;
        case 'type':
        case 'companyGroup':
          valA = a.type || '';
          valB = b.type || '';
          break;
        case 'issueDate':
          valA = a.issueDate || '';
          valB = b.issueDate || '';
          break;
        case 'expiryDate':
          valA = a.expiryDate || '';
          valB = b.expiryDate || '';
          break;
        case 'lastAnnual':
          valA = a.lastAnnual || '';
          valB = b.lastAnnual || '';
          break;
        case 'nextAnnual':
          valA = a.nextAnnual || '';
          valB = b.nextAnnual || '';
          break;
        case 'lastInterm':
          valA = a.lastInterm || '';
          valB = b.lastInterm || '';
          break;
        case 'nextInterm':
          valA = a.nextInterm || '';
          valB = b.nextInterm || '';
          break;
        case 'endorsementDate':
          valA = a.endorsementDate || '';
          valB = b.endorsementDate || '';
          break;
        case 'companySequence':
          valA = a.companySequence ?? 9999;
          valB = b.companySequence ?? 9999;
          break;
        default:
          valA = a.companySequence ?? 9999;
          valB = b.companySequence ?? 9999;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        const comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        return sortOrder === 'desc' ? -comparison : comparison;
      }

      const diff = (valA as number) - (valB as number);
      return sortOrder === 'desc' ? -diff : diff;
    });
  }

  const total = certificates.length;
  const paginatedCerts = certificates.slice(offset, offset + limit);

  return {
    certificates: paginatedCerts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    sortBy: sortBy || 'companySequence',
    sortOrder
  };
}

