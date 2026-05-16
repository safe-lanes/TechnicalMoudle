import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as fs from "fs";
import * as path from "path";
import moduleRouter from "./modules";
import { mockAuthMiddleware, initMockAuthRankId } from "./middleware/auth";
import { requestContextMiddleware } from "./middleware/requestContext";
import { ensureMaintenanceHistoryImmutability, ensureCertApplicabilityIndex } from "./initDb";
import { getSeedDefectsData, ALL_SEED_IDS } from "./modules/defects/services/seedData";

export async function registerRoutes(app: Express): Promise<Server> {
  // CRITICAL: Ensure immutability trigger exists BEFORE registering routes
  // In PostgreSQL mode, this will fail fast if trigger creation fails
  // Ensures immutability trigger exists (skips if DB unavailable)
  try {
    await ensureMaintenanceHistoryImmutability();
  } catch (error: any) {
    console.error('❌ FATAL: Failed to ensure maintenance history immutability');
    console.error(error);
    console.error('Server cannot start without immutability enforcement for component_maintenance_history table');
    process.exit(1); // Fail fast - do not serve traffic without immutability
  }

  try {
    await ensureCertApplicabilityIndex();
  } catch (error: any) {
    console.error('❌ FATAL: Failed to ensure cert applicability unique index');
    console.error(error);
    console.error('Server cannot start without uniq_vessel_certificate_applicability_live — Admin → Ship Certificates writes would 500.');
    process.exit(1);
  }

  // Apply mock authentication middleware for all API routes during development
  // This populates req.user with an admin user for testing purposes
  await initMockAuthRankId();
  app.use('/technical/api', mockAuthMiddleware);
  app.use('/technical/api', requestContextMiddleware);
  console.log('🔒 Mock authentication enabled for /technical/api/* routes');

  // Mount modular architecture router (modules extracted from routes.ts go here)
  app.use('/technical/api', moduleRouter);

  const ALLOWED_EXTERNAL_ENDPOINTS = [
    'nationalities', 'vessels', 'vesseltypes', 'licenses',
    'additionalgroups', 'ports', 'languages', 'fleetgroups',
    'countries', 'manningagents', 'crewpools', 'appraisaltypes', 'users'
  ];

  app.get('/technical/api/external/master-data/:endpoint', async (req, res) => {
    const { endpoint } = req.params;
    if (!ALLOWED_EXTERNAL_ENDPOINTS.includes(endpoint.toLowerCase())) {
      return res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });
    }

    const domain = req.query.domain as string;
    if (!domain || domain.trim().length === 0) {
      return res.status(400).json({ error: 'Missing required "domain" query parameter.' });
    }

    try {
      const { buildExternalMasterDataUrl } = await import('./config/externalApi');
      const url = buildExternalMasterDataUrl(endpoint, domain);
      const apiResponse = await fetch(url, {
        method: 'GET',
        headers: { 'accept': '*/*' },
      });

      if (!apiResponse.ok) {
        return res.status(apiResponse.status).json({
          error: `External API returned ${apiResponse.status}`,
        });
      }

      const data = await apiResponse.json();
      return res.json(data);
    } catch (error: any) {
      console.error(`[ExternalProxy] Failed to fetch ${endpoint}:`, error.message);
      return res.status(502).json({ error: 'Failed to fetch from external API' });
    }
  });

  // Documentation download endpoint (outside /technical/api prefix)
  app.get("/download/docs/:filename", (req, res) => {
    const filename = req.params.filename;
    const allowedFiles = ['STORAGE_ANALYSIS.md', 'LOCAL_DEVELOPMENT_SETUP.md'];
    if (!allowedFiles.includes(filename)) {
      return res.status(404).json({ error: "File not found" });
    }
    const filePath = path.resolve(process.cwd(), filename);
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/markdown');
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // Start Job Due Scanner - scans jobs and auto-generates work orders when due
  const { jobDueScanner } = await import("./services/jobDueScanner");
  jobDueScanner.start(1 * 60 * 1000); // Run every 1 minute
  console.log('[JobDueScanner] Scheduler started - will auto-generate work orders for due jobs');

  // Start Work Order Status Recalculator - recalculates and persists work order statuses
  // Runs every minute so grace period setting changes are reflected automatically
  const { workOrderStatusRecalculator } = await import("./services/workOrderStatusRecalculator");
  workOrderStatusRecalculator.start(1 * 60 * 1000); // Run every 1 minute
  console.log('[StatusRecalculator] Scheduler started - will recalculate work order statuses based on current settings');

  // Start PMS Alert Engine - evaluates alert policies and creates alert events
  const { pmsAlertEngine } = await import("./modules/alerts/services/pmsAlertEngine");
  pmsAlertEngine.start(5 * 60 * 1000); // Run every 5 minutes
  console.log('[PmsAlertEngine] Alert scanner started - will evaluate overdue jobs, low spares, skipped cycles');

  // Start Sync Pruning Scheduler - cleans up old sync data every 24 hours
  const { syncPruningScheduler } = await import("./modules/sync/pruningService");
  syncPruningScheduler.start(24 * 60 * 60 * 1000); // Run every 24 hours
  console.log('[SyncPruning] Scheduler started - will prune old sync logs, batches, file queue, conflicts');

  // Start Sync Health Monitor - checks sync health every 6 hours
  const { syncHealthScheduler } = await import("./modules/sync/healthMonitor");
  syncHealthScheduler.start(6 * 60 * 60 * 1000); // Run every 6 hours
  console.log('[SyncHealth] Health monitor started - will check stale syncs, conflicts, stuck files, log overflow');

  // Start Auto-Sync Scheduler - autonomous ship-shore sync (GAP 1 + GAP 4)
  // Ship-only: sync is always ship-initiated. Shore is the responder.
  const { isShipInstance } = await import("./modules/sync/syncRole");
  const { syncAutoScheduler } = await import("./modules/sync/autoSyncScheduler");
  if (await isShipInstance()) {
    syncAutoScheduler.start(6 * 60 * 60 * 1000); // 6-hour tick cadence (overridable via sync_interval_minutes setting)
    console.log('[AutoSync] Ship instance — scheduler started (autonomous sync with catch-up and connectivity logging)');
  } else {
    console.log('[AutoSync] Shore instance detected — auto-sync scheduler not started (sync is ship-initiated)');
  }

  // Dev-only seed endpoint for recurring defects testing
  if (process.env.NODE_ENV === 'development') {
    // Seed recurring defects test data
    app.post("/dev/seed/recurring-defects", async (req, res) => {
      try {
        const { buildExternalMasterDataUrl } = await import('./config/externalApi');
        const domain = (req.query.domain as string) || '';
        let externalVessels: Array<{ vuid: string; vessel: string; imo_number?: string; vessel_type_name?: string }> = [];

        try {
          const apiResponse = await fetch(buildExternalMasterDataUrl('vessels', domain), {
            method: 'GET',
            headers: { 'accept': '*/*' }
          });
          if (apiResponse.ok) {
            const apiData = await apiResponse.json();
            externalVessels = apiData.vessels || [];
          }
        } catch (apiError) {
          console.log("Could not fetch external vessels, using fallback names");
        }

        // Get vessel names from external API, or use fallback if API unavailable
        const vesselNames = externalVessels.length > 0
          ? externalVessels.slice(0, 5).map(v => v.vessel)
          : ['Vessel 1', 'Vessel 2', 'Vessel 3', 'Vessel 4', 'Vessel 5'];

        const seedData = getSeedDefectsData(vesselNames);
        let created = 0;
        let updated = 0;

        for (const seedDefect of seedData) {
          // For external vessels, use vuid as vesselId; don't create local vessels
          let vesselId = seedDefect.vesselId || seedDefect.vesselName.replace(/[^A-Za-z0-9]/g, '').toLowerCase();

          // Convert dates from YYYY-MM-DD to DD-MM-YYYY for storage
          const convertDate = (dateStr: string) => {
            const [year, month, day] = dateStr.split('-');
            return `${day}-${month}-${year}`;
          };

          // Map seed data to our defect schema
          const defectData: any = {
            vesselId,
            vesselName: seedDefect.vesselName,
            issueDate: convertDate(seedDefect.issuedDate),
            targetCloseDate: convertDate(seedDefect.targetDate),
            status: seedDefect.status === 'open' ? 'Open' : 'Closed',
            is_coc: seedDefect.isCoC,
            source: seedDefect.source || 'Ship',
            category: 'Defect',
            defectCategory: seedDefect.defectCategory,
            defectType: seedDefect.defectType,
            responsibleRole: seedDefect.responsibleRole,
            equipmentCategory: seedDefect.equipment.category,
            equipmentType: seedDefect.equipment.type,
            equipmentMake: seedDefect.equipment.make,
            equipmentModel: seedDefect.equipment.model,
            description: seedDefect.description,
            actionTakenRequested: seedDefect.actionRequested,
            seedId: seedDefect.seedId,
            // Defaults
            priority: 'Medium',
            severity: 2,
            critical: false,
            occurrenceType: 'Routine',
            operatingCondition: 'Sailing',
            reportedBy: 'System',
          };

          // Add dateCompleted for closed defects
          if (seedDefect.status === 'closed' && seedDefect.dateCompleted) {
            defectData.dateCompleted = convertDate(seedDefect.dateCompleted);
          }

          // Check if defect with this seedId exists
          const existing = await storage.getDefectBySeedId(seedDefect.seedId);
          if (existing) {
            await storage.updateDefect(existing.id, defectData);
            updated++;
          } else {
            await storage.createDefect(defectData);
            created++;
          }
        }

        res.json({
          message: "Seed data loaded successfully",
          created,
          updated,
          total: seedData.length
        });
      } catch (error: any) {
        console.error("Seed error:", error);
        res.status(500).json({ error: "Failed to seed data", details: error.message });
      }
    });

    // Delete seeded defects
    app.delete("/dev/seed/recurring-defects", async (req, res) => {
      try {
        let deleted = 0;
        for (const seedId of ALL_SEED_IDS) {
          const defect = await storage.getDefectBySeedId(seedId);
          if (defect) {
            await storage.deleteDefect(defect.id);
            deleted++;
          }
        }

        res.json({
          message: "Seed data deleted successfully",
          deleted
        });
      } catch (error: any) {
        console.error("Delete seed error:", error);
        res.status(500).json({ error: "Failed to delete seed data", details: error.message });
      }
    });
  }

  const httpServer = createServer(app);

  // Recalculate recurring defects on startup (don't await - let it run in background)
  storage.recalculateAllRecurringDefects().then(() => {
    console.log('✅ Recurring defects recalculated successfully');
  }).catch(err => {
    console.error('⚠️ Error recalculating recurring defects:', err);
  });

  // STARTUP BACKFILL: Recalculate nextDueDate/nextDueRH for jobs missing these values
  // Per documentation: Calendar jobs need nextDueDate = lastDoneDate + frequencyValue + frequencyUnit
  //                   RH jobs need nextDueRH = lastDoneRH + intervalRunningHour
  // NOTE: Only use intervalRunningHour for RH jobs, never fall back to frequencyValue (per schema)
  (async () => {
    try {
      const { calculateNextDueDate, normalizeDateToDDMMMYYYY } = await import("@shared/dateUtils");
      const allJobs = await storage.getJobs();
      let updatedCalendar = 0;
      let updatedRH = 0;

      for (const job of allJobs) {
        let updates: any = {};
        let needsUpdate = false;

        // Calendar-based jobs: Calculate nextDueDate if missing
        if (job.maintenanceBasis === 'Calendar' && !job.nextDueDate) {
          const rawLastDone = job.lastDoneDate;
          if (rawLastDone && job.frequencyValue && job.frequencyUnit) {
            // Normalize date before calculation
            const lastDone = normalizeDateToDDMMMYYYY(rawLastDone);
            if (lastDone) {
              const calculatedNextDue = calculateNextDueDate(lastDone, job.frequencyValue, job.frequencyUnit);
              if (calculatedNextDue) {
                updates.nextDueDate = calculatedNextDue;
                needsUpdate = true;
                updatedCalendar++;
              }
            }
          }
        }

        // Running Hours-based jobs: Calculate nextDueRH if missing
        // Only use intervalRunningHour, not frequencyValue
        // VALIDATION: interval must be a valid number > 0
        if (job.maintenanceBasis === 'Running Hours' && !job.nextDueRH) {
          const lastDoneRH = job.lastDoneRH;
          const intervalRH = Number(job.intervalRunningHour);
          if (lastDoneRH && !isNaN(intervalRH) && intervalRH > 0) {
            const lastRH = Number(lastDoneRH);
            if (!isNaN(lastRH)) {
              updates.nextDueRH = String(lastRH + intervalRH);
              needsUpdate = true;
              updatedRH++;
            }
          }
        }

        // Apply updates if needed
        if (needsUpdate) {
          await storage.updateJob(job.juuid, updates);
        }
      }

      if (updatedCalendar > 0 || updatedRH > 0) {
        console.log(`✅ Job backfill complete: ${updatedCalendar} Calendar jobs (nextDueDate), ${updatedRH} RH jobs (nextDueRH)`);
      } else {
        console.log('✅ Job backfill check complete - all jobs already have due dates/RH calculated');
      }
    } catch (err) {
      console.error('⚠️ Error during job nextDueDate/nextDueRH backfill:', err);
    }
  })();

  // STARTUP REMEDIATION: Derive component-specific tracking from ACTUAL maintenance history
  // This uses maintenance history as the source of truth for each component's completion dates
  (async () => {
    try {
      const { calculateNextDueDate, normalizeDateToDDMMMYYYY } = await import("@shared/dateUtils");

      // Get all job-component links
      const allLinks = await storage.getAllJobComponentLinks();
      let updatedCount = 0;

      for (const link of allLinks) {
        // Get the LATEST maintenance history record for this job+component pair
        const maintenanceHistory = await storage.getMaintenanceHistoryByJobAndComponent(
          link.jobId,
          link.componentCode
        );

        if (!maintenanceHistory || maintenanceHistory.length === 0) {
          continue; // No maintenance history for this job-component pair
        }

        // Get the most recent record (sorted by date_completed DESC)
        const latestRecord = maintenanceHistory[0];

        // Check if the link's tracking data matches the latest maintenance history
        const historyDate = latestRecord.dateCompleted;
        const historyRH = latestRecord.runningHoursAtCompletion;

        // Get the job to determine frequency for next due calculation
        const job = await storage.getJob(link.jobId);
        if (!job) continue;

        // Build update if different from current link data
        const updates: any = {};
        let needsUpdate = false;

        if (historyDate && link.lastDoneDate !== historyDate) {
          updates.lastDoneDate = historyDate;
          needsUpdate = true;

          // Calculate nextDueDate if calendar-based
          if (job.maintenanceBasis === 'Calendar' && job.frequencyValue && job.frequencyUnit) {
            const normalizedDate = normalizeDateToDDMMMYYYY(historyDate);
            if (normalizedDate) {
              const nextDue = calculateNextDueDate(normalizedDate, job.frequencyValue, job.frequencyUnit);
              if (nextDue) {
                updates.nextDueDate = nextDue;
              }
            }
          }
        }

        if (historyRH && link.lastDoneRH !== historyRH) {
          updates.lastDoneRH = historyRH;
          needsUpdate = true;

          // Calculate nextDueRH if RH-based
          if (job.maintenanceBasis === 'Running Hours' && job.intervalRunningHour) {
            const lastRH = parseFloat(historyRH);
            const intervalRH = parseFloat(job.intervalRunningHour);
            if (!isNaN(lastRH) && !isNaN(intervalRH) && intervalRH > 0) {
              updates.nextDueRH = String(lastRH + intervalRH);
            }
          }
        }

        if (needsUpdate && link.vesselId) {
          updates.updatedAt = new Date();
          // VESSEL ISOLATION: Pass vesselId to ensure updates are vessel-scoped
          await storage.updateJobComponentLinkTracking(link.vesselId, link.jobId, link.componentId, updates);
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        console.log(`✅ Remediated ${updatedCount} job-component links with component-specific tracking from maintenance history`);
      } else {
        console.log('✅ Component-specific tracking check complete - all data matches maintenance history');
      }
    } catch (err) {
      console.error('⚠️ Error during component-specific tracking remediation:', err);
    }
  })();

  // STARTUP BACKFILL: Create missing maintenance history records for completed work orders
  // This handles work orders that were completed before the auto-population feature was added
  (async () => {
    try {
      // Get all completed work orders
      const allVessels = await storage.getVessels();
      let backfilledCount = 0;
      let skippedCount = 0;

      for (const vessel of allVessels) {
        const workOrders = await storage.getWorkOrders(vessel.id);
        const completedWOs = workOrders.filter((wo: any) => wo.status === 'Completed');

        for (const wo of completedWOs) {
          const woAny = wo as any;
          // Check if maintenance history already exists for this work order
          const existingHistory = await storage.getMaintenanceHistoryByWorkOrderId(woAny.wouuid);
          if (existingHistory) {
            skippedCount++;
            continue;
          }

          // Find the component for this work order
          if (!woAny.dateCompleted) continue;
          if (!woAny.componentCode) continue;
          const component = await storage.getComponentByCode(woAny.componentCode, woAny.vesselId);
          if (!component) continue;

          // Find the parent job
          let parentJob = null;
          let parentJobNo: string | null = null;

          if (woAny.jobId) {
            parentJob = await storage.getJob(woAny.jobId);
            if (parentJob) parentJobNo = parentJob.jobNo;
          }

          if (!parentJobNo && woAny.workOrderNo) {
            const woNumber = woAny.workOrderNo;
            const newFormatMatch = woNumber.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
            if (newFormatMatch) parentJobNo = newFormatMatch[1];
            if (!parentJobNo) {
              const oldFormatMatch = woNumber.match(/^(.+)-\d{4}-\d+$/);
              if (oldFormatMatch) parentJobNo = oldFormatMatch[1];
            }
            if (parentJobNo && !parentJob) {
              const allJobs = await storage.getJobsByVessel(woAny.vesselId);
              parentJob = allJobs.find((j: any) => j.jobNo === parentJobNo) || null;
            }
          }

          // Normalize date
          const normalizeToISO = (isoDate: string | undefined): string => {
            if (!isoDate) return new Date().toISOString().split('T')[0];
            const date = new Date(isoDate);
            return date.toISOString().split('T')[0];
          };

          const historyPayload = {
            componentId: component.cuuid,
            componentCode: woAny.componentCode || component.componentCode,
            vesselCode: woAny.vesselId,
            jobId: parentJob?.juuid || parentJob?.id || null,
            jobCode: parentJobNo || null,
            workOrderId: woAny.wouuid,
            workOrderNo: woAny.templateCode || woAny.workOrderNo || `WO-${woAny.id}`,
            jobTitle: woAny.jobTitle,
            maintenanceType: woAny.taskType || 'Servicing',
            dateCompleted: normalizeToISO(woAny.dateCompleted),
            runningHoursAtCompletion: woAny.runningHoursAtCompletion?.toString() || null,
            performedBy: woAny.performedBy || 'Unknown',
            approvedBy: woAny.approvedBy || null,
            approvalDate: woAny.approvalDate ? normalizeToISO(woAny.approvalDate) : null,
            status: 'Approved' as const,
            workDescription: woAny.briefWorkDescription || null,
            sparesUsed: null,
            remarks: woAny.remarks || null,
            isComponentReplaced: false
          };

          await storage.createComponentMaintenanceHistory(historyPayload);
          backfilledCount++;
        }
      }

      if (backfilledCount > 0) {
        console.log(`✅ Maintenance history backfill complete: ${backfilledCount} records created, ${skippedCount} already existed`);
      } else {
        console.log(`✅ Maintenance history backfill check complete - all ${skippedCount} completed work orders already have history records`);
      }
    } catch (err) {
      console.error('⚠️ Error during maintenance history backfill:', err);
    }
  })();

  // Check and revert expired postponed work orders on startup
  (async () => {
    try {
      const result = await storage.checkAndRevertPostponedWorkOrders();
      if (result.revertedCount > 0) {
        console.log(`✅ Reverted ${result.revertedCount} expired postponed work orders to Due status`);
        result.revertedWorkOrders.forEach(wo => {
          console.log(`   - WO ${wo.workOrderNo} (${wo.jobTitle})`);
        });
      } else {
        console.log('✅ No expired postponed work orders to revert');
      }
    } catch (err) {
      console.error('⚠️ Error checking postponed work orders on startup:', err);
    }
  })();

  // Set up hourly check for expired postponed work orders
  const POSTPONEMENT_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  const postponementCheckInterval = setInterval(async () => {
    try {
      const result = await storage.checkAndRevertPostponedWorkOrders();
      if (result.revertedCount > 0) {
        console.log(`[Scheduled] Reverted ${result.revertedCount} expired postponed work orders`);
      }
    } catch (err) {
      console.error('[Scheduled] Error checking postponed work orders:', err);
    }
  }, POSTPONEMENT_CHECK_INTERVAL_MS);
  console.log(`📅 Scheduled hourly check for expired postponed work orders`);

  // Cleanup on server shutdown
  process.on('SIGTERM', () => {
    console.log('Cleaning up scheduled tasks...');
    clearInterval(postponementCheckInterval);
    syncPruningScheduler.stop();
    syncHealthScheduler.stop();
    syncAutoScheduler.stop();
  });
  process.on('SIGINT', () => {
    console.log('Cleaning up scheduled tasks...');
    clearInterval(postponementCheckInterval);
    syncPruningScheduler.stop();
    syncHealthScheduler.stop();
    syncAutoScheduler.stop();
  });

  return httpServer;
}
