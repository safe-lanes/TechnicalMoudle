import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as fs from "fs";
import * as path from "path";
import moduleRouter from "./modules";
import { mockAuthMiddleware } from "./middleware/auth";
import { ensureMaintenanceHistoryImmutability } from "./initDb";

export async function registerRoutes(app: Express): Promise<Server> {
  // CRITICAL: Ensure immutability trigger exists BEFORE registering routes
  // In PostgreSQL mode, this will fail fast if trigger creation fails
  // In file-storage mode, this will skip trigger setup
  try {
    await ensureMaintenanceHistoryImmutability();
  } catch (error: any) {
    console.error('❌ FATAL: Failed to ensure maintenance history immutability');
    console.error(error);
    console.error('Server cannot start without immutability enforcement for component_maintenance_history table');
    process.exit(1); // Fail fast - do not serve traffic without immutability
  }

  // Apply mock authentication middleware for all API routes during development
  // This populates req.user with an admin user for testing purposes
  app.use('/technical/api', mockAuthMiddleware);
  console.log('🔒 Mock authentication enabled for /technical/api/* routes');

  // Mount modular architecture router (modules extracted from routes.ts go here)
  app.use('/technical/api', moduleRouter);

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

  // Dev-only seed endpoint for recurring defects testing
  if (process.env.NODE_ENV === 'development') {
    // Seed recurring defects test data
    app.post("/dev/seed/recurring-defects", async (req, res) => {
      try {
        // Fetch real vessels from external API
        const EXTERNAL_API_URL = "https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata";
        const domain = req.query.domain || 'rsms';
        let externalVessels: Array<{ vuid: string; vessel: string; imo_number?: string; vessel_type_name?: string }> = [];

        try {
          const apiResponse = await fetch(`${EXTERNAL_API_URL}/vessels?domain=${domain}`, {
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
        const seedIds = [
          // Equipment Group A: Fuel Injection Pump (4)
          'RD-A-001', 'RD-A-002', 'RD-A-003', 'RD-A-004',
          // Equipment Group B: X-Band Radar (3)
          'RD-B-001', 'RD-B-002', 'RD-B-003',
          // Equipment Group C: Lifeboat Davit (2)
          'RD-C-001', 'RD-C-002',
          // Equipment Group D: Steering Gear (3)
          'RD-D-001', 'RD-D-002', 'RD-D-003',
          // Equipment Group E: Hold Ventilation Fan (2)
          'RD-E-001', 'RD-E-002',
          // Single defects
          'RD-F-001'
        ];

        let deleted = 0;
        for (const seedId of seedIds) {
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
          await storage.updateJob(job.id, updates);
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
          const existingHistory = await storage.getMaintenanceHistoryByWorkOrderId(woAny.id);
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
            jobId: parentJob?.id || woAny.jobId || null,
            jobCode: parentJobNo || null,
            workOrderId: woAny.id,
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
  });
  process.on('SIGINT', () => {
    console.log('Cleaning up scheduled tasks...');
    clearInterval(postponementCheckInterval);
  });

  return httpServer;
}

// Helper function to get seed defects data using real vessel names from external API
interface SeedDefect {
  seedId: string;
  vesselName: string;
  vesselId?: string;
  issuedDate: string;
  targetDate: string;
  status: string;
  isCoC: boolean;
  source?: string;
  defectCategory: string;
  defectType: string;
  responsibleRole: string;
  equipment: {
    category: string;
    type: string;
    make: string;
    model: string;
  };
  description: string;
  actionRequested: string;
  dateCompleted?: string;
}

function getSeedDefectsData(vesselNames: string[]): SeedDefect[] {
  // Use provided vessel names from external API (or fallback)
  const vessel1 = vesselNames[0] || 'Vessel 1';
  const vessel2 = vesselNames[1] || 'Vessel 2';
  const vessel3 = vesselNames[2] || 'Vessel 3';
  const vessel4 = vesselNames[3] || 'Vessel 4';
  const vessel5 = vesselNames[4] || 'Vessel 5';

  return [
    // Equipment Group A: Main Engine Fuel Pump - 4 occurrences across 2 vessels (recurring)
    {
      seedId: 'RD-A-001',
      vesselName: vessel1,
      issuedDate: '2025-03-15',
      targetDate: '2025-04-15',
      status: 'closed',
      dateCompleted: '2025-04-10',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Machinery',
      defectType: 'Breakdown',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Fuel Injection Pump',
        make: 'MAN B&W',
        model: 'ME-C 7G80'
      },
      description: 'Fuel injection pump Unit #3 showing reduced pressure output. Fuel delivery fluctuating during high load operations.',
      actionRequested: 'Inspect and overhaul fuel injection pump. Replace worn plungers and delivery valves.'
    },
    {
      seedId: 'RD-A-002',
      vesselName: vessel1,
      issuedDate: '2025-06-20',
      targetDate: '2025-07-20',
      status: 'open',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Machinery',
      defectType: 'Breakdown',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Fuel Injection Pump',
        make: 'MAN B&W',
        model: 'ME-C 7G80'
      },
      description: 'Fuel injection pump Unit #5 exhibiting similar symptoms to previous Unit #3 failure. Suspect systemic fuel quality issue.',
      actionRequested: 'Overhaul pump unit. Conduct fuel quality analysis. Review bunkering procedures.'
    },
    {
      seedId: 'RD-A-003',
      vesselName: vessel2,
      issuedDate: '2025-04-01',
      targetDate: '2025-05-01',
      status: 'closed',
      dateCompleted: '2025-04-28',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Machinery',
      defectType: 'Breakdown',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Fuel Injection Pump',
        make: 'MAN B&W',
        model: 'ME-C 7G80'
      },
      description: 'Fuel pump delivery valve stuck. Engine performance degraded at full ahead.',
      actionRequested: 'Replace delivery valve and inspect related components.'
    },
    {
      seedId: 'RD-A-004',
      vesselName: vessel2,
      issuedDate: '2025-09-10',
      targetDate: '2025-10-10',
      status: 'open',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Machinery',
      defectType: 'Breakdown',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Fuel Injection Pump',
        make: 'MAN B&W',
        model: 'ME-C 7G80'
      },
      description: 'Multiple fuel pump units showing wear. Class surveyor raised CoC for engine reliability concerns.',
      actionRequested: 'Complete overhaul of all fuel injection pump units. Submit repair plan to Class.'
    },

    // Equipment Group B: Navigation Radar - 3 occurrences across 3 vessels (recurring)
    {
      seedId: 'RD-B-001',
      vesselName: vessel1,
      issuedDate: '2025-02-10',
      targetDate: '2025-03-10',
      status: 'closed',
      dateCompleted: '2025-03-05',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Navigation',
      defectType: 'Equipment Failure',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Navigation',
        type: 'X-Band Radar',
        make: 'Furuno',
        model: 'FAR-2228'
      },
      description: 'Radar display flickering intermittently. Target tracking unreliable in heavy weather.',
      actionRequested: 'Service technician to inspect display unit and antenna motor assembly.'
    },
    {
      seedId: 'RD-B-002',
      vesselName: vessel3,
      issuedDate: '2025-05-15',
      targetDate: '2025-06-15',
      status: 'open',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Navigation',
      defectType: 'Equipment Failure',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Navigation',
        type: 'X-Band Radar',
        make: 'Furuno',
        model: 'FAR-2228'
      },
      description: 'Radar bearing accuracy degraded. ARPA tracking showing errors in target courses.',
      actionRequested: 'Calibrate radar. Replace gyro interface if necessary.'
    },
    {
      seedId: 'RD-B-003',
      vesselName: vessel2,
      issuedDate: '2025-08-20',
      targetDate: '2025-09-20',
      status: 'open',
      isCoC: true,
      source: 'PSC',
      defectCategory: 'Navigation',
      defectType: 'Equipment Failure',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Navigation',
        type: 'X-Band Radar',
        make: 'Furuno',
        model: 'FAR-2228'
      },
      description: 'PSC detention due to radar malfunction. Complete failure of X-Band radar during port state inspection.',
      actionRequested: 'Urgent repair required. Replace main processing unit and conduct sea trials.'
    },

    // Equipment Group C: Lifeboat Davit - 2 occurrences (minimum recurring)
    {
      seedId: 'RD-C-001',
      vesselName: vessel1,
      issuedDate: '2025-01-20',
      targetDate: '2025-02-20',
      status: 'closed',
      dateCompleted: '2025-02-15',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Deck',
      defectType: 'Safety Equipment',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Deck',
        type: 'Lifeboat Davit',
        make: 'Norsafe',
        model: 'LBD-500'
      },
      description: 'Lifeboat davit wire showing corrosion. Brake test failed during annual survey.',
      actionRequested: 'Replace davit wire and overhaul brake mechanism. Re-survey by Class.'
    },
    {
      seedId: 'RD-C-002',
      vesselName: vessel2,
      issuedDate: '2025-07-05',
      targetDate: '2025-08-05',
      status: 'open',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Deck',
      defectType: 'Safety Equipment',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Deck',
        type: 'Lifeboat Davit',
        make: 'Norsafe',
        model: 'LBD-500'
      },
      description: 'Similar davit wire corrosion identified during routine inspection. Potential fleet-wide issue.',
      actionRequested: 'Full inspection of davit system. Coordinate with fleet for common maintenance schedule.'
    },

    // Equipment Group D: Steering Gear - 3 occurrences (recurring with CoC)
    {
      seedId: 'RD-D-001',
      vesselName: vessel3,
      issuedDate: '2025-03-01',
      targetDate: '2025-04-01',
      status: 'closed',
      dateCompleted: '2025-03-28',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Machinery',
      defectType: 'Critical System',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Steering Gear',
        make: 'Rolls-Royce',
        model: 'Aquamaster US-255'
      },
      description: 'Steering gear hydraulic leak detected. Emergency steering tested satisfactory.',
      actionRequested: 'Repair hydraulic seals. Conduct steering trials before departure.'
    },
    {
      seedId: 'RD-D-002',
      vesselName: vessel1,
      issuedDate: '2025-06-15',
      targetDate: '2025-07-15',
      status: 'open',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Machinery',
      defectType: 'Critical System',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Steering Gear',
        make: 'Rolls-Royce',
        model: 'Aquamaster US-255'
      },
      description: 'Steering gear slow response. Hydraulic pump showing signs of wear.',
      actionRequested: 'Overhaul hydraulic pump. Replace worn seals and bearings.'
    },
    {
      seedId: 'RD-D-003',
      vesselName: vessel2,
      issuedDate: '2025-10-01',
      targetDate: '2025-11-01',
      status: 'open',
      isCoC: true,
      source: 'Ship',
      defectCategory: 'Machinery',
      defectType: 'Critical System',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Steering Gear',
        make: 'Rolls-Royce',
        model: 'Aquamaster US-255'
      },
      description: 'Fleet-wide steering gear issue. Third vessel reporting similar hydraulic problems.',
      actionRequested: 'Urgent fleet-wide inspection. Manufacturer to review design tolerances.'
    },

    // Equipment Group E: Cargo Hold Ventilation - 2 occurrences
    {
      seedId: 'RD-E-001',
      vesselName: vessel3,
      issuedDate: '2025-04-10',
      targetDate: '2025-05-10',
      status: 'closed',
      dateCompleted: '2025-05-08',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Cargo',
      defectType: 'Ventilation',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Cargo',
        type: 'Hold Ventilation Fan',
        make: 'Kongsberg',
        model: 'KV-3000'
      },
      description: 'Cargo hold #2 ventilation fan motor overheating. Reduced airflow affecting cargo condition.',
      actionRequested: 'Replace fan motor bearings. Check electrical supply and motor windings.'
    },
    {
      seedId: 'RD-E-002',
      vesselName: vessel1,
      issuedDate: '2025-08-25',
      targetDate: '2025-09-25',
      status: 'open',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Cargo',
      defectType: 'Ventilation',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Cargo',
        type: 'Hold Ventilation Fan',
        make: 'Kongsberg',
        model: 'KV-3000'
      },
      description: 'Same ventilation fan model failing on another vessel. Suspect manufacturing defect.',
      actionRequested: 'Full inspection of all hold ventilation fans fleet-wide.'
    },

    // Single defects (not recurring - for variety)
    {
      seedId: 'RD-F-001',
      vesselName: vessel3,
      issuedDate: '2025-09-01',
      targetDate: '2025-10-01',
      status: 'open',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Electrical',
      defectType: 'Lighting',
      responsibleRole: '2nd Engineer',
      equipment: {
        category: 'Electrical',
        type: 'Navigation Light',
        make: 'Glamox',
        model: 'NL-200'
      },
      description: 'Port side navigation light flickering. LED driver unit suspected faulty.',
      actionRequested: 'Replace LED driver unit. Test light operation during night watches.'
    }
  ];
}
