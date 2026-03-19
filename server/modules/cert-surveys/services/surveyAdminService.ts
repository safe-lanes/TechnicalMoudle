import * as surveyAdminRepo from '../repositories/surveyAdminRepository';

// ══════════════════════════════════════════════════════════
// Master Survey Admin
// ══════════════════════════════════════════════════════════

// ── GET /admin/ship-surveys-master ──

export async function getMasterSurveys() {
  const result = await surveyAdminRepo.getMasterSurveys();
  if (result === null) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }
  return result;
}

// ── POST /admin/ship-surveys-master ──

export async function saveMasterSurveys(body: any) {
  const surveys = body.surveys;
  const vesselSpecificSurveys: string[] = body.vesselSpecificSurveys || [];
  const targetVessels: Array<{ id: string; name: string }> = body.targetVessels || [];

  if (!Array.isArray(surveys)) {
    throw Object.assign(new Error("surveys must be an array"), { statusCode: 400 });
  }

  console.log(`Saving ${surveys.length} ship surveys master entries...`);

  // Validate: if vessel-specific surveys are provided, targetVessels must not be empty
  if (vesselSpecificSurveys.length > 0 && targetVessels.length === 0) {
    throw Object.assign(new Error("targetVessels is required when adding vessel-specific surveys"), {
      statusCode: 400,
      details: "Please select at least one vessel before adding vessel-specific surveys"
    });
  }

  if (vesselSpecificSurveys.length > 0) {
    console.log(`Vessel-specific surveys: ${vesselSpecificSurveys.join(', ')} for vessels: ${targetVessels.map(v => v.name).join(', ')}`);
  }

  let insertedCount = 0;
  let updatedCount = 0;
  const newlyInsertedMasterIds: string[] = [];
  const vesselSpecificSet = new Set(vesselSpecificSurveys);

  // Fetch distinct vessels from existing applicability records
  const distinctVessels = await surveyAdminRepo.getDistinctVessels();
  if (!distinctVessels) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }
  const allVessels = distinctVessels.map(v => ({ id: v.vesselId, name: v.vesselName }));

  for (const survey of surveys) {
    const existing = await surveyAdminRepo.getMasterSurveyByMasterId(survey.masterId);
    if (!existing) {
      throw Object.assign(new Error("Database not available"), { statusCode: 503 });
    }

    if (existing.length > 0) {
      // Update existing
      await surveyAdminRepo.updateMasterSurvey(survey.masterId, {
        sequence: survey.sequence,
        surveyName: survey.surveyName,
        category: survey.category,
        group: survey.group,
        requirementRef: survey.requirementRef || null,
        applicableToCompany: survey.applicableToCompany || false,
        surveyLabel: survey.surveyLabel || null,
        isActive: survey.isActive !== false,
        companyId: survey.companyId || null,
        companyGroup: survey.companyGroup || null,
        companySequence: survey.companySequence || null,
      });
      updatedCount++;
    } else {
      // Insert new
      await surveyAdminRepo.insertMasterSurvey({
        sequence: survey.sequence,
        masterId: survey.masterId,
        surveyName: survey.surveyName,
        category: survey.category,
        group: survey.group,
        requirementRef: survey.requirementRef || null,
        applicableToCompany: survey.applicableToCompany || false,
        surveyLabel: survey.surveyLabel || null,
        isActive: survey.isActive !== false,
        companyId: survey.companyId || null,
        companyGroup: survey.companyGroup || null,
        companySequence: survey.companySequence || null,
      });
      insertedCount++;
      newlyInsertedMasterIds.push(survey.masterId);
    }
  }

  // Auto-create applicability records for newly inserted surveys
  if (newlyInsertedMasterIds.length > 0 && allVessels.length > 0) {
    console.log(`Auto-creating applicability records for ${allVessels.length} vessel(s) for ${newlyInsertedMasterIds.length} new survey(s)`);

    // Fetch existing applicability records to avoid duplicates
    const existingApplicability = await surveyAdminRepo.getAllApplicability();
    if (!existingApplicability) {
      throw Object.assign(new Error("Database not available"), { statusCode: 503 });
    }

    const existingKeys = new Set(existingApplicability.map(a => `${a.vesselId}-${a.masterId}`));

    const applicabilityToInsert: Array<{
      vesselId: string;
      vesselName: string;
      masterId: string;
      isApplicable: boolean;
    }> = [];

    // Separate vessel-only (VES-) and non-vessel-only master IDs
    const vesselOnlyMasterIds = newlyInsertedMasterIds.filter(id => vesselSpecificSet.has(id) || id.startsWith('VES-'));
    const nonVesselMasterIds = newlyInsertedMasterIds.filter(id => !vesselSpecificSet.has(id) && !id.startsWith('VES-'));

    // Create applicability for non-vessel-specific surveys - for ALL vessels
    for (const masterId of nonVesselMasterIds) {
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

    // Create applicability for vessel-specific surveys (VES-) - only for target vessels
    if (vesselOnlyMasterIds.length > 0 && targetVessels.length > 0) {
      console.log(`Auto-creating applicability records for ${targetVessels.length} target vessel(s) for ${vesselOnlyMasterIds.length} vessel-specific survey(s)`);

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
      await surveyAdminRepo.insertApplicabilityBulk(applicabilityToInsert);
      console.log(`Created ${applicabilityToInsert.length} survey applicability records`);
    }
  }

  console.log(`Ship surveys master saved: ${insertedCount} inserted, ${updatedCount} updated`);

  return {
    success: true,
    message: `Saved ${surveys.length} surveys`,
    inserted: insertedCount,
    updated: updatedCount
  };
}

// ── DELETE /admin/ship-surveys-master/:masterId ──

export async function deleteMasterSurvey(masterId: string) {
  const result = await surveyAdminRepo.deleteMasterSurvey(masterId);
  if (result === null) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  console.log(`Deleted ship survey master: ${masterId}`);

  return { success: true, message: `Deleted survey ${masterId}` };
}

// ══════════════════════════════════════════════════════════
// Labels Configuration
// ══════════════════════════════════════════════════════════

// ── GET /admin/ship-surveys-labels ──

export async function getSurveyLabels() {
  const labels = await surveyAdminRepo.getSurveyLabels();
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

// ── POST /admin/ship-surveys-labels ──

export async function saveSurveyLabels(body: any) {
  const { configType, labels } = body;

  if (!configType || !Array.isArray(labels)) {
    throw Object.assign(new Error("Invalid request body: requires configType and labels array"), { statusCode: 400 });
  }

  console.log(`Saving ${labels.length} survey labels for config type: ${configType}...`);

  // Delete existing labels for this configType and re-insert
  const deleteResult = await surveyAdminRepo.deleteSurveyLabelsByType(configType);
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

    await surveyAdminRepo.insertSurveyLabels(insertData);
  }

  console.log(`Survey labels saved for ${configType}: ${labels.length} entries`);

  return { success: true, message: `Saved ${labels.length} labels for ${configType}` };
}

// ══════════════════════════════════════════════════════════
// Applicability
// ══════════════════════════════════════════════════════════

// ── GET /admin/vessel-survey-applicability ──

export async function getApplicability(vesselIds: string | undefined) {
  if (!vesselIds) {
    throw Object.assign(new Error("vesselIds query parameter required"), { statusCode: 400 });
  }

  const vesselIdList = typeof vesselIds === 'string' ? vesselIds.split(',').filter(Boolean) : [];

  if (vesselIdList.length === 0) {
    return [];
  }

  const applicability = await surveyAdminRepo.getApplicabilityByVesselIds(vesselIdList);
  if (applicability === null) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  return applicability;
}

// ── POST /admin/vessel-survey-applicability/initialize ──

export async function initializeApplicability(body: any) {
  const { vesselId, vesselName } = body;

  if (!vesselId || !vesselName) {
    throw Object.assign(new Error("vesselId and vesselName are required"), { statusCode: 400 });
  }

  // Check if vessel already has records
  const existingRecords = await surveyAdminRepo.getApplicabilityByVesselId(vesselId);
  if (existingRecords === null) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  if (existingRecords.length > 0) {
    return { success: true, message: "Vessel already initialized", records: existingRecords };
  }

  // Get all company surveys
  const companySurveys = await surveyAdminRepo.getCompanySurveys();
  if (companySurveys === null) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  if (companySurveys.length === 0) {
    return { success: true, message: "No company surveys to initialize", records: [] };
  }

  // Create applicability records for all company surveys
  const insertData = companySurveys.map(survey => ({
    vesselId,
    vesselName,
    masterId: survey.masterId,
    isApplicable: true,
  }));

  try {
    const insertedRecords = await surveyAdminRepo.insertApplicabilityBulk(insertData);
    if (!insertedRecords) {
      throw Object.assign(new Error("Database not available"), { statusCode: 503 });
    }

    console.log(`Initialized ${insertedRecords.length} survey applicability records for vessel ${vesselName}`);

    return { success: true, message: `Initialized ${insertedRecords.length} surveys for vessel`, records: insertedRecords };
  } catch (error: any) {
    if (error.code === '23503') {
      console.log(`Vessel ${vesselName} (${vesselId}) not found in vessels table - skipping survey applicability initialization`);
      return { success: true, message: "Vessel not yet registered in local database, skipping initialization", records: [] };
    }
    throw error;
  }
}

// ── POST /admin/vessel-survey-applicability/bulk-update ──

export async function bulkUpdateApplicability(body: any) {
  const { vessels, masterId, isApplicable } = body;

  if (!Array.isArray(vessels) || !masterId || typeof isApplicable !== 'boolean') {
    throw Object.assign(new Error("vessels array, masterId, and isApplicable are required"), { statusCode: 400 });
  }

  const vesselIds = vessels.map((v: any) => v.id);

  // Update all matching records
  const updatedRecords = await surveyAdminRepo.bulkUpdateApplicability(vesselIds, masterId, isApplicable);
  if (!updatedRecords) {
    throw Object.assign(new Error("Database not available"), { statusCode: 503 });
  }

  // For vessels without existing records, create them
  const updatedVesselIds = new Set(updatedRecords.map((r: any) => r.vesselId));
  const missingVessels = vessels.filter((v: any) => !updatedVesselIds.has(v.id));

  if (missingVessels.length > 0) {
    const newRecords = await surveyAdminRepo.insertApplicabilityBulk(
      missingVessels.map((v: any) => ({
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
