// Frozen pre-pagination Survey oracle. Keep independent of the optimized algorithm.
import * as surveyRepo from "../../repositories/surveyRepository";

interface SurveyFilters {
  vesselId?: string;
  vesselIds?: string[];
  vesselName?: string;
  vesselNames?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

export async function getLegacySurveys(filters: SurveyFilters, readRepo: Pick<typeof surveyRepo, "getApplicableSurveys" | "getMasterSurveysByIds" | "getAllVesselSurveyData"> = surveyRepo) {
  const page = filters.page || 1;
  const limit = filters.limit || 100;
  const offset = (page - 1) * limit;
  const sortBy = filters.sortBy;
  const sortOrder = (filters.sortOrder)?.toLowerCase() === 'desc' ? 'desc' : 'asc';

  // Step 1: Get applicable surveys
  const applicabilityRecords = await readRepo.getApplicableSurveys();
  if (!applicabilityRecords) {
    throw Object.assign(new Error("Database not available"), { statusCode: 500 });
  }

  if (applicabilityRecords.length === 0) {
    return { surveys: [], total: 0, page, limit, totalPages: 0 };
  }

  // Filter by vessel if specified
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
    return { surveys: [], total: 0, page, limit, totalPages: 0 };
  }

  // Step 2: Get all master surveys
  const masterIds = Array.from(new Set(filteredApplicability.map(r => r.masterId)));
  const masterRecords = await readRepo.getMasterSurveysByIds(masterIds);
  if (!masterRecords) {
    throw Object.assign(new Error("Database not available"), { statusCode: 500 });
  }

  const masterMap = new Map(masterRecords.map(m => [m.masterId, m]));

  // Step 3: Get vessel survey data
  const surveyDataRecords = await readRepo.getAllVesselSurveyData();
  if (!surveyDataRecords) {
    throw Object.assign(new Error("Database not available"), { statusCode: 500 });
  }

  const surveyDataMap = new Map<string, typeof surveyDataRecords[0]>();
  for (const data of surveyDataRecords) {
    const key = `${data.vesselId}-${data.masterId}`;
    surveyDataMap.set(key, data);
  }

  // Step 4: Build the survey list
  const surveys: any[] = [];

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
      const surveyData = surveyDataMap.get(dataKey);

      const effectiveSequence = master.companySequence ?? master.sequence ?? 9999;

      surveys.push({
        id: `${app.vesselId}::${app.masterId}`,
        companyId: master.companyId || master.masterId,
        surveyName: master.surveyLabel || master.surveyName,
        type: master.companyGroup || '',
        vessel: app.vesselName,
        vesselId: app.vesselId,
        masterId: app.masterId,
        companySequence: effectiveSequence,
        surveyDate: surveyData?.surveyDate || '',
        dueDate: surveyData?.dueDate || '',
        firstRangeDate: surveyData?.firstRangeDate || '',
        secondRangeDate: surveyData?.secondRangeDate || '',
        postponed: surveyData?.postponed || '',
        lastEdit: surveyData?.lastEditUpload || '',
        attachments: surveyData?.attachments || [],
      });
    }
  }

  // Apply server-side sorting before pagination
  if (sortBy) {
    surveys.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortBy) {
        case 'id':
        case 'companyId':
          valA = a.id || '';
          valB = b.id || '';
          break;
        case 'surveyName':
        case 'name':
          valA = a.surveyName || '';
          valB = b.surveyName || '';
          break;
        case 'vessel':
          valA = a.vessel || '';
          valB = b.vessel || '';
          break;
        case 'type':
        case 'companyGroup':
          valA = a.type || '';
          valB = b.type || '';
          break;
        case 'surveyDate':
          valA = a.surveyDate || '';
          valB = b.surveyDate || '';
          break;
        case 'dueDate':
          valA = a.dueDate || '';
          valB = b.dueDate || '';
          break;
        default:
          valA = a.companySequence;
          valB = b.companySequence;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }

  // Apply pagination
  const total = surveys.length;
  const totalPages = Math.ceil(total / limit);
  const paginatedSurveys = surveys.slice(offset, offset + limit);

  return {
    surveys: paginatedSurveys,
    total,
    page,
    limit,
    totalPages
  };
}

