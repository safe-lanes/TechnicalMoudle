import * as certAdminRepo from '../repositories/certAdminRepository';
import { ensureVesselExists } from './vesselEnsureService';
import { getPostgresClient } from '../../../postgresClient';

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

  const postgres = getPostgresClient();
  if (!postgres) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  console.log(`Saving ${certificates.length} ship certificates master entries...`);

  // Wrap master upserts + applicability fan-out in a single transaction so a
  // mid-flight failure (e.g. 23505/42P10) rolls back cleanly instead of leaving
  // orphan ship_certificates_master rows without their applicability records —
  // the exact bug that had Master/Company tab "Save" toasting an error while
  // silently persisting partial data on the deployed ship.
  return await postgres.db.transaction(async (tx) => {
  // Handle deletions
  let deletedCount = 0;
  if (deletedMasterIds.length > 0) {
    for (const masterId of deletedMasterIds) {
      const existing = await certAdminRepo.getMasterCertificateSystemFlag(masterId, tx);
      if (!existing) {
        throw Object.assign(new Error("Database not available"), { statusCode: 503 });
      }
      if (existing.length > 0 && existing[0].isSystemDefined) {
        console.log(`Skipped deletion of system-defined certificate: ${masterId}`);
        continue;
      }
      await certAdminRepo.deleteMasterCertificate(masterId, tx);
      deletedCount++;
      console.log(`Deleted certificate: ${masterId}`);
    }
  }

  if (vesselSpecificCerts.length > 0) {
    console.log(`Vessel-specific certificates: ${vesselSpecificCerts.join(', ')} for vessels: ${targetVessels.map(v => v.name).join(', ')}`);
  }

  let insertedCount = 0;
  let updatedCount = 0;
  const newlyInsertedMasterIds: string[] = [];
  const vesselSpecificSet = new Set(vesselSpecificCerts);

  const allVesselsResult = await certAdminRepo.getAllVessels(tx);
  if (!allVesselsResult) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }
  const allVessels = allVesselsResult.map(v => ({ id: v.vesselId, name: v.vesselName }));

  for (const cert of certificates) {
    const existing = await certAdminRepo.getMasterCertificateByMasterId(cert.masterId, tx);
    if (!existing) {
      throw Object.assign(new Error("Database not available"), { statusCode: 503 });
    }

    if (existing.length > 0) {
      const wasDeleted = existing[0].isDeleted === true;
      const preservedSystemFlag = existing[0].isSystemDefined || cert.isSystemDefined || false;
      await certAdminRepo.updateMasterCertificate(cert.masterId, {
        sequence: cert.sequence,
        certificateName: cert.certificateName,
        category: cert.category,
        group: cert.group,
        requirementRef: cert.requirementRef || null,
        applicableToCompany: cert.applicableToCompany || false,
        certificateLabel: cert.certificateLabel || null,
        isActive: cert.isActive !== false,
        isDeleted: false,
        isSystemDefined: preservedSystemFlag,
        companyId: cert.companyId || null,
        companyGroup: cert.companyGroup || null,
        companySequence: cert.companySequence || null,
      }, tx);
      if (wasDeleted) {
        insertedCount++;
        newlyInsertedMasterIds.push(cert.masterId);
      } else {
        updatedCount++;
      }
    } else {
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
        isSystemDefined: cert.isSystemDefined || false,
        companyId: cert.companyId || null,
        companyGroup: cert.companyGroup || null,
        companySequence: cert.companySequence || null,
      }, tx);
      insertedCount++;
      newlyInsertedMasterIds.push(cert.masterId);
    }
  }

  // Auto-create vessel_certificate_applicability records for newly inserted certs
  if (newlyInsertedMasterIds.length > 0) {
    const vesselOnlyMasterIds = newlyInsertedMasterIds.filter(id => vesselSpecificSet.has(id) || id.startsWith('VES-'));
    const companyApplicableNewIds = newlyInsertedMasterIds.filter(id => {
      if (vesselSpecificSet.has(id) || id.startsWith('VES-')) return false;
      const cert = certificates.find(c => c.masterId === id);
      return cert?.applicableToCompany === true;
    });

    if (vesselOnlyMasterIds.length > 0 && targetVessels.length === 0) {
      throw Object.assign(new Error("targetVessels is required when adding new vessel-specific certificates"), {
        statusCode: 400,
        details: "Please select at least one vessel before adding vessel-specific certificates"
      });
    }

    const idsToCheck = [...companyApplicableNewIds, ...vesselOnlyMasterIds];
    const existingApplicability = idsToCheck.length > 0
      ? await certAdminRepo.getApplicabilityByMasterIds(idsToCheck, tx)
      : [];
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

    for (const masterId of companyApplicableNewIds) {
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

    if (applicabilityToInsert.length > 0) {
      await certAdminRepo.insertApplicabilityBulk(applicabilityToInsert, tx);
      console.log(`Created ${applicabilityToInsert.length} applicability records for new certificates`);
    }
  }

  // Sync: ensure ALL company-applicable master certs have applicability records for all vessels
  // This catches certs that were updated to applicableToCompany=true after initial creation
  const companyApplicableResult = await certAdminRepo.getCompanyApplicableMasterIds(tx);
  if (!companyApplicableResult) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }
  const companyApplicableIds = new Set(companyApplicableResult.map(r => r.masterId));

  const allApplicabilityRecords = await certAdminRepo.getAllApplicabilityRecords(tx);
  if (!allApplicabilityRecords) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  const existingApplicabilityKeys = new Set(
    allApplicabilityRecords.map(r => `${r.vesselId}-${r.masterId}`)
  );

  const syncInserts: Array<{
    vesselId: string;
    vesselName: string;
    masterId: string;
    isApplicable: boolean;
  }> = [];

  for (const masterId of companyApplicableIds) {
    if (masterId.startsWith('VES-')) continue;
    for (const vessel of allVessels) {
      const key = `${vessel.id}-${masterId}`;
      if (!existingApplicabilityKeys.has(key)) {
        syncInserts.push({
          vesselId: vessel.id,
          vesselName: vessel.name,
          masterId,
          isApplicable: true,
        });
      }
    }
  }

  if (syncInserts.length > 0) {
    await certAdminRepo.insertApplicabilityBulk(syncInserts, tx);
    console.log(`Synced ${syncInserts.length} missing applicability records for company-applicable certificates`);
  }

  // Cleanup: remove applicability records for non-company-applicable, non-VES certificates
  const staleApplicabilityMasterIds: string[] = [];
  const masterIdsInApplicability = new Set(allApplicabilityRecords.map(r => r.masterId));
  for (const masterId of masterIdsInApplicability) {
    if (masterId.startsWith('VES-')) continue;
    if (!companyApplicableIds.has(masterId)) {
      staleApplicabilityMasterIds.push(masterId);
    }
  }

  if (staleApplicabilityMasterIds.length > 0) {
    await certAdminRepo.softDeleteApplicabilityByMasterIds(staleApplicabilityMasterIds, tx);
    console.log(`Soft-deleted ${staleApplicabilityMasterIds.length} stale non-company applicability master IDs: ${staleApplicabilityMasterIds.join(', ')}`);
  }

  console.log(`Ship certificates master saved: ${insertedCount} inserted, ${updatedCount} updated, ${deletedCount} deleted`);

  return {
    success: true,
    message: `Saved ${certificates.length} certificates`,
    inserted: insertedCount,
    updated: updatedCount,
    deleted: deletedCount
  };
  });
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

  const companyCertificates = await certAdminRepo.getCompanyCertificates();
  if (companyCertificates === null) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  if (companyCertificates.length === 0) {
    if (existingRecords.length > 0) {
      return { success: true, message: "Vessel already initialized", records: existingRecords };
    }
    return { success: true, message: "No company certificates to initialize", records: [] };
  }

  await ensureVesselExists(vesselId, vesselName);

  const existingMasterIds = new Set(existingRecords.map(r => r.masterId));
  const missingCerts = companyCertificates.filter(cert => !existingMasterIds.has(cert.masterId));

  if (missingCerts.length === 0) {
    return { success: true, message: "Vessel already initialized", records: existingRecords };
  }

  const insertData = missingCerts.map(cert => ({
    vesselId,
    vesselName,
    masterId: cert.masterId,
    isApplicable: true,
  }));

  const insertedRecords = await certAdminRepo.insertApplicability(insertData);
  if (!insertedRecords) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  const allRecords = [...existingRecords, ...insertedRecords];
  console.log(`Initialized ${insertedRecords.length} new certificate applicability records for vessel ${vesselName} (${existingRecords.length} already existed)`);

  return { success: true, message: `Initialized ${insertedRecords.length} new certificates for vessel`, records: allRecords };
}

// ── PATCH /admin/vessel-certificate-applicability ──

export async function updateApplicability(body: any) {
  const { vesselId, vesselName, masterId, isApplicable } = body;

  if (!vesselId || !masterId || isApplicable === undefined) {
    throw Object.assign(new Error("vesselId, masterId, and isApplicable are required"), { statusCode: 400 });
  }

  const postgres = getPostgresClient();
  if (!postgres) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  // Atomic SELECT-then-INSERT/UPDATE so the partial unique index
  // uniq_vessel_certificate_applicability_live cannot 23505 a concurrent caller.
  return await postgres.db.transaction(async (tx) => {
    const existingRecord = await certAdminRepo.getApplicabilityByVesselAndMaster(vesselId, masterId, tx);
    if (existingRecord === null) {
      throw Object.assign(new Error("Database not available"), { statusCode: 503 });
    }

    if (existingRecord.length === 0) {
      const newRecord = await certAdminRepo.insertApplicability({
        vesselId,
        vesselName: vesselName || vesselId,
        masterId,
        isApplicable,
      }, tx);
      if (!newRecord) {
        throw Object.assign(new Error("Database not available"), { statusCode: 503 });
      }
      return { success: true, record: newRecord[0] };
    }

    const updatedRecord = await certAdminRepo.updateApplicability(vesselId, masterId, isApplicable, tx);
    if (!updatedRecord) {
      throw Object.assign(new Error("Database not available"), { statusCode: 503 });
    }

    return { success: true, record: updatedRecord[0] };
  });
}

// ── POST /admin/vessel-certificate-applicability/bulk-update ──

export async function bulkUpdateApplicability(body: any) {
  const { vessels, masterId, isApplicable } = body;

  if (!Array.isArray(vessels) || vessels.length === 0 || !masterId || isApplicable === undefined) {
    throw Object.assign(new Error("vessels array, masterId, and isApplicable are required"), { statusCode: 400 });
  }

  const vesselIds = vessels.map(v => v.id);

  const postgres = getPostgresClient();
  if (!postgres) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  // Atomic UPDATE-then-INSERT so partial unique index 42P10/23505 doesn't
  // commit half a bulk save. Caused Vessel Save 500s on the deployed ship
  // when the index was missing — now it rolls back cleanly even on conflicts.
  return await postgres.db.transaction(async (tx) => {
    const updatedRecords = await certAdminRepo.bulkUpdateApplicability(vesselIds, masterId, isApplicable, tx);
    if (!updatedRecords) {
      throw Object.assign(new Error("Database not available"), { statusCode: 503 });
    }

    const updatedVesselIds = new Set(updatedRecords.map(r => r.vesselId));
    const missingVessels = vessels.filter(v => !updatedVesselIds.has(v.id));

    if (missingVessels.length > 0) {
      const newRecords = await certAdminRepo.insertApplicability(
        missingVessels.map(v => ({
          vesselId: v.id,
          vesselName: v.name,
          masterId,
          isApplicable,
        })),
        tx
      );
      if (newRecords) {
        updatedRecords.push(...newRecords);
      }
    }

    return { success: true, records: updatedRecords };
  });
}
