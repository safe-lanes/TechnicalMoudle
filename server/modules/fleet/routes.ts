import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requireOfficeOrAdmin, requireRole } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import * as fleetCtrl from './controllers/fleetController';
import * as adminCtrl from './controllers/fleetAdminController';

// Only Sail Admin can mutate master list types
const requireSailAdmin = requireRole(["Sail Admin"]);

const router = Router();

// ── Permission policy (requirePermission, resource 'admin-masters') ──
// /fleet/* and /fleet-admin/* writes gated by method → create / edit / delete.
// sort-order counts as edit. Bulk/upsert-shaped /fleet-admin POSTs (mappings,
// import-history, import-errors, resync/*, copy-vessel, auto-linkage) use any-of
// [create,edit]. /fleet/master-list-types keeps requireSailAdmin only (NOT gated
// here). /fleet-admin/* keeps requireOfficeOrAdmin (router-level) with
// requirePermission layered after. GETs stay open. Sail/PMS Admin bypass;
// unconfigured roles fail-open (see middleware).

// ══════════════════════════════════════════════════════════
// Fleet Operations Routes (/fleet/*)
// No auth middleware — same as original
// ══════════════════════════════════════════════════════════

// ── Fleet Components ──
// IMPORTANT: sort-order MUST come before :id to avoid catch-all
router.post('/fleet/components/sort-order', requirePermission('admin-masters', 'edit'), asyncHandler(fleetCtrl.updateComponentSortOrder));
router.get('/fleet/components', asyncHandler(fleetCtrl.getFleetScopedComponents));
router.get('/fleet/components/:id', asyncHandler(fleetCtrl.getFleetScopedComponent));
router.post('/fleet/components', requirePermission('admin-masters', 'create'), asyncHandler(fleetCtrl.createFleetScopedComponent));
router.patch('/fleet/components/:id', requirePermission('admin-masters', 'edit'), asyncHandler(fleetCtrl.updateFleetScopedComponent));
// DELETE /fleet/components/:id REMOVED (Audit Phase 4 cleanup): it hard-deleted a fleet-scoped
// component row, bypassing retain-and-deactivate. The fleet-admin UI uses the soft-delete
// endpoint (/fleet-admin/fleet-components/:id). This route was orphaned — no UI caller.

// ── Fleet Jobs ──
// IMPORTANT: export MUST come before :id to avoid catch-all
router.get('/fleet/jobs/export', asyncHandler(fleetCtrl.exportFleetJobs));
router.get('/fleet/jobs', asyncHandler(fleetCtrl.getFleetJobs));
router.get('/fleet/jobs/:id', asyncHandler(fleetCtrl.getFleetJob));
router.post('/fleet/jobs', requirePermission('admin-masters', 'create'), asyncHandler(fleetCtrl.createFleetJob));
router.patch('/fleet/jobs/:id', requirePermission('admin-masters', 'edit'), asyncHandler(fleetCtrl.updateFleetJob));
router.delete('/fleet/jobs/:id', requirePermission('admin-masters', 'delete'), asyncHandler(fleetCtrl.deleteFleetJob));

// ── Fleet Spares ──
// IMPORTANT: export MUST come before :id to avoid catch-all
router.get('/fleet/spares/export', asyncHandler(fleetCtrl.exportFleetSpares));
router.get('/fleet/spares', asyncHandler(fleetCtrl.getFleetSpares));
router.get('/fleet/spares/:id', asyncHandler(fleetCtrl.getFleetSpare));
router.post('/fleet/spares', requirePermission('admin-masters', 'create'), asyncHandler(fleetCtrl.createFleetSpare));
router.patch('/fleet/spares/:id', requirePermission('admin-masters', 'edit'), asyncHandler(fleetCtrl.updateFleetSpare));
router.delete('/fleet/spares/:id', requirePermission('admin-masters', 'delete'), asyncHandler(fleetCtrl.deleteFleetSpare));

// ── Makers ──
router.get('/fleet/makers', asyncHandler(fleetCtrl.getMakers));
router.get('/fleet/makers/:id', asyncHandler(fleetCtrl.getMakerById));
router.post('/fleet/makers', requirePermission('admin-masters', 'create'), asyncHandler(fleetCtrl.createMaker));
router.put('/fleet/makers/:id', requirePermission('admin-masters', 'edit'), asyncHandler(fleetCtrl.updateMaker));
router.delete('/fleet/makers/:id', requirePermission('admin-masters', 'delete'), asyncHandler(fleetCtrl.deleteMaker));

// ── Master Lists ──
router.get('/fleet/master-lists', asyncHandler(fleetCtrl.getMasterLists));
router.get('/fleet/master-lists/:id', asyncHandler(fleetCtrl.getMasterListById));
router.post('/fleet/master-lists', requirePermission('admin-masters', 'create'), asyncHandler(fleetCtrl.createMasterList));
router.put('/fleet/master-lists/:id', requirePermission('admin-masters', 'edit'), asyncHandler(fleetCtrl.updateMasterList));
router.delete('/fleet/master-lists/:id', requirePermission('admin-masters', 'delete'), asyncHandler(fleetCtrl.deleteMasterList));

// ── Master List Types (Sail Admin only for mutations) ──
router.get('/fleet/master-list-types', asyncHandler(fleetCtrl.getMasterListTypes));
router.get('/fleet/master-list-types/:id', asyncHandler(fleetCtrl.getMasterListTypeById));
router.post('/fleet/master-list-types', requireSailAdmin, asyncHandler(fleetCtrl.createMasterListType));
router.put('/fleet/master-list-types/:id', requireSailAdmin, asyncHandler(fleetCtrl.updateMasterListType));
router.delete('/fleet/master-list-types/:id', requireSailAdmin, asyncHandler(fleetCtrl.deleteMasterListType));

// ── Fleet Vessel Mappings ──
router.get('/fleet/vessel-mappings', asyncHandler(fleetCtrl.getFleetVesselMappings));
router.post('/fleet/vessel-mappings', requirePermission('admin-masters', 'create'), asyncHandler(fleetCtrl.createFleetVesselMappings));
router.delete('/fleet/vessel-mappings/:id', requirePermission('admin-masters', 'delete'), asyncHandler(fleetCtrl.deleteFleetVesselMapping));

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
adminRouter.post('/master-data', requirePermission('admin-masters', 'create'), asyncHandler(adminCtrl.createMasterData));
adminRouter.patch('/master-data/:id', requirePermission('admin-masters', 'edit'), asyncHandler(adminCtrl.updateMasterData));
adminRouter.delete('/master-data/:id', requirePermission('admin-masters', 'delete'), asyncHandler(adminCtrl.deleteMasterData));
adminRouter.get('/generate-fleet-equipment-code/:sfiCode', asyncHandler(adminCtrl.generateFleetEquipmentCode));

// ── Fleet Components Admin ──
// IMPORTANT: export and by-code routes MUST come before :id
adminRouter.get('/fleet-components/export', asyncHandler(adminCtrl.exportFleetComponents));
adminRouter.get('/fleet-components/by-code/:code', asyncHandler(adminCtrl.getFleetComponentByCode));
adminRouter.get('/fleet-components', asyncHandler(adminCtrl.getFleetComponents));
adminRouter.get('/fleet-components/:id', asyncHandler(adminCtrl.getFleetComponentById));
adminRouter.post('/fleet-components', requirePermission('admin-masters', 'create'), asyncHandler(adminCtrl.createFleetComponent));
adminRouter.patch('/fleet-components/:id', requirePermission('admin-masters', 'edit'), asyncHandler(adminCtrl.updateFleetComponent));
adminRouter.delete('/fleet-components/:id', requirePermission('admin-masters', 'delete'), asyncHandler(adminCtrl.deleteFleetComponent));

// ── Fleet-Vessel Mappings ──
adminRouter.get('/fleet-vessel-mappings/by-equipment/:code', asyncHandler(adminCtrl.getFleetVesselMappingsByEquipment));
adminRouter.get('/fleet-vessel-mappings/by-vessel/:vesselCode', asyncHandler(adminCtrl.getFleetVesselMappingsByVessel));
adminRouter.get('/fleet-vessel-mappings', asyncHandler(adminCtrl.getFleetVesselMappings));
adminRouter.post('/fleet-vessel-mappings', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(adminCtrl.createFleetVesselMapping));
adminRouter.delete('/fleet-vessel-mappings/:id', requirePermission('admin-masters', 'delete'), asyncHandler(adminCtrl.deleteFleetVesselMapping));

// ── Component-Vessel Mappings ──
adminRouter.get('/component-vessel-mappings', asyncHandler(adminCtrl.getComponentVesselMappings));
adminRouter.post('/component-vessel-mappings/auto-linkage', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(adminCtrl.mapVesselWithAutoLinkage));
adminRouter.post('/component-vessel-mappings', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(adminCtrl.createComponentVesselMapping));
adminRouter.delete('/component-vessel-mappings/:id', requirePermission('admin-masters', 'delete'), asyncHandler(adminCtrl.deleteComponentVesselMapping));

// ── Fleet-Component Mappings ──
adminRouter.get('/fleet-component-mappings/by-equipment/:code', asyncHandler(adminCtrl.getFleetComponentMappingsByEquipment));
adminRouter.get('/fleet-component-mappings/by-vessel/:vesselCode', asyncHandler(adminCtrl.getFleetComponentMappingsByVessel));
adminRouter.get('/fleet-component-mappings', asyncHandler(adminCtrl.getFleetComponentMappings));
adminRouter.post('/fleet-component-mappings', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(adminCtrl.createFleetComponentMapping));
adminRouter.delete('/fleet-component-mappings', requirePermission('admin-masters', 'delete'), asyncHandler(adminCtrl.deleteFleetComponentMapping));

// ── Fleet-Job-Vessel Mappings ──
adminRouter.get('/fleet-job-mappings/by-job/:jobCode', asyncHandler(adminCtrl.getFleetJobMappingsByJob));
adminRouter.get('/fleet-job-mappings/by-vessel/:vesselCode', asyncHandler(adminCtrl.getFleetJobMappingsByVessel));
adminRouter.get('/fleet-job-mappings', asyncHandler(adminCtrl.getFleetJobMappings));
adminRouter.post('/fleet-job-mappings', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(adminCtrl.createFleetJobMapping));
adminRouter.delete('/fleet-job-mappings', requirePermission('admin-masters', 'delete'), asyncHandler(adminCtrl.deleteFleetJobMapping));

// ── Fleet-Spare-Vessel Mappings ──
adminRouter.get('/fleet-spare-mappings/by-spare/:partCode', asyncHandler(adminCtrl.getFleetSpareMappingsBySpare));
adminRouter.get('/fleet-spare-mappings/by-vessel/:vesselCode', asyncHandler(adminCtrl.getFleetSpareMappingsByVessel));
adminRouter.get('/fleet-spare-mappings', asyncHandler(adminCtrl.getFleetSpareMappings));
adminRouter.post('/fleet-spare-mappings', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(adminCtrl.createFleetSpareMapping));
adminRouter.delete('/fleet-spare-mappings', requirePermission('admin-masters', 'delete'), asyncHandler(adminCtrl.deleteFleetSpareMapping));

// ── Bulk Import History & Errors ──
adminRouter.get('/import-history/:id/errors', asyncHandler(adminCtrl.getImportErrors));
adminRouter.get('/import-history/:id', asyncHandler(adminCtrl.getImportHistoryItem));
adminRouter.get('/import-history', asyncHandler(adminCtrl.getImportHistory));
adminRouter.post('/import-history', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(adminCtrl.createImportHistory));
adminRouter.patch('/import-history/:id', requirePermission('admin-masters', 'edit'), asyncHandler(adminCtrl.updateImportHistory));
adminRouter.post('/import-errors', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(adminCtrl.createImportErrors));

// ── Dashboard ──
adminRouter.get('/dashboard-metrics', asyncHandler(adminCtrl.getDashboardMetrics));
adminRouter.get('/dashboard-stats', asyncHandler(adminCtrl.getDashboardStats));

// ── Re-Sync: Fleet → Vessel field sync ──
adminRouter.post('/resync/components', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(adminCtrl.resyncComponents));
adminRouter.post('/resync/jobs', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(adminCtrl.resyncJobs));
adminRouter.post('/resync/spares', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(adminCtrl.resyncSpares));

// ── Copy Vessel ──
adminRouter.post('/copy-vessel', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(adminCtrl.copyVessel));

// Mount admin router under /fleet-admin prefix
router.use('/fleet-admin', adminRouter);

export default router;
