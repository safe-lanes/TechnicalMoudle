import * as surveyRepo from '../repositories/surveyRepository';
import { logFieldChanges } from '../../sync';
import type { SurveyPagingFilters } from '../repositories/surveyPagingRepository';

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

export async function getSurveys(filters: SurveyPagingFilters) {
  return surveyRepo.getSurveyListPage(filters);
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
    // Sync field logging — vessel_survey_data UPDATE
    if (result && result[0]) {
      try {
        const row = result[0] as any;
        await logFieldChanges('vessel_survey_data', row.vsduuid || String(row.id), vesselId, existingData[0], row, 'system');
      } catch (err) { console.error('[FieldLogger] VesselSurveyData update:', err); }
    }
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
    // Sync field logging — vessel_survey_data INSERT
    if (result && result[0]) {
      try {
        const row = result[0] as any;
        await logFieldChanges('vessel_survey_data', row.vsduuid || String(row.id), vesselId, null, row, 'system');
      } catch (err) { console.error('[FieldLogger] VesselSurveyData create:', err); }
    }
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
