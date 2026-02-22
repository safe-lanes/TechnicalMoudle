import { Request, Response } from 'express';
import { storage } from '../../../storage';
import { getPool } from '../../../db';
import { computeWorkOrderStatus } from '@shared/workOrders/status';
import { WORK_ORDER_THRESHOLDS } from '@shared/workOrders/constants';

// ── GET/POST /admin/job-due-scan ──

export async function jobDueScan(req: Request, res: Response) {
  const { jobDueScanner } = await import('../../../services/jobDueScanner');

  const vesselId = req.body?.vesselId;
  console.log(`🔍 Manual job due scan triggered${vesselId ? ` for vessel: ${vesselId}` : ' for ALL vessels'}`);

  const results = await jobDueScanner.runScan();
  console.log('✅ Manual job due scan completed:', results);

  res.json({
    success: true,
    scanCompleted: true,
    message: 'Job due scan completed',
    results: {
      calendarJobsChecked: results.calendarJobsChecked,
      calendarWOsGenerated: results.calendarWOsGenerated,
      rhJobsChecked: results.rhJobsChecked,
      rhWOsGenerated: results.rhWOsGenerated,
      totalGenerated: results.calendarWOsGenerated + results.rhWOsGenerated
    }
  });
}

// ── POST /admin/purge-jobs ──

export async function purgeJobs(req: Request, res: Response) {
  const { vesselId } = req.body;

  console.log(`🧹 Admin purge request received${vesselId ? ` for vessel: ${vesselId}` : ' for ALL vessels'}`);

  const result = await storage.purgeJobsAndLinkedData(vesselId);

  console.log('✅ Purge operation completed:', {
    ...result,
    totalRecordsAffected:
      result.deletedWorkOrderExecutions +
      result.deletedWorkOrders +
      result.deletedJobs +
      result.deletedRunningHoursAudits
  });

  res.json({
    success: true,
    message: `Successfully purged jobs and linked data${vesselId ? ` for vessel ${vesselId}` : ' for all vessels'}`,
    statistics: result
  });
}

// ── POST /admin/migrate-inventory ──

export async function migrateInventory(req: Request, res: Response) {
  const { vesselId, dryRun = true } = req.body;

  if (!vesselId) {
    return res.status(400).json({ success: false, error: 'vesselId is required' });
  }

  console.log(`🔄 Starting inventory migration for vessel: ${vesselId}${dryRun ? ' (DRY RUN)' : ''}`);

  const sparesResult = await storage.getSpares(vesselId);

  const stats = {
    sparesProcessed: 0,
    locationsCreated: 0,
    stockRecordsCreated: 0,
    componentLinksCreated: 0,
    transactionsCreated: 0,
    errors: [] as string[]
  };

  for (const spare of sparesResult) {
    try {
      stats.sparesProcessed++;

      const locationA = spare.location || 'Location A';
      const locationB = spare.location2 || 'Location B';
      const robA = spare.robLocationA || 0;
      const robB = spare.robLocationB || 0;
      let runningRob = 0;

      if (robA > 0) {
        stats.locationsCreated++;
        stats.stockRecordsCreated++;
        stats.transactionsCreated++;

        if (!dryRun) {
          const locA = await storage.findOrCreateLocation(vesselId, locationA, 'System Migration');
          await storage.upsertSpareLocationStock({ vesselId, spareId: spare.id, spareUuid: spare.suuid, locationId: locA.id, qty: robA });
          await storage.createInventoryTransaction({
            vesselId, spareId: spare.id, spareUuid: spare.suuid, locationId: locA.id, eventType: 'RECEIVE',
            qtyChange: robA, robTotalBefore: runningRob, robTotalAfter: runningRob + robA,
            robLocationBefore: 0, robLocationAfter: robA, referenceType: 'MANUAL',
            referenceId: `MIGRATE-${vesselId}-${Date.now()}`,
            referenceNote: 'Opening balance migrated from legacy data', userId: 'System Migration'
          });
        }
        runningRob += robA;
      }

      if (robB > 0) {
        stats.locationsCreated++;
        stats.stockRecordsCreated++;
        stats.transactionsCreated++;

        if (!dryRun) {
          const locB = await storage.findOrCreateLocation(vesselId, locationB, 'System Migration');
          await storage.upsertSpareLocationStock({ vesselId, spareId: spare.id, spareUuid: spare.suuid, locationId: locB.id, qty: robB });
          await storage.createInventoryTransaction({
            vesselId, spareId: spare.id, spareUuid: spare.suuid, locationId: locB.id, eventType: 'RECEIVE',
            qtyChange: robB, robTotalBefore: runningRob, robTotalAfter: runningRob + robB,
            robLocationBefore: 0, robLocationAfter: robB, referenceType: 'MANUAL',
            referenceId: `MIGRATE-${vesselId}-${Date.now()}`,
            referenceNote: 'Opening balance migrated from legacy data', userId: 'System Migration'
          });
        }
      }

      if (spare.componentId) {
        stats.componentLinksCreated++;
        if (!dryRun) {
          try {
            await storage.createSpareComponentLink({
              vesselId, spareId: spare.id, spareUuid: spare.suuid, componentId: spare.componentId, linkedBy: 'System Migration'
            });
          } catch (linkError: any) {
            if (!linkError.message?.includes('duplicate')) {
              stats.errors.push(`Link error for spare ${spare.id}: ${linkError.message}`);
            } else {
              stats.componentLinksCreated--;
            }
          }
        }
      }
    } catch (spareError: any) {
      stats.errors.push(`Error processing spare ${spare.id}: ${spareError.message}`);
    }
  }

  console.log(`✅ Migration ${dryRun ? 'preview' : 'completed'}:`, stats);

  res.json({
    success: true,
    dryRun,
    message: dryRun ? 'Migration preview complete. Set dryRun=false to execute.' : 'Migration completed successfully',
    statistics: stats
  });
}

// ── POST /admin/sync-work-order-status ──

export async function syncWorkOrderStatus(req: Request, res: Response) {
  const { vesselId, dryRun = true } = req.body;

  console.log(`🔄 Starting work order status sync${vesselId ? ` for vessel ${vesselId}` : ' for all vessels'}${dryRun ? ' (DRY RUN)' : ''}`);

  const workOrders = await storage.getWorkOrders(vesselId || undefined);
  const allVessels = await storage.getVessels();
  const vesselSettingsMap = new Map<string, any>();
  const graceSettingsMap = new Map<string, any>();

  for (const vessel of allVessels) {
    if (vessel.id) {
      const settings = await storage.getPmsVesselSettings(vessel.id);
      if (settings) {
        vesselSettingsMap.set(vessel.id, settings);
        graceSettingsMap.set(vessel.id, settings);
      }
    }
  }

  const allJobs = await storage.getJobs();
  const jobMap = new Map(allJobs.map(j => [j.juuid, j]));

  // Collect components from all vessels for code-based lookup
  const allComponents: any[] = [];
  for (const vessel of allVessels) {
    if (vessel.id) {
      const vesselComponents = await storage.getComponents(vessel.id);
      allComponents.push(...vesselComponents);
    }
  }
  const componentByCodeMap = new Map(allComponents.map(c => [c.componentCode, c]));

  const stats = {
    totalProcessed: 0,
    statusUpdated: 0,
    alreadyCorrect: 0,
    errors: [] as string[],
    changes: [] as { id: string; workOrderNo: string; oldStatus: string; newStatus: string }[]
  };

  for (const wo of workOrders) {
    try {
      stats.totalProcessed++;

      const job = wo.jobId ? jobMap.get(wo.jobId) : undefined;
      const component = wo.componentCode ? componentByCodeMap.get(wo.componentCode) : undefined;
      const vesselSettings = wo.vesselId ? vesselSettingsMap.get(wo.vesselId) : undefined;
      const vesselGraceSettings = wo.vesselId ? graceSettingsMap.get(wo.vesselId) : undefined;

      const parseRH = (val: string | number | null | undefined): number | undefined => {
        if (val === null || val === undefined || val === '') return undefined;
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        return isNaN(num) ? undefined : num;
      };

      const dueRH = wo.maintenanceBasis === 'Running Hours'
        ? (parseRH(job?.nextDueRH) ?? parseRH(wo.nextDueReading))
        : undefined;
      const currentRH = wo.maintenanceBasis === 'Running Hours'
        ? (parseRH(component?.currentCumulativeRH) ?? parseRH(wo.currentReading))
        : undefined;

      const isJobCritical = job?.jobPriority === 'Critical' || job?.classRelated === 'true';
      const rhLeadTimeHours = wo.maintenanceBasis === 'Running Hours'
        ? (isJobCritical
            ? (vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL)
            : (vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS))
        : undefined;

      const computedStatus = computeWorkOrderStatus({
        dueDate: wo.dueDate,
        dueRH,
        currentRH,
        isExecution: wo.isExecution || false,
        status: wo.status,
        completionDateTime: wo.completionDateTime,
        maintenanceBasis: wo.maintenanceBasis ?? undefined,
        vesselGraceSettings: vesselGraceSettings ? {
          calendarGraceMode: vesselGraceSettings.calendarGraceMode || 'COMPANY_STANDARD',
          calendarGraceDays: vesselGraceSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
          rhGraceHours: vesselSettings?.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
          rhLeadTimeHours: vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
        } : undefined,
        rhLeadTimeHours
      });

      if (wo.status !== computedStatus) {
        stats.changes.push({
          id: wo.id,
          workOrderNo: wo.workOrderNo,
          oldStatus: wo.status || 'null',
          newStatus: computedStatus
        });

        if (!dryRun) {
          await storage.updateWorkOrder(wo.wouuid, { status: computedStatus });
        }
        stats.statusUpdated++;
      } else {
        stats.alreadyCorrect++;
      }
    } catch (woError: any) {
      stats.errors.push(`Error processing WO ${wo.workOrderNo}: ${woError.message}`);
    }
  }

  console.log(`✅ Status sync ${dryRun ? 'preview' : 'completed'}:`, {
    totalProcessed: stats.totalProcessed,
    statusUpdated: stats.statusUpdated,
    alreadyCorrect: stats.alreadyCorrect,
    errors: stats.errors.length
  });

  res.json({
    success: true,
    dryRun,
    message: dryRun
      ? `Status sync preview complete. ${stats.statusUpdated} work orders would be updated. Set dryRun=false to execute.`
      : `Status sync completed. ${stats.statusUpdated} work orders updated.`,
    statistics: {
      totalProcessed: stats.totalProcessed,
      statusUpdated: stats.statusUpdated,
      alreadyCorrect: stats.alreadyCorrect,
      errorCount: stats.errors.length
    },
    changes: stats.changes.slice(0, 50),
    errors: stats.errors
  });
}

// ── POST /admin/sync-masters ──

export async function syncMasters(req: Request, res: Response) {
  console.log('🔄 Starting master data sync...');

  const domain = req.body.domain || 'rsms';
  const BASE_URL = 'https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata';

  const stats = {
    vessels: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
    vesselTypes: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
    additionalGroups: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
    ports: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
    users: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
    fleetGroups: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
  };

  const fetchExternal = async (endpoint: string, key: string) => {
    const response = await fetch(`${BASE_URL}/${endpoint}?domain=${domain}`);
    if (!response.ok) throw new Error(`Failed to fetch ${endpoint}: ${response.status}`);
    const data = await response.json();
    return data[key] || [];
  };

  const getEntryId = (entry: any, idFields: string[]): string | null => {
    for (const field of idFields) {
      if (entry[field] !== undefined && entry[field] !== null) return String(entry[field]);
    }
    return null;
  };

  const getFieldValue = (entry: any, fields: string[]): string | null => {
    for (const field of fields) {
      if (entry[field] !== undefined && entry[field] !== null) return String(entry[field]);
    }
    return null;
  };

  const pool = await getPool();

  // 1. Sync Vessels
  console.log('📦 Syncing Vessel Master...');
  const vessels = await fetchExternal('vessels', 'vessels');
  for (const v of vessels) {
    try {
      const entryId = getEntryId(v, ['vuid', 'vesselId']);
      if (!entryId) { stats.vessels.skipped++; continue; }
      const name = getFieldValue(v, ['vessel', 'vesselName', 'name']) || 'Unknown';
      const imoNumber = getFieldValue(v, ['imo_number', 'imoNumber', 'imo_no', 'imo']);
      const vesselType = getFieldValue(v, ['vessel_type_name', 'vesselTypeName', 'vessel_type', 'vesselType', 'type']);
      await pool.query(`INSERT INTO vessels (id, vuuid, name, code, imo_number, vessel_type, is_active, created_at, updated_at) VALUES ($1, $1, $2, $3, $4, $5, true, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, imo_number = EXCLUDED.imo_number, vessel_type = EXCLUDED.vessel_type, is_active = true, updated_at = NOW(), vuuid = COALESCE(vessels.vuuid, EXCLUDED.vuuid)`, [entryId, name, entryId, imoNumber, vesselType]);
      stats.vessels.updated++;
    } catch (e: any) { stats.vessels.errors.push(`Vessel ${v.vuid || v.vesselId}: ${e.message}`); }
  }

  // 2. Sync Vessel Types
  console.log('📦 Syncing Vessel Types...');
  const vesselTypes = await fetchExternal('vesseltypes', 'vesseltypes');
  for (const vt of vesselTypes) {
    try {
      const entryId = getEntryId(vt, ['vtuid', 'id', 'vesselTypeId']);
      if (!entryId) { stats.vesselTypes.skipped++; continue; }
      const name = getFieldValue(vt, ['vesselType', 'vesselTypeName', 'name', 'type_name']) || 'Unknown';
      const classifications: string[] = [];
      if (vt.tanker === 1) classifications.push('Tanker');
      if (vt.oilTanker === 1) classifications.push('Oil');
      if (vt.gasTanker === 1) classifications.push('Gas');
      if (vt.chemicalTanker === 1) classifications.push('Chemical');
      if (vt.dry === 1) classifications.push('Dry');
      if (vt.container === 1) classifications.push('Container');
      const classification = classifications.length > 0 ? classifications.join(', ') : null;
      await pool.query(`INSERT INTO vessel_types (id, name, classification, synced_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, classification = EXCLUDED.classification, synced_at = NOW(), updated_at = NOW()`, [entryId, name, classification]);
      stats.vesselTypes.updated++;
    } catch (e: any) { stats.vesselTypes.errors.push(`VesselType ${vt.vtuid}: ${e.message}`); }
  }

  // 3. Sync Additional Groups
  console.log('📦 Syncing Additional Groups...');
  const additionalGroups = await fetchExternal('additionalgroups', 'additionalGroups');
  for (const ag of additionalGroups) {
    try {
      const entryId = getEntryId(ag, ['id', 'groupId', 'additional_group_id']);
      if (!entryId) { stats.additionalGroups.skipped++; continue; }
      const name = getFieldValue(ag, ['group_name', 'groupName', 'name', 'additional_group_name']) || 'Unknown';
      const description = getFieldValue(ag, ['vessels', 'group_description', 'desc']);
      await pool.query(`INSERT INTO additional_groups (id, name, description, synced_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, synced_at = NOW(), updated_at = NOW()`, [entryId, name, description]);
      stats.additionalGroups.updated++;
    } catch (e: any) { stats.additionalGroups.errors.push(`AdditionalGroup ${ag.id}: ${e.message}`); }
  }

  // 4. Sync Ports
  console.log('📦 Syncing Ports...');
  const ports = await fetchExternal('ports', 'ports');
  for (const p of ports) {
    try {
      const entryId = getEntryId(p, ['puid', 'id', 'portId']);
      if (!entryId) { stats.ports.skipped++; continue; }
      const name = getFieldValue(p, ['port_name', 'portName', 'name']) || 'Unknown';
      const country = getFieldValue(p, ['country_name', 'countryName', 'country']);
      await pool.query(`INSERT INTO ports (id, name, country, synced_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, country = EXCLUDED.country, synced_at = NOW(), updated_at = NOW()`, [entryId, name, country]);
      stats.ports.updated++;
    } catch (e: any) { stats.ports.errors.push(`Port ${p.puid}: ${e.message}`); }
  }

  // 5. Sync Users
  console.log('📦 Syncing Users...');
  const users = await fetchExternal('users', 'users');
  for (const u of users) {
    try {
      const entryId = getEntryId(u, ['uuid', 'id', 'userId']);
      if (!entryId) { stats.users.skipped++; continue; }
      const fullName = getFieldValue(u, ['fullname', 'userName', 'name', 'username', 'full_name']) || 'Unknown';
      const role = getFieldValue(u, ['role', 'role_name', 'roleName', 'user_role']);
      const designation = getFieldValue(u, ['designation', 'position', 'title', 'job_title']);
      const userType = getFieldValue(u, ['user_type', 'userType', 'type']);
      const department = getFieldValue(u, ['department', 'department_name', 'dept']);
      const email = getFieldValue(u, ['email', 'email_address', 'user_email']);
      await pool.query(`INSERT INTO master_users (id, full_name, role, designation, user_type, department, email, synced_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, designation = EXCLUDED.designation, user_type = EXCLUDED.user_type, department = EXCLUDED.department, email = EXCLUDED.email, synced_at = NOW(), updated_at = NOW()`, [entryId, fullName, role, designation, userType, department, email]);
      stats.users.updated++;
    } catch (e: any) { stats.users.errors.push(`User ${u.uuid}: ${e.message}`); }
  }

  // 6. Sync Fleet Groups
  console.log('📦 Syncing Fleet Groups...');
  const fleetGroups = await fetchExternal('fleetgroups', 'fleetGroups');
  for (const fg of fleetGroups) {
    try {
      const entryId = getEntryId(fg, ['fleet_group_id', 'id', 'fleetGroupId']);
      if (!entryId) { stats.fleetGroups.skipped++; continue; }
      const name = getFieldValue(fg, ['fleet_group_name', 'fleetGroupName', 'name', 'group_name']) || 'Unknown';
      const description = getFieldValue(fg, ['vessels', 'fleet_group_description', 'desc']);
      await pool.query(`INSERT INTO fleet_groups (id, name, description, synced_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, synced_at = NOW(), updated_at = NOW()`, [entryId, name, description]);
      stats.fleetGroups.updated++;
    } catch (e: any) { stats.fleetGroups.errors.push(`FleetGroup ${fg.fleet_group_id}: ${e.message}`); }
  }

  console.log('✅ Master data sync completed:', stats);

  res.json({
    success: true,
    message: 'Master data sync completed successfully',
    statistics: stats
  });
}

// ── POST /admin/populate-postponement-history ──

export async function populatePostponementHistory(req: Request, res: Response) {
  const { vesselId } = req.body;

  const allVessels = await storage.getVessels();
  const targetVessels = vesselId && vesselId !== 'all'
    ? allVessels.filter(v => v.id === vesselId)
    : allVessels;

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const vessel of targetVessels) {
    const workOrders = await storage.getWorkOrders(vessel.id);
    const postponedWOs = workOrders.filter(wo =>
      wo.status === 'Postponed' &&
      (wo.postponementEndDate || wo.postponementReason)
    );

    for (const wo of postponedWOs) {
      try {
        const existingPostponements = await storage.getWorkOrderPostponements(
          vessel.id,
          { workOrderId: wo.wouuid }
        );

        if (existingPostponements.length > 0) {
          skipped++;
          continue;
        }

        const postponementId = `pp-${wo.id}-${Date.now()}`;
        const postponementData: any = {
          id: postponementId,
          workOrderId: wo.wouuid,
          vesselId: vessel.id,
          postponementNumber: 1,
          originalDueDate: wo.dueDate || null,
          newDueDate: wo.postponementEndDate || null,
          postponementReason: wo.postponementReason || 'Migrated from existing work order',
          authorizedBy: wo.postponementAuthorizedBy || null,
          approvalRemarks: null,
          durationDays: null,
          submittedDate: wo.submittedDate || null,
          approvedDate: null,
          approvedBy: null,
          status: 'Approved',
          informOffice: false
        };

        if (postponementData.originalDueDate && postponementData.newDueDate) {
          const origDate = new Date(postponementData.originalDueDate);
          const newDate = new Date(postponementData.newDueDate);
          if (!isNaN(origDate.getTime()) && !isNaN(newDate.getTime())) {
            postponementData.durationDays = Math.ceil((newDate.getTime() - origDate.getTime()) / (1000 * 60 * 60 * 24));
          }
        }

        await storage.createWorkOrderPostponement(postponementData);
        created++;
      } catch (err: any) {
        errors.push(`WO ${wo.workOrderNo || wo.id}: ${err.message}`);
      }
    }
  }

  console.log(`[POSTPONEMENT MIGRATION] Populated: ${created} created, ${skipped} skipped, ${errors.length} errors`);

  res.json({
    success: true,
    created,
    skipped,
    errors: errors.slice(0, 10),
    message: `Created ${created} postponement history records (${skipped} skipped, ${errors.length} errors)`
  });
}
