import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requireOfficeOrAdmin } from '../../middleware/auth';
import * as fleetCtrl from './controllers/fleetController';
import * as adminCtrl from './controllers/fleetAdminController';

const router = Router();

// ══════════════════════════════════════════════════════════
// Fleet Operations Routes (/fleet/*)
// No auth middleware — same as original
// ══════════════════════════════════════════════════════════

// ── Fleet Components ──
// IMPORTANT: sort-order MUST come before :id to avoid catch-all
router.post('/fleet/components/sort-order', asyncHandler(fleetCtrl.updateComponentSortOrder));
router.get('/fleet/components', asyncHandler(fleetCtrl.getFleetScopedComponents));
router.get('/fleet/components/:id', asyncHandler(fleetCtrl.getFleetScopedComponent));
router.post('/fleet/components', asyncHandler(fleetCtrl.createFleetScopedComponent));
router.patch('/fleet/components/:id', asyncHandler(fleetCtrl.updateFleetScopedComponent));
router.delete('/fleet/components/:id', asyncHandler(fleetCtrl.deleteFleetScopedComponent));

// ── Fleet Jobs ──
// IMPORTANT: export MUST come before :id to avoid catch-all
router.get('/fleet/jobs/export', asyncHandler(fleetCtrl.exportFleetJobs));
router.get('/fleet/jobs', asyncHandler(fleetCtrl.getFleetJobs));
router.get('/fleet/jobs/:id', asyncHandler(fleetCtrl.getFleetJob));
router.post('/fleet/jobs', asyncHandler(fleetCtrl.createFleetJob));
router.patch('/fleet/jobs/:id', asyncHandler(fleetCtrl.updateFleetJob));
router.delete('/fleet/jobs/:id', asyncHandler(fleetCtrl.deleteFleetJob));

// ── Fleet Spares ──
// IMPORTANT: export MUST come before :id to avoid catch-all
router.get('/fleet/spares/export', asyncHandler(fleetCtrl.exportFleetSpares));
router.get('/fleet/spares', asyncHandler(fleetCtrl.getFleetSpares));
router.get('/fleet/spares/:id', asyncHandler(fleetCtrl.getFleetSpare));
router.post('/fleet/spares', asyncHandler(fleetCtrl.createFleetSpare));
router.patch('/fleet/spares/:id', asyncHandler(fleetCtrl.updateFleetSpare));
router.delete('/fleet/spares/:id', asyncHandler(fleetCtrl.deleteFleetSpare));

// ── Makers ──
router.get('/fleet/makers', asyncHandler(fleetCtrl.getMakers));
router.get('/fleet/makers/:id', asyncHandler(fleetCtrl.getMakerById));
router.post('/fleet/makers', asyncHandler(fleetCtrl.createMaker));
router.put('/fleet/makers/:id', asyncHandler(fleetCtrl.updateMaker));
router.delete('/fleet/makers/:id', asyncHandler(fleetCtrl.deleteMaker));

// ── Master Lists ──
router.get('/fleet/master-lists', asyncHandler(fleetCtrl.getMasterLists));
router.get('/fleet/master-lists/:id', asyncHandler(fleetCtrl.getMasterListById));
router.post('/fleet/master-lists', asyncHandler(fleetCtrl.createMasterList));
router.put('/fleet/master-lists/:id', asyncHandler(fleetCtrl.updateMasterList));
router.delete('/fleet/master-lists/:id', asyncHandler(fleetCtrl.deleteMasterList));

// ── Fleet Vessel Mappings ──
router.get('/fleet/vessel-mappings', asyncHandler(fleetCtrl.getFleetVesselMappings));
router.post('/fleet/vessel-mappings', asyncHandler(fleetCtrl.createFleetVesselMappings));
router.delete('/fleet/vessel-mappings/:id', asyncHandler(fleetCtrl.deleteFleetVesselMapping));

// ══════════════════════════════════════════════════════════
// Fleet Admin Routes (/fleet-admin/*)
// All routes require Office/PMS Admin access control
// ══════════════════════════════════════════════════════════

const adminRouter = Router();
adminRouter.use(requireOfficeOrAdmin);

// ── Master Data CRUD ──
// IMPORTANT: by-code and generate routes MUST come before :id
adminRouter.get('/master-data', asyncHandler(adminCtrl.getMasterDataList));
adminRouter.get('/master-data/by-code/:code', asyncHandler(adminCtrl.getMasterDataByCode));
adminRouter.get('/master-data/:id', asyncHandler(adminCtrl.getMasterDataItem));
adminRouter.post('/master-data', asyncHandler(adminCtrl.createMasterData));
adminRouter.patch('/master-data/:id', asyncHandler(adminCtrl.updateMasterData));
adminRouter.delete('/master-data/:id', asyncHandler(adminCtrl.deleteMasterData));
adminRouter.get('/generate-fleet-equipment-code/:sfiCode', asyncHandler(adminCtrl.generateFleetEquipmentCode));

// ── Fleet Components Admin ──
// IMPORTANT: export and by-code routes MUST come before :id
adminRouter.get('/fleet-components/export', asyncHandler(adminCtrl.exportFleetComponents));
adminRouter.get('/fleet-components/by-code/:code', asyncHandler(adminCtrl.getFleetComponentByCode));
adminRouter.get('/fleet-components', asyncHandler(adminCtrl.getFleetComponents));
adminRouter.get('/fleet-components/:id', asyncHandler(adminCtrl.getFleetComponentById));
adminRouter.post('/fleet-components', asyncHandler(adminCtrl.createFleetComponent));
adminRouter.patch('/fleet-components/:id', asyncHandler(adminCtrl.updateFleetComponent));
adminRouter.delete('/fleet-components/:id', asyncHandler(adminCtrl.deleteFleetComponent));

// ── Fleet-Vessel Mappings ──
adminRouter.get('/fleet-vessel-mappings/by-equipment/:code', asyncHandler(adminCtrl.getFleetVesselMappingsByEquipment));
adminRouter.get('/fleet-vessel-mappings/by-vessel/:vesselCode', asyncHandler(adminCtrl.getFleetVesselMappingsByVessel));
adminRouter.get('/fleet-vessel-mappings', asyncHandler(adminCtrl.getFleetVesselMappings));
adminRouter.post('/fleet-vessel-mappings', asyncHandler(adminCtrl.createFleetVesselMapping));
adminRouter.delete('/fleet-vessel-mappings/:id', asyncHandler(adminCtrl.deleteFleetVesselMapping));

// ── Component-Vessel Mappings ──
adminRouter.get('/component-vessel-mappings', asyncHandler(adminCtrl.getComponentVesselMappings));
adminRouter.post('/component-vessel-mappings', asyncHandler(adminCtrl.createComponentVesselMapping));
adminRouter.delete('/component-vessel-mappings/:id', asyncHandler(adminCtrl.deleteComponentVesselMapping));

// ── Fleet-Component Mappings ──
adminRouter.get('/fleet-component-mappings/by-equipment/:code', asyncHandler(adminCtrl.getFleetComponentMappingsByEquipment));
adminRouter.get('/fleet-component-mappings/by-vessel/:vesselCode', asyncHandler(adminCtrl.getFleetComponentMappingsByVessel));
adminRouter.get('/fleet-component-mappings', asyncHandler(adminCtrl.getFleetComponentMappings));
adminRouter.post('/fleet-component-mappings', asyncHandler(adminCtrl.createFleetComponentMapping));
adminRouter.delete('/fleet-component-mappings', asyncHandler(adminCtrl.deleteFleetComponentMapping));

// ── Fleet-Job-Vessel Mappings ──
adminRouter.get('/fleet-job-mappings/by-job/:jobCode', asyncHandler(adminCtrl.getFleetJobMappingsByJob));
adminRouter.get('/fleet-job-mappings/by-vessel/:vesselCode', asyncHandler(adminCtrl.getFleetJobMappingsByVessel));
adminRouter.get('/fleet-job-mappings', asyncHandler(adminCtrl.getFleetJobMappings));
adminRouter.post('/fleet-job-mappings', asyncHandler(adminCtrl.createFleetJobMapping));
adminRouter.delete('/fleet-job-mappings', asyncHandler(adminCtrl.deleteFleetJobMapping));

// ── Fleet-Spare-Vessel Mappings ──
adminRouter.get('/fleet-spare-mappings/by-spare/:partCode', asyncHandler(adminCtrl.getFleetSpareMappingsBySpare));
adminRouter.get('/fleet-spare-mappings/by-vessel/:vesselCode', asyncHandler(adminCtrl.getFleetSpareMappingsByVessel));
adminRouter.get('/fleet-spare-mappings', asyncHandler(adminCtrl.getFleetSpareMappings));
adminRouter.post('/fleet-spare-mappings', asyncHandler(adminCtrl.createFleetSpareMapping));
adminRouter.delete('/fleet-spare-mappings', asyncHandler(adminCtrl.deleteFleetSpareMapping));

// ── Bulk Import History & Errors ──
adminRouter.get('/import-history/:id/errors', asyncHandler(adminCtrl.getImportErrors));
adminRouter.get('/import-history/:id', asyncHandler(adminCtrl.getImportHistoryItem));
adminRouter.get('/import-history', asyncHandler(adminCtrl.getImportHistory));
adminRouter.post('/import-history', asyncHandler(adminCtrl.createImportHistory));
adminRouter.patch('/import-history/:id', asyncHandler(adminCtrl.updateImportHistory));
adminRouter.post('/import-errors', asyncHandler(adminCtrl.createImportErrors));

// ── Dashboard ──
adminRouter.get('/dashboard-metrics', asyncHandler(adminCtrl.getDashboardMetrics));
adminRouter.get('/dashboard-stats', asyncHandler(adminCtrl.getDashboardStats));

// ── Copy Vessel ──
adminRouter.post('/copy-vessel', asyncHandler(adminCtrl.copyVessel));

// Mount admin router under /fleet-admin prefix
router.use('/fleet-admin', adminRouter);

export default router;
