import * as certAdminRepo from '../repositories/certAdminRepository';
import { ensureVesselExists } from './vesselEnsureService';

// ══════════════════════════════════════════════════════════
// Master Certificate Admin
// ══════════════════════════════════════════════════════════

// ── GET /admin/ship-certificates-master ──

export async function getMasterCertificates() {
  const result = await certAdminRepo.getMasterCertificates();
  if (result === null) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }
  return result;
}

// ── POST /admin/ship-certificates-master ──

export async function saveMasterCertificates(body: any) {
  const certificates = body.certificates;
  const deletedMasterIds: string[] = body.deletedMasterIds || [];
  const vesselSpecificCerts: string[] = body.vesselSpecificCerts || [];
  const targetVessels: Array<{ id: string; name: string }> = body.targetVessels || [];

  if (!Array.isArray(certificates)) {
    throw Object.assign(new Error("certificates must be an array"), { statusCode: 400 });
  }

  console.log(`Saving ${certificates.length} ship certificates master entries...`);

  // Handle deletions
  let deletedCount = 0;
  if (deletedMasterIds.length > 0) {
    for (const masterId of deletedMasterIds) {
      const existing = await certAdminRepo.getMasterCertificateSystemFlag(masterId);
      if (!existing) {
        throw Object.assign(new Error("Database not available"), { statusCode: 503 });
      }
      if (existing.length > 0 && existing[0].isSystemDefined) {
        console.log(`Skipped deletion of system-defined certificate: ${masterId}`);
        continue;
      }
      await certAdminRepo.deleteMasterCertificate(masterId);
      deletedCount++;
      console.log(`Deleted certificate: ${masterId}`);
    }
  }

  // Validate: if vessel-specific certs are provided, targetVessels must not be empty
  if (vesselSpecificCerts.length > 0 && targetVessels.length === 0) {
    throw Object.assign(new Error("targetVessels is required when adding vessel-specific certificates"), {
      statusCode: 400,
      details: "Please select at least one vessel before adding vessel-specific certificates"
    });
  }

  if (vesselSpecificCerts.length > 0) {
    console.log(`Vessel-specific certificates: ${vesselSpecificCerts.join(', ')} for vessels: ${targetVessels.map(v => v.name).join(', ')}`);
  }

  let insertedCount = 0;
  let updatedCount = 0;
  const newlyInsertedMasterIds: string[] = [];
  const vesselSpecificSet = new Set(vesselSpecificCerts);

  // Fetch distinct vessels from existing applicability records
  const distinctVessels = await certAdminRepo.getDistinctVessels();
  if (!distinctVessels) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }
  const allVessels = distinctVessels.map(v => ({ id: v.vesselId, name: v.vesselName }));

  for (const cert of certificates) {
    const existing = await certAdminRepo.getMasterCertificateByMasterId(cert.masterId);
    if (!existing) {
      throw Object.assign(new Error("Database not available"), { statusCode: 503 });
    }

    if (existing.length > 0) {
      // Update existing
      await certAdminRepo.updateMasterCertificate(cert.masterId, {
        sequence: cert.sequence,
        certificateName: cert.certificateName,
        category: cert.category,
        group: cert.group,
        requirementRef: cert.requirementRef || null,
        applicableToCompany: cert.applicableToCompany || false,
        certificateLabel: cert.certificateLabel || null,
        isActive: cert.isActive !== false,
        companyId: cert.companyId || null,
        companyGroup: cert.companyGroup || null,
        companySequence: cert.companySequence || null,
      });
      updatedCount++;
    } else {
      // Insert new
      await certAdminRepo.insertMasterCertificate({
        sequence: cert.sequence,
        masterId: cert.masterId,
        certificateName: cert.certificateName,
        category: cert.category,
        group: cert.group,
        requirementRef: cert.requirementRef || null,
        applicableToCompany: cert.applicableToCompany || false,
        certificateLabel: cert.certificateLabel || null,
        isActive: cert.isActive !== false,
        companyId: cert.companyId || null,
        companyGroup: cert.companyGroup || null,
        companySequence: cert.companySequence || null,
      });
      insertedCount++;
      newlyInsertedMasterIds.push(cert.masterId);
    }
  }

  // Auto-create vessel_certificate_applicability records
  if (newlyInsertedMasterIds.length > 0) {
    const companyWideMasterIds = newlyInsertedMasterIds.filter(id => !vesselSpecificSet.has(id));
    const vesselOnlyMasterIds = newlyInsertedMasterIds.filter(id => vesselSpecificSet.has(id));

    // Get existing applicability records to avoid duplicates
    const existingApplicability = await certAdminRepo.getApplicabilityByMasterIds(newlyInsertedMasterIds);
    if (!existingApplicability) {
      throw Object.assign(new Error("Database not available"), { statusCode: 503 });
    }

    const existingKeys = new Set(
      existingApplicability.map(app => `${app.vesselId}-${app.masterId}`)
    );

    const applicabilityToInsert: Array<{
      vesselId: string;
      vesselName: string;
      masterId: string;
      isApplicable: boolean;
    }> = [];

    // Company-wide certificates - for ALL vessels
    if (companyWideMasterIds.length > 0 && allVessels.length > 0) {
      console.log(`Auto-creating applicability records for ${allVessels.length} vessels for ${companyWideMasterIds.length} company-wide certificate(s)`);

      for (const masterId of companyWideMasterIds) {
        for (const vessel of allVessels) {
          const key = `${vessel.id}-${masterId}`;
          if (!existingKeys.has(key)) {
            applicabilityToInsert.push({
              vesselId: vessel.id,
              vesselName: vessel.name,
              masterId: masterId,
              isApplicable: true,
            });
          }
        }
      }
    }

    // Vessel-specific certificates (VES-) - only for target vessels
    if (vesselOnlyMasterIds.length > 0 && targetVessels.length > 0) {
      console.log(`Auto-creating applicability records for ${targetVessels.length} target vessel(s) for ${vesselOnlyMasterIds.length} vessel-specific certificate(s)`);

      for (const masterId of vesselOnlyMasterIds) {
        for (const vessel of targetVessels) {
          const key = `${vessel.id}-${masterId}`;
          if (!existingKeys.has(key)) {
            applicabilityToInsert.push({
              vesselId: vessel.id,
              vesselName: vessel.name,
              masterId: masterId,
              isApplicable: true,
            });
          }
        }
      }
    }

    // Bulk insert all applicability records at once
    if (applicabilityToInsert.length > 0) {
      await certAdminRepo.insertApplicabilityBulk(applicabilityToInsert);
      console.log(`Created ${applicabilityToInsert.length} applicability records for new certificates`);
    }
  }

  console.log(`Ship certificates master saved: ${insertedCount} inserted, ${updatedCount} updated, ${deletedCount} deleted`);

  return {
    success: true,
    message: `Saved ${certificates.length} certificates`,
    inserted: insertedCount,
    updated: updatedCount,
    deleted: deletedCount
  };
}

// ── DELETE /admin/ship-certificates-master/:masterId ──

export async function deleteMasterCertificate(masterId: string) {
  const existing = await certAdminRepo.getMasterCertificateSystemFlag(masterId);
  if (!existing) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  if (existing.length > 0 && existing[0].isSystemDefined) {
    throw Object.assign(new Error("System-defined certificates cannot be deleted"), { statusCode: 403 });
  }

  await certAdminRepo.deleteMasterCertificate(masterId);
  console.log(`Deleted ship certificate master: ${masterId}`);

  return { success: true, message: `Deleted certificate ${masterId}` };
}

// ══════════════════════════════════════════════════════════
// Labels Configuration
// ══════════════════════════════════════════════════════════

// ── GET /admin/ship-certificates-labels ──

export async function getCertificateLabels() {
  const labels = await certAdminRepo.getCertificateLabels();
  if (labels === null) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  // Transform to object grouped by configType
  const result: Record<string, Array<{ key: string, label: string }>> = {};
  for (const item of labels) {
    if (!result[item.configType]) {
      result[item.configType] = [];
    }
    result[item.configType].push({ key: item.key, label: item.label });
  }

  return result;
}

// ── POST /admin/ship-certificates-labels ──

export async function saveCertificateLabels(body: any) {
  const { configType, labels } = body;

  if (!configType || !Array.isArray(labels)) {
    throw Object.assign(new Error("Invalid request body: requires configType and labels array"), { statusCode: 400 });
  }

  console.log(`Saving ${labels.length} labels for config type: ${configType}...`);

  // Delete existing labels for this configType and re-insert
  const deleteResult = await certAdminRepo.deleteCertificateLabelsByType(configType);
  if (deleteResult === null) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  // Insert new labels
  if (labels.length > 0) {
    const insertData = labels.map((item: { key: string, label: string }) => ({
      configType,
      key: item.key,
      label: item.label || "",
    }));

    await certAdminRepo.insertCertificateLabels(insertData);
  }

  console.log(`Labels saved for ${configType}: ${labels.length} entries`);

  return { success: true, message: `Saved ${labels.length} labels for ${configType}` };
}

// ══════════════════════════════════════════════════════════
// Applicability
// ══════════════════════════════════════════════════════════

// ── GET /admin/vessel-certificate-applicability ──

export async function getApplicability(vesselIds: string | undefined) {
  if (!vesselIds) {
    throw Object.assign(new Error("vesselIds query parameter required"), { statusCode: 400 });
  }

  const vesselIdList = typeof vesselIds === 'string' ? vesselIds.split(',').filter(Boolean) : [];

  if (vesselIdList.length === 0) {
    return [];
  }

  const applicability = await certAdminRepo.getApplicabilityByVesselIds(vesselIdList);
  if (applicability === null) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  return applicability;
}

// ── POST /admin/vessel-certificate-applicability/initialize ──

export async function initializeApplicability(body: any) {
  const { vesselId, vesselName } = body;

  if (!vesselId || !vesselName) {
    throw Object.assign(new Error("vesselId and vesselName are required"), { statusCode: 400 });
  }

  // Check if vessel already has records
  const existingRecords = await certAdminRepo.getApplicabilityByVesselId(vesselId);
  if (existingRecords === null) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  if (existingRecords.length > 0) {
    return { success: true, message: "Vessel already initialized", records: existingRecords };
  }

  // Get all company certificates
  const companyCertificates = await certAdminRepo.getCompanyCertificates();
  if (companyCertificates === null) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  if (companyCertificates.length === 0) {
    return { success: true, message: "No company certificates to initialize", records: [] };
  }

  await ensureVesselExists(vesselId, vesselName);

  // Create applicability records for all company certificates
  const insertData = companyCertificates.map(cert => ({
    vesselId,
    vesselName,
    masterId: cert.masterId,
    isApplicable: true,
  }));

  const insertedRecords = await certAdminRepo.insertApplicability(insertData);
  if (!insertedRecords) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  console.log(`Initialized ${insertedRecords.length} certificate applicability records for vessel ${vesselName}`);

  return { success: true, message: `Initialized ${insertedRecords.length} certificates for vessel`, records: insertedRecords };
}

// ── PATCH /admin/vessel-certificate-applicability ──

export async function updateApplicability(body: any) {
  const { vesselId, vesselName, masterId, isApplicable } = body;

  if (!vesselId || !masterId || isApplicable === undefined) {
    throw Object.assign(new Error("vesselId, masterId, and isApplicable are required"), { statusCode: 400 });
  }

  // Check if record exists
  const existingRecord = await certAdminRepo.getApplicabilityByVesselAndMaster(vesselId, masterId);
  if (existingRecord === null) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  if (existingRecord.length === 0) {
    // Create new record
    const newRecord = await certAdminRepo.insertApplicability({
      vesselId,
      vesselName: vesselName || vesselId,
      masterId,
      isApplicable,
    });
    if (!newRecord) {
      throw Object.assign(new Error("Database not available"), { statusCode: 503 });
    }
    return { success: true, record: newRecord[0] };
  }

  // Update existing record
  const updatedRecord = await certAdminRepo.updateApplicability(vesselId, masterId, isApplicable);
  if (!updatedRecord) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  return { success: true, record: updatedRecord[0] };
}

// ── POST /admin/vessel-certificate-applicability/bulk-update ──

export async function bulkUpdateApplicability(body: any) {
  const { vessels, masterId, isApplicable } = body;

  if (!Array.isArray(vessels) || vessels.length === 0 || !masterId || isApplicable === undefined) {
    throw Object.assign(new Error("vessels array, masterId, and isApplicable are required"), { statusCode: 400 });
  }

  const vesselIds = vessels.map(v => v.id);

  // Update all matching records
  const updatedRecords = await certAdminRepo.bulkUpdateApplicability(vesselIds, masterId, isApplicable);
  if (!updatedRecords) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  // For vessels without existing records, create them
  const updatedVesselIds = new Set(updatedRecords.map(r => r.vesselId));
  const missingVessels = vessels.filter(v => !updatedVesselIds.has(v.id));

  if (missingVessels.length > 0) {
    const newRecords = await certAdminRepo.insertApplicability(
      missingVessels.map(v => ({
        vesselId: v.id,
        vesselName: v.name,
        masterId,
        isApplicable,
      }))
    );
    if (newRecords) {
      updatedRecords.push(...newRecords);
    }
  }

  return { success: true, records: updatedRecords };
}
