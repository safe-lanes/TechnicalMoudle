import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as certCtrl from './controllers/certificateController';
import * as surveyCtrl from './controllers/surveyController';
import * as certAdminCtrl from './controllers/certAdminController';
import * as surveyAdminCtrl from './controllers/surveyAdminController';

// Initialize surveys with sample data on startup
import { initializeSurveys } from './services/surveyService';
initializeSurveys();

const router = Router();

// ══════════════════════════════════════════════════════════
// Operational Certificates Routes
// ══════════════════════════════════════════════════════════

// GET  /certificates — list all certificates (3-table join)
router.get('/certificates', asyncHandler(certCtrl.getCertificates));

// GET  /certificates/:id — get single certificate (compound key vesselId::masterId)
router.get('/certificates/:id', asyncHandler(certCtrl.getCertificate));

// PATCH /certificates/:id — update certificate data (dates, attachments)
router.patch('/certificates/:id', asyncHandler(certCtrl.updateCertificate));

// ══════════════════════════════════════════════════════════
// Operational Surveys Routes
// ══════════════════════════════════════════════════════════

// GET  /surveys — list all surveys (3-table join)
router.get('/surveys', asyncHandler(surveyCtrl.getSurveys));

// POST /surveys — create new survey
router.post('/surveys', asyncHandler(surveyCtrl.createSurvey));

// GET  /surveys/:id — get single survey
router.get('/surveys/:id', asyncHandler(surveyCtrl.getSurvey));

// PATCH /surveys/:id — update survey data (dates, attachments)
router.patch('/surveys/:id', asyncHandler(surveyCtrl.updateSurvey));

// ══════════════════════════════════════════════════════════
// Certificate Admin - Master Routes
// ══════════════════════════════════════════════════════════

// GET  /admin/ship-certificates-master — get all master certificate entries
router.get('/admin/ship-certificates-master', asyncHandler(certAdminCtrl.getMasterCertificates));

// POST /admin/ship-certificates-master — bulk upsert master certificates
router.post('/admin/ship-certificates-master', asyncHandler(certAdminCtrl.saveMasterCertificates));

// DELETE /admin/ship-certificates-master/:masterId — delete master certificate
router.delete('/admin/ship-certificates-master/:masterId', asyncHandler(certAdminCtrl.deleteMasterCertificate));

// ══════════════════════════════════════════════════════════
// Certificate Admin - Labels Routes
// ══════════════════════════════════════════════════════════

// GET  /admin/ship-certificates-labels — get labels configuration
router.get('/admin/ship-certificates-labels', asyncHandler(certAdminCtrl.getCertificateLabels));

// POST /admin/ship-certificates-labels — save labels configuration
router.post('/admin/ship-certificates-labels', asyncHandler(certAdminCtrl.saveCertificateLabels));

// ══════════════════════════════════════════════════════════
// Certificate Admin - Applicability Routes
// IMPORTANT: /initialize and /bulk-update MUST be before any parameterized routes
// ══════════════════════════════════════════════════════════

// GET  /admin/vessel-certificate-applicability — get applicability for vessels
router.get('/admin/vessel-certificate-applicability', asyncHandler(certAdminCtrl.getApplicability));

// POST /admin/vessel-certificate-applicability/initialize — initialize vessel applicability
router.post('/admin/vessel-certificate-applicability/initialize', asyncHandler(certAdminCtrl.initializeApplicability));

// PATCH /admin/vessel-certificate-applicability — update single applicability record
router.patch('/admin/vessel-certificate-applicability', asyncHandler(certAdminCtrl.updateApplicability));

// POST /admin/vessel-certificate-applicability/bulk-update — bulk update applicability
router.post('/admin/vessel-certificate-applicability/bulk-update', asyncHandler(certAdminCtrl.bulkUpdateApplicability));

// ══════════════════════════════════════════════════════════
// Survey Admin - Master Routes
// ══════════════════════════════════════════════════════════

// GET  /admin/ship-surveys-master — get all master survey entries
router.get('/admin/ship-surveys-master', asyncHandler(surveyAdminCtrl.getMasterSurveys));

// POST /admin/ship-surveys-master — bulk upsert master surveys
router.post('/admin/ship-surveys-master', asyncHandler(surveyAdminCtrl.saveMasterSurveys));

// DELETE /admin/ship-surveys-master/:masterId — delete master survey
router.delete('/admin/ship-surveys-master/:masterId', asyncHandler(surveyAdminCtrl.deleteMasterSurvey));

// ══════════════════════════════════════════════════════════
// Survey Admin - Labels Routes
// ══════════════════════════════════════════════════════════

// GET  /admin/ship-surveys-labels — get survey labels configuration
router.get('/admin/ship-surveys-labels', asyncHandler(surveyAdminCtrl.getSurveyLabels));

// POST /admin/ship-surveys-labels — save survey labels configuration
router.post('/admin/ship-surveys-labels', asyncHandler(surveyAdminCtrl.saveSurveyLabels));

// ══════════════════════════════════════════════════════════
// Survey Admin - Applicability Routes
// ══════════════════════════════════════════════════════════

// GET  /admin/vessel-survey-applicability — get applicability for vessels
router.get('/admin/vessel-survey-applicability', asyncHandler(surveyAdminCtrl.getApplicability));

// POST /admin/vessel-survey-applicability/initialize — initialize vessel applicability
router.post('/admin/vessel-survey-applicability/initialize', asyncHandler(surveyAdminCtrl.initializeApplicability));

// POST /admin/vessel-survey-applicability/bulk-update — bulk update applicability
router.post('/admin/vessel-survey-applicability/bulk-update', asyncHandler(surveyAdminCtrl.bulkUpdateApplicability));

export default router;
