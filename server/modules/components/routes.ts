import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../shared/middleware';
import { requireAuth, requirePMSAdmin } from '../../middleware/auth';
import * as componentCtrl from './controllers/componentController';
import * as uploadCtrl from './controllers/componentUploadController';
import * as subCtrl from './controllers/subEntityController';

const router = Router();

// Multer config — same as legacy (memoryStorage, 10 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ── Core Components ──

// IMPORTANT: sort-order MUST come before :id/:vesselId to avoid catch-all
router.post('/components/sort-order', asyncHandler(componentCtrl.updateSortOrder));

// GET /components/:vesselId — list by vessel (Target Picker)
// NOTE: this must be registered BEFORE the generic /components/:id route
// but the generic routes below use a separate base path, so no conflict
router.get('/components/:vesselId', asyncHandler(componentCtrl.listByVessel));

// GET /components/details/:id — single component detail page
router.get('/components/details/:id', asyncHandler(componentCtrl.getDetails));

// POST /components/upload — bulk CSV/XLSX upload
router.post('/components/upload', upload.single('file'), asyncHandler(uploadCtrl.upload));

// GET  /components — list all (optional ?vesselId= filter)
// POST /components — create
// These share the same path but different methods
router.get('/components', asyncHandler(componentCtrl.listAll));
router.post('/components', asyncHandler(componentCtrl.create));

// GET    /components/:id — get by ID
// PATCH  /components/:id — update
// DELETE /components/:id — delete
router.get('/components/:id', asyncHandler(componentCtrl.getById));
router.patch('/components/:id', asyncHandler(componentCtrl.update));
router.delete('/components/:id', asyncHandler(componentCtrl.remove));

// POST /components/:id/inactivate — soft inactivate (preferred over delete)
router.post('/components/:id/inactivate', asyncHandler(componentCtrl.inactivate));

// ── Component Documents ──

router.get('/component-documents/:componentId', requireAuth, asyncHandler(subCtrl.listDocuments));
router.post('/component-documents', requirePMSAdmin, upload.single('file'), asyncHandler(subCtrl.createDocument));
router.put('/component-documents/:id', requirePMSAdmin, asyncHandler(subCtrl.updateDocument));
router.delete('/component-documents/:id', requirePMSAdmin, asyncHandler(subCtrl.deleteDocument));
router.get('/component-documents/:id/download', requireAuth, asyncHandler(subCtrl.downloadDocument));

// ── Component Class Regulatory ──

router.get('/component-class-regulatory/:componentId', requireAuth, asyncHandler(subCtrl.listClassRegulatory));
router.post('/component-class-regulatory', requirePMSAdmin, asyncHandler(subCtrl.createClassRegulatory));
router.put('/component-class-regulatory/:id', requirePMSAdmin, asyncHandler(subCtrl.updateClassRegulatory));
router.delete('/component-class-regulatory/:id', requirePMSAdmin, asyncHandler(subCtrl.deleteClassRegulatory));

// ── Component Requisitions ──

router.get('/component-requisitions/:componentId', requireAuth, asyncHandler(subCtrl.listRequisitions));
router.get('/component-requisitions', requireAuth, asyncHandler(subCtrl.listAllRequisitions));
router.get('/component-requisitions/item/:id', requireAuth, asyncHandler(subCtrl.getRequisition));
router.post('/component-requisitions', requireAuth, asyncHandler(subCtrl.createRequisition));
router.put('/component-requisitions/:id', requireAuth, asyncHandler(subCtrl.updateRequisition));
router.delete('/component-requisitions/:id', requirePMSAdmin, asyncHandler(subCtrl.deleteRequisition));

// ── Component Maintenance History (read-only) ──

router.get('/component-maintenance-history', asyncHandler(subCtrl.listAllMaintenanceHistory));
router.get('/component-maintenance-history/vessel/:vesselId', asyncHandler(subCtrl.listVesselMaintenanceHistory));
router.get('/component-maintenance-history/:componentId', requireAuth, asyncHandler(subCtrl.listMaintenanceHistory));
router.get('/component-maintenance-history/item/:id', requireAuth, asyncHandler(subCtrl.getMaintenanceHistoryItem));

// ── Equipment Categories ──

router.get('/equipment-categories', asyncHandler(subCtrl.listEquipmentCategories));
router.post('/equipment-categories', asyncHandler(subCtrl.createEquipmentCategory));
router.patch('/equipment-categories/:id', asyncHandler(subCtrl.updateEquipmentCategory));
router.delete('/equipment-categories/:id', asyncHandler(subCtrl.deleteEquipmentCategory));

export default router;
