import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as sparesCtrl from './controllers/sparesReportsController';
import * as storesCtrl from './controllers/storesReportsController';
import * as equipCtrl from './controllers/equipmentReportsController';
import * as maintCtrl from './controllers/maintenanceReportsController';
import * as compCtrl from './controllers/complianceReportsController';
import * as opsCtrl from './controllers/operationsReportsController';
import * as snapCtrl from './controllers/snapshotController';
import * as crCtrl from './controllers/changeRequestReportsController';
import * as favCtrl from './controllers/favoritesController';

const router = Router();

// ══════════════════════════════════════════════════════════
// Report Routes
// IMPORTANT: Specific routes MUST come before the generic
// /:reportType catch-all at the bottom
// ══════════════════════════════════════════════════════════

// ── Report Favorites ──
router.get('/reports/favorites', asyncHandler(favCtrl.getFavorites));
router.post('/reports/favorites/:reportId', asyncHandler(favCtrl.addFavorite));
router.delete('/reports/favorites/:reportId', asyncHandler(favCtrl.removeFavorite));

// ── Template Builder (outside /reports prefix) ──
router.get('/template-builder/:templateType', asyncHandler(equipCtrl.getTemplate));

// ── Spares Reports ──
router.get('/reports/critical-spares/preview', asyncHandler(sparesCtrl.getCriticalSparesPreview));
router.post('/reports/critical-spares', asyncHandler(sparesCtrl.exportCriticalSparesExcel));
router.get('/reports/low-stock-alert/:vesselId', asyncHandler(sparesCtrl.getLowStockAlert));
router.patch('/reports/low-stock-alert/:vesselId/mark-ordered/:spareId', asyncHandler(sparesCtrl.markSpareAsOrdered));
router.post('/reports/low-stock-alert/:vesselId/excel', asyncHandler(sparesCtrl.exportLowStockAlertExcel));
router.get('/reports/spares-consumption-analysis/:vesselId/component-names', asyncHandler(sparesCtrl.getSparesComponentNames));
router.get('/reports/spares-consumption-analysis/:vesselId', asyncHandler(sparesCtrl.getSparesConsumptionAnalysis));
router.post('/reports/spares-consumption-analysis/:vesselId/excel', asyncHandler(sparesCtrl.exportSparesConsumptionExcel));

// ── Stores Reports ──
router.post('/reports/stores-inventory-status/:vesselId/excel', asyncHandler(storesCtrl.exportStoresInventoryStatusExcel));
router.get('/reports/stores-consumption-analysis/:vesselId', asyncHandler(storesCtrl.getStoresConsumptionAnalysis));
router.post('/reports/stores-consumption-analysis/:vesselId/excel', asyncHandler(storesCtrl.exportStoresConsumptionExcel));
router.get('/reports/consumption-analysis/:vesselId', asyncHandler(storesCtrl.getCombinedConsumptionAnalysis));
router.post('/reports/consumption-analysis/:vesselId/excel', asyncHandler(storesCtrl.exportCombinedConsumptionExcel));
router.get('/reports/chemicals-expiry/:vesselId', asyncHandler(storesCtrl.getChemicalsExpiry));
router.get('/reports/stores-low-stock-alert/:vesselId', asyncHandler(storesCtrl.getStoresLowStockAlert));
router.post('/reports/stores-low-stock-alert/:vesselId/excel', asyncHandler(storesCtrl.exportStoresLowStockAlertExcel));

// ── Equipment Reports ──
router.get('/reports/critical-equipment-status', asyncHandler(equipCtrl.getCriticalEquipmentStatus));
router.post('/reports/critical-equipment-status/excel', asyncHandler(equipCtrl.exportCriticalEquipmentStatusExcel));
router.get('/reports/unplanned-breakdown-jobs', asyncHandler(equipCtrl.getUnplannedBreakdownJobs));
router.post('/reports/unplanned-breakdown-jobs/excel', asyncHandler(equipCtrl.exportUnplannedBreakdownJobsExcel));
router.get('/reports/critical-components-list', asyncHandler(equipCtrl.getCriticalComponentsList));
router.get('/reports/lsa-ffa-master-list', asyncHandler(equipCtrl.getLsaFfaMasterList));
router.get('/reports/lsa-ffa-maintenance-schedule', asyncHandler(equipCtrl.getLsaFfaMaintenanceSchedule));
router.get('/reports/critical-equipment-schedule', asyncHandler(equipCtrl.getCriticalEquipmentSchedule));
router.get('/reports/class-items-master-list', asyncHandler(equipCtrl.getClassItemsMasterList));

// ── Maintenance Reports ──
router.get('/reports/due-jobs-7-days/preview', asyncHandler(maintCtrl.getDueJobs7DaysPreview));
router.get('/reports/overdue-jobs/preview', asyncHandler(maintCtrl.getOverdueJobsPreview));
router.get('/reports/completed-jobs/preview', asyncHandler(maintCtrl.getCompletedJobsPreview));
router.get('/reports/postponement-log/preview', asyncHandler(maintCtrl.getPostponementLogPreview));
router.post('/reports/due-jobs-7-days', asyncHandler(maintCtrl.exportDueJobs7Days));
router.post('/reports/overdue-jobs', asyncHandler(maintCtrl.exportOverdueJobs));
router.post('/reports/completed-jobs', asyncHandler(maintCtrl.exportCompletedJobs));
router.post('/reports/unplanned-jobs', asyncHandler(maintCtrl.exportUnplannedJobs));
router.post('/reports/postponement-log', asyncHandler(maintCtrl.exportPostponementLog));
router.get('/reports/maintenance/monthly-summary/preview', asyncHandler(maintCtrl.getMonthlySummaryPreview));
router.get('/reports/maintenance/monthly-summary/snapshot-detail', asyncHandler(maintCtrl.getMonthlySummarySnapshotDetail));
router.post('/reports/maintenance/monthly-summary/regenerate', asyncHandler(maintCtrl.regenerateMonthlySummarySnapshots));
router.post('/reports/maintenance/monthly-summary/excel', asyncHandler(maintCtrl.exportMonthlySummary));

// ── Operations Reports ──
router.get('/reports/crew-workload-distribution', asyncHandler(opsCtrl.getCrewWorkloadDistribution));
router.post('/reports/crew-workload-distribution/excel', asyncHandler(opsCtrl.exportCrewWorkloadDistributionExcel));
router.get('/reports/equipment-utilization-summary', asyncHandler(opsCtrl.getEquipmentUtilizationSummary));
router.post('/reports/equipment-utilization-summary/excel', asyncHandler(opsCtrl.exportEquipmentUtilizationSummaryExcel));

// ── Compliance Reports ──
router.get('/reports/running-hours-anomaly-detection', asyncHandler(compCtrl.getRunningHoursAnomalyDetection));
router.post('/reports/running-hours-anomaly-detection/excel', asyncHandler(compCtrl.exportRunningHoursAnomalyDetectionExcel));
router.get('/reports/ihm-inventory-status', asyncHandler(compCtrl.getIhmInventoryStatus));
router.post('/reports/ihm-inventory-status/excel', asyncHandler(compCtrl.exportIhmInventoryStatusExcel));

// ── Change Request Reports ──
router.get('/reports/change-requests-status-tracking', asyncHandler(crCtrl.getChangeRequestsStatusTracking));
router.get('/reports/change-requests-status-tracking/export', asyncHandler(crCtrl.exportChangeRequestsExcel));

// ── Snapshots ──
router.get('/reports/snapshots/:vesselId', asyncHandler(snapCtrl.getSnapshots));
router.get('/reports/snapshots/detail/:snapshotId', asyncHandler(snapCtrl.getSnapshotDetail));

// ── Generic Report Router (MUST be LAST — catch-all) ──
router.get('/reports/:reportType', asyncHandler(snapCtrl.getGenericReport));

export default router;
