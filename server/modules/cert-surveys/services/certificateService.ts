import * as certRepo from '../repositories/certificateRepository';
import { logFieldChanges } from '../../sync';
import type { CertificatePagingFilters } from '../repositories/certificatePagingRepository';

// ── GET /certificates ──

export async function getCertificates(filters: CertificatePagingFilters) {
  return certRepo.getCertificateListPage(filters);
}

// ── GET /certificates/:id ──

export async function getCertificate(certId: string) {
  const [vesselId, masterId] = certId.includes('::') ? certId.split('::', 2) : [null, null];

  if (!vesselId || !masterId) {
    return null;
  }

  const appRecords = await certRepo.getCertificateApplicability(vesselId, masterId);
  if (!appRecords) {
    throw Object.assign(new Error("Database not available"), { statusCode: 500 });
  }
  if (appRecords.length === 0) {
    return null;
  }
  const app = appRecords[0];

  const masterRecords = await certRepo.getMasterCertificateById(masterId);
  if (!masterRecords || masterRecords.length === 0) {
    throw Object.assign(new Error("Certificate master not found"), { statusCode: 404, code: 'MASTER_NOT_FOUND' });
  }
  const master = masterRecords[0];

  const dataRecords = await certRepo.getVesselCertificateDataByKey(vesselId, masterId);
  const certData = dataRecords ? dataRecords[0] : undefined;

  return {
    id: master.companyId || master.masterId,
    certificateName: master.certificateLabel || master.certificateName,
    type: master.companyGroup || '',
    vessel: app.vesselName,
    vesselId: app.vesselId,
    masterId: app.masterId,
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
  };
}

// ── PATCH /certificates/:id ──

export async function updateCertificate(certId: string, body: any) {
  const { vesselId: bodyVesselId, masterId: bodyMasterId, ...updateData } = body;

  let vesselId = bodyVesselId;
  let masterId = bodyMasterId;

  if (certId.includes('::')) {
    [vesselId, masterId] = certId.split('::', 2);
  }

  if (!vesselId || !masterId) {
    throw Object.assign(new Error("vesselId and masterId are required"), { statusCode: 400 });
  }

  const appRecords = await certRepo.getCertificateApplicability(vesselId, masterId);
  if (!appRecords) {
    throw Object.assign(new Error("Database not available"), { statusCode: 500 });
  }
  if (appRecords.length === 0) {
    throw Object.assign(new Error("Certificate not applicable or has been deleted"), { statusCode: 404 });
  }
  const vesselName = appRecords[0].vesselName;

  const masterRecords = await certRepo.getMasterCertificateById(masterId);
  if (!masterRecords || masterRecords.length === 0) {
    throw Object.assign(new Error("Certificate master not found or has been deleted"), { statusCode: 404, code: 'MASTER_NOT_FOUND' });
  }
  const master = masterRecords[0];

  const existingData = await certRepo.getVesselCertificateDataByKey(vesselId, masterId);
  if (!existingData) {
    throw Object.assign(new Error("Database not available"), { statusCode: 500 });
  }

  // Cross-field date validation: when the merged post-update state has both
  // Issue Date and Expiry Date set, Issue Date must be <= Expiry Date.
  // Dates may be stored either as ISO ("YYYY-MM-DD") or grid display format
  // ("DD MMM YYYY"); normalise to ISO before comparing.
  const normaliseDate = (raw: unknown): string => {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const months: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };
    const m = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
    if (m) {
      const [, day, mon, year] = m;
      const month = months[mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()];
      if (month) return `${year}-${month}-${day.padStart(2, '0')}`;
    }
    return '';
  };
  const existingRow = existingData[0] as any | undefined;
  const incomingHasIssue = Object.prototype.hasOwnProperty.call(updateData, 'issueDate');
  const incomingHasExpiry = Object.prototype.hasOwnProperty.call(updateData, 'expiryDate');
  // Only enforce cross-field validation when the request actually touches one
  // of these fields. Otherwise unrelated PATCHes (e.g. attachment-only) on
  // historically inconsistent rows would be blocked by data the user is not
  // editing.
  const mergedIssue = normaliseDate(incomingHasIssue ? updateData.issueDate : existingRow?.issueDate);
  const mergedExpiry = normaliseDate(incomingHasExpiry ? updateData.expiryDate : existingRow?.expiryDate);
  if ((incomingHasIssue || incomingHasExpiry) && mergedIssue && mergedExpiry && mergedIssue > mergedExpiry) {
    const wording = incomingHasExpiry && !incomingHasIssue
      ? 'Expiry Date cannot be earlier than Issue Date.'
      : 'Issue Date cannot be later than Expiry Date.';
    throw Object.assign(new Error(wording), { statusCode: 400 });
  }

  let result;
  if (existingData.length > 0) {
    result = await certRepo.updateCertificateData(vesselId, masterId, updateData);
    // Sync field logging — vessel_certificate_data UPDATE
    if (result && result[0]) {
      try {
        const row = result[0] as any;
        await logFieldChanges('vessel_certificate_data', row.vcduuid || String(row.id), vesselId, existingData[0], row, 'system');
      } catch (err) { console.error('[FieldLogger] VesselCertData update:', err); }
    }
  } else {
    result = await certRepo.insertCertificateData({
      vesselId,
      vesselName,
      masterId,
      ...updateData,
    });
    // Sync field logging — vessel_certificate_data INSERT
    if (result && result[0]) {
      try {
        const row = result[0] as any;
        await logFieldChanges('vessel_certificate_data', row.vcduuid || String(row.id), vesselId, null, row, 'system');
      } catch (err) { console.error('[FieldLogger] VesselCertData create:', err); }
    }
  }

  if (!result) {
    throw Object.assign(new Error("Database not available"), { statusCode: 500 });
  }

  return {
    id: master.companyId || masterId,
    certificateName: master.certificateLabel || master.certificateName || '',
    type: master.companyGroup || '',
    vessel: vesselName,
    vesselId,
    masterId,
    certificateNumber: result[0]?.certificateNumber || '',
    issueDate: result[0]?.issueDate || '',
    expiryDate: result[0]?.expiryDate || '',
    lastAnnual: result[0]?.lastAnnual || '',
    nextAnnual: result[0]?.nextAnnual || '',
    lastInterm: result[0]?.lastInterm || '',
    nextInterm: result[0]?.nextInterm || '',
    endorsementDate: result[0]?.endorsementDate || '',
    lastEditUpload: result[0]?.lastEditUpload || '',
    attachments: result[0]?.attachments || [],
  };
}
