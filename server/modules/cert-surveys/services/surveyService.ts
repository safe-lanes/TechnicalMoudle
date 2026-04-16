import * as surveyRepo from '../repositories/surveyRepository';

// ── Types ──

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

// ── Initialize Surveys ──

export async function initializeSurveys() {
  const existingSurveys = await surveyRepo.getSurveys();
  if (existingSurveys.length === 0) {
    const sampleSurveys = [
      {
        id: 'S1',
        surveyName: 'Ballast Water Management annual Survey',
        type: 'Annual',
        vessel: 'MV Test',
        surveyDate: '01 Sep 2019',
        dueDate: '01 Sep 2024',
        firstRangeDate: '01 Sep 2024',
        secondRangeDate: '01 Sep 2024',
        postponed: '01 Sep 2024',
        lastEdit: '01 Sep 2024',
        applicable: true,
        attachments: [],
      },
      {
        id: 'S2',
        surveyName: 'Ballast Water Management annual Survey',
        type: 'Int',
        vessel: 'MV Test',
        surveyDate: '',
        dueDate: '',
        firstRangeDate: '',
        secondRangeDate: '',
        postponed: '',
        lastEdit: '',
        applicable: true,
        attachments: [],
      },
      {
        id: 'S3',
        surveyName: 'Safety Equipment Survey',
        type: 'Annual',
        vessel: 'MV TEST 2',
        surveyDate: '15 Mar 2020',
        dueDate: '15 Mar 2025',
        firstRangeDate: '15 Mar 2024',
        secondRangeDate: '15 Sep 2024',
        postponed: '',
        lastEdit: '20 Oct 2024',
        applicable: true,
        attachments: [],
      },
      {
        id: 'S4',
        surveyName: 'Hull and Machinery Survey',
        type: 'Int',
        vessel: 'MT Nordic Star',
        surveyDate: '01 Jan 2021',
        dueDate: '01 Jan 2026',
        firstRangeDate: '01 Jan 2024',
        secondRangeDate: '01 Jul 2024',
        postponed: '01 Mar 2024',
        lastEdit: '15 Nov 2024',
        applicable: false,
        attachments: [],
      },
      {
        id: 'S5',
        surveyName: 'Load Line Survey',
        type: 'Annual',
        vessel: 'MT Pacific Voyager',
        surveyDate: '10 Jun 2022',
        dueDate: '10 Jun 2027',
        firstRangeDate: '10 Jun 2024',
        secondRangeDate: '',
        postponed: '',
        lastEdit: '25 Sep 2024',
        applicable: true,
        attachments: [],
      },
    ];
    for (const survey of sampleSurveys) {
      await surveyRepo.createSurvey(survey);
    }
    console.log('Initialized surveys data with sample data via storage layer');
  }
}

// ── GET /surveys ──

export async function getSurveys(filters: SurveyFilters) {
  const page = filters.page || 1;
  const limit = filters.limit || 100;
  const offset = (page - 1) * limit;
  const sortBy = filters.sortBy;
  const sortOrder = (filters.sortOrder)?.toLowerCase() === 'desc' ? 'desc' : 'asc';

  // Step 1: Get applicable surveys
  const applicabilityRecords = await surveyRepo.getApplicableSurveys();
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
  const masterRecords = await surveyRepo.getMasterSurveysByIds(masterIds);
  if (!masterRecords) {
    throw Object.assign(new Error("Database not available"), { statusCode: 500 });
  }

  const masterMap = new Map(masterRecords.map(m => [m.masterId, m]));

  // Step 3: Get vessel survey data
  const surveyDataRecords = await surveyRepo.getAllVesselSurveyData();
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

// ── GET /surveys/:id ──

export async function getSurvey(id: string) {
  return surveyRepo.getSurvey(id);
}

// ── PATCH /surveys/:id ──

export async function updateSurvey(compoundId: string, body: any) {
  const parts = compoundId.split('::');

  if (parts.length !== 2) {
    throw Object.assign(new Error("Invalid ID format. Expected vesselId::masterId"), { statusCode: 400 });
  }

  const vesselId = parts[0];
  const masterId = parts[1];

  const { surveyDate, dueDate, firstRangeDate, secondRangeDate, postponed, attachments } = body;

  // Get vessel name from applicability record
  const applicabilityRecord = await surveyRepo.getSurveyApplicabilityByKey(vesselId, masterId);
  if (!applicabilityRecord) {
    throw Object.assign(new Error("Database not available"), { statusCode: 500 });
  }

  if (applicabilityRecord.length === 0) {
    throw Object.assign(new Error("Survey applicability record not found"), { statusCode: 404 });
  }

  const vesselName = applicabilityRecord[0].vesselName;

  // Get current date for lastEditUpload
  const now = new Date();
  const lastEditUpload = `${now.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()]} ${now.getFullYear()}`;

  // Check if data record exists
  const existingData = await surveyRepo.getVesselSurveyDataByKey(vesselId, masterId);
  if (!existingData) {
    throw Object.assign(new Error("Database not available"), { statusCode: 500 });
  }

  let result;

  if (existingData.length > 0) {
    // Update existing record
    const updateData: any = { updatedAt: new Date(), lastEditUpload };
    if (surveyDate !== undefined) updateData.surveyDate = surveyDate;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (firstRangeDate !== undefined) updateData.firstRangeDate = firstRangeDate;
    if (secondRangeDate !== undefined) updateData.secondRangeDate = secondRangeDate;
    if (postponed !== undefined) updateData.postponed = postponed;
    if (attachments !== undefined) updateData.attachments = attachments;

    result = await surveyRepo.updateSurveyData(vesselId, masterId, updateData);
  } else {
    // Insert new record
    result = await surveyRepo.insertSurveyData({
      vesselId,
      vesselName,
      masterId,
      surveyDate: surveyDate || null,
      dueDate: dueDate || null,
      firstRangeDate: firstRangeDate || null,
      secondRangeDate: secondRangeDate || null,
      postponed: postponed || null,
      lastEditUpload,
      attachments: attachments || [],
    });
  }

  if (!result) {
    throw Object.assign(new Error("Database not available"), { statusCode: 500 });
  }

  return result[0];
}

// ── POST /surveys ──

export async function createSurvey(body: any) {
  return surveyRepo.createSurvey(body);
}
