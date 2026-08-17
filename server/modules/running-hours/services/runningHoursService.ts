import * as repo from '../repositories/runningHoursRepository';
import type { RHHistoryQuery, RHHistoryResult } from '../repositories/runningHoursRepository';
import { validateRunningHoursIncrease, canAdminOverride, safeParseDate } from '../utils/rhValidation';
import { canonicalizeReadingDateInput, requireReadingDayInput, todayReadingDay } from '../utils/readingDate';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { z } from 'zod';
import { insertRunningHoursAuditSchema, cascadeRunningHoursSchema } from '@shared/schema';
import type { InsertRunningHoursAudit, RunningHoursAudit, Component } from '@shared/schema';

// ── Zod schemas for RH configuration API validation ──

const updateRHConfigSchema = z.object({
  rhCounterType: z.enum(['MASTER', 'INHERITED', 'NOT_RH_DRIVEN']),
  rhMasterComponentId: z.string().nullable().optional(),
  userId: z.string().optional()
});

const updateMasterRHSchema = z.object({
  newRHValue: z.number().nonnegative("Running hours must be non-negative"),
  updateSource: z.enum(['MANUAL', 'IMPORT', 'AUTOMATION', 'WORKORDER']).optional().default('MANUAL'),
  userId: z.string().optional().default('system'),
  userUuid: z.string().optional(),
  userRole: z.string().optional().default('Ship'),
  adminOverride: z.boolean().optional().default(false),
  comments: z.string().optional(),
  dateUpdated: z.string().optional()
});

// ── Helper: resolve last-updated date with fallback chain ──
// Task #427: canonicalize legacy stamp text via the shared calendar-day
// parser — no naive `new Date(text)`, no machine-timezone day shifts. When
// the component's own text stamp is unparseable, fall through to the typed
// timestamp columns.

function resolveLastUpdated(component: Component): string | null {
  const own = canonicalizeReadingDateInput(component.lastUpdated ?? null);
  if (own) return own;
  const master = canonicalizeReadingDateInput(
    component.rhMasterUpdatedAt ? new Date(component.rhMasterUpdatedAt) : null
  );
  if (master) return master;
  return canonicalizeReadingDateInput(component.updatedAt ? new Date(component.updatedAt) : null);
}

// ══════════════════════════════════════════════════════════
// Running Hours Audits (from routes.ts)
// ══════════════════════════════════════════════════════════

export async function getAuditsForComponent(componentId: string): Promise<RunningHoursAudit[]> {
  return repo.getRunningHoursAudits(componentId);
}

export async function createAudit(body: unknown): Promise<RunningHoursAudit> {
  const parseResult = insertRunningHoursAuditSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError("Invalid audit data", { details: parseResult.error.errors });
  }
  const data = parseResult.data;
  // Task #427 calendar-day contract: date_updated_local is ALWAYS persisted as
  // canonical YYYY-MM-DD. A supplied-but-unparseable date is rejected loudly —
  // silently persisting raw text would re-open the poisoning path the
  // normalization migration just closed.
  if (data.dateUpdatedLocal !== undefined && data.dateUpdatedLocal !== null && String(data.dateUpdatedLocal).trim() !== '') {
    const canonical = canonicalizeReadingDateInput(String(data.dateUpdatedLocal));
    if (!canonical) {
      throw new ValidationError(
        `Invalid reading date "${data.dateUpdatedLocal}". Use a real calendar date (e.g. 2026-08-17).`,
        { code: 'RH_INVALID_READING_DATE' }
      );
    }
    data.dateUpdatedLocal = canonical;
  }
  return repo.createRunningHoursAudit(data);
}

// ══════════════════════════════════════════════════════════
// Cascade Update (from routes.ts)
// ══════════════════════════════════════════════════════════

export async function cascadeUpdate(body: unknown) {
  const parseResult = cascadeRunningHoursSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError("Invalid cascade data", { details: parseResult.error.errors });
  }
  const validatedData = parseResult.data;

  // Task #427: canonicalize the user's reading date ONCE at the service
  // boundary — validation and the cascade's persistence (date_updated_local,
  // component stamps, rotational stamp accrual) all see the same YYYY-MM-DD.
  // Absent → today; PRESENT-but-unparseable → reject (never silently 'today').
  validatedData.dateUpdated = requireReadingDayInput(validatedData.dateUpdated ?? null) ?? todayReadingDay();

  // Get the parent component to determine current RH
  const parentComponent = await repo.getComponent(validatedData.parentComponentId);
  if (!parentComponent) {
    throw new NotFoundError('Parent component not found');
  }

  const currentRH = parseFloat(parentComponent.currentCumulativeRH || '0');
  let targetRH: number;

  if (validatedData.mode === 'setTotal') {
    targetRH = validatedData.value;
  } else {
    // addDelta mode
    targetRH = currentRH + validatedData.value;
  }

  // Skip daily-limit validation for meter replacements (physical device swap, not normal accumulation)
  if (!validatedData.meterReplaced) {
    // Validate running hours increase against daily limits
    // Use same fallback logic as the Running Hours display
    const componentLastUpdated = resolveLastUpdated(parentComponent);

    console.log('[RH Validation Debug] componentLastUpdated:', componentLastUpdated);
    console.log('[RH Validation Debug] newUpdateDate:', validatedData.dateUpdated);
    console.log('[RH Validation Debug] currentRH:', currentRH, 'targetRH:', targetRH);

    const validation = validateRunningHoursIncrease({
      currentRH: currentRH,
      newRH: targetRH,
      componentLastUpdated: componentLastUpdated,
      newUpdateDate: validatedData.dateUpdated,
      userRole: validatedData.userRole || 'Ship',
      adminOverride: validatedData.adminOverride || false
    });

    console.log('[RH Validation Debug] result:', validation);

    if (!validation.allowed) {
      throw new ValidationError(validation.message, {
        validation: {
          maxAllowedIncrease: validation.maxAllowedIncrease,
          requestedIncrease: validation.requestedIncrease,
          daysSinceLastUpdate: validation.daysSinceLastUpdate,
          lastUpdateDate: validation.lastUpdateDate,
          requiresAdminOverride: validation.requiresAdminOverride,
          canOverride: canAdminOverride(validatedData.userRole || 'Ship')
        }
      });
    }

    const result = await repo.cascadeRunningHoursUpdate(validatedData);
    return {
      ...result,
      validation: {
        maxAllowedIncrease: validation.maxAllowedIncrease,
        actualIncrease: validation.requestedIncrease
      }
    };
  }

  const result = await repo.cascadeRunningHoursUpdate(validatedData);
  return {
    ...result,
    validation: {
      maxAllowedIncrease: null,
      actualIncrease: null
    }
  };
}

// ══════════════════════════════════════════════════════════
// Running Hours Parents (from runningHoursRoutes.ts)
// ══════════════════════════════════════════════════════════

export async function listParents(vesselId: string, period: string = 'monthly', customFrom?: Date, customTo?: Date, vesselIds?: string[]) {
  const allComponents = await repo.getComponents(vesselId, vesselIds);

  const masterComponents = allComponents.filter(
    component => component.rhCounterType === 'MASTER' && component.isActive !== false
  );

  let periodDays: number;
  let periodStartDate: Date;
  const now = new Date();

  let periodEndDate: Date | null = null;

  if (period === 'custom' && customFrom && customTo) {
    periodStartDate = customFrom;
    periodEndDate = customTo;
    const diffMs = customTo.getTime() - customFrom.getTime();
    periodDays = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  } else {
    const periodDaysMap: Record<string, number> = {
      weekly: 7,
      monthly: 30,
      quarterly: 90,
      yearly: 365
    };
    periodDays = periodDaysMap[period] || periodDaysMap.monthly;
    periodStartDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  }
  const totalPeriodHours = periodDays * 24;

  // Inherited components are already loaded in `allComponents`; count them in-memory
  // per master (mirrors storage.getInheritedComponents matching) instead of issuing
  // one query per master. This removes the dominant N+1 fan-out.
  const inheritedActive = allComponents.filter(
    (c: any) => c.rhCounterType === 'INHERITED' && c.isActive !== false
  );

  // Batch the audit lookups across ALL masters in one/two round-trips each, instead
  // of getRunningHoursAtDate + getRunningHoursAudits per master. Pass BOTH id and
  // cuuid so legacy audit rows keyed by the non-cuuid id still resolve (mirrors the
  // dual-identifier OR in storage.getRunningHoursAtDate). Results are keyed by cuuid.
  const masterRefs = masterComponents.map((m) => ({ id: String(m.id), cuuid: m.cuuid }));
  const startEntries = await repo.getRunningHoursAtDateBatch(masterRefs, periodStartDate);
  const endEntries = periodEndDate ? await repo.getRunningHoursAtDateBatch(masterRefs, periodEndDate) : null;
  const lastUpdatedByMap = await repo.getLatestAuditUserBatch(masterRefs);

  const parentsWithCounts = masterComponents.map((component) => {
      // Under 'all'/'my' aggregate, vesselId is 'all' — scope inherited lookup to the
      // master's own vessel so the per-vessel isolation safeguard still resolves.
      const effectiveVesselId = component.vesselId ?? vesselId;
      const inheritedCount = inheritedActive.filter((c: any) =>
        c.vesselId === effectiveVesselId && (
          c.rhMasterComponentId === component.id ||
          c.rhMasterComponentId === component.componentCode ||
          c.rhMasterComponentId === component.cuuid ||
          c.rhCounterSource === component.componentCode
        )
      ).length;

      const meterReplacedLastRh = parseFloat(component.meterReplacedLastRh || '0');
      const currentMeterRH = parseFloat(component.rhCurrentMaster || (component as any).currentCumulativeRH || '0');
      const totalCumulativeRH = meterReplacedLastRh + currentMeterRH;

      const historicalEntry = startEntries.get(component.cuuid) || null;
      const endEntry = endEntries ? (endEntries.get(component.cuuid) || null) : null;

      let utilizationRate = 0;
      let periodRunningHours = 0;
      let rhAtPeriodStart = 0;
      let rhAtPeriodEnd = totalCumulativeRH;
      let dataQualityWarning: string | null = null;

      if (totalCumulativeRH === 0) {
        rhAtPeriodStart = 0;
      } else if (historicalEntry) {
        rhAtPeriodStart = historicalEntry.runningHours;
        if (historicalEntry.isFallback) {
          dataQualityWarning = 'no_baseline';
        }
      } else {
        rhAtPeriodStart = 0;
        if (totalCumulativeRH > 0) {
          dataQualityWarning = 'no_audit_history';
        }
      }

      if (periodEndDate && endEntry) {
        rhAtPeriodEnd = endEntry.runningHours;
      }

      const rhIncrease = rhAtPeriodEnd - rhAtPeriodStart;

      if (rhIncrease < 0) {
        utilizationRate = 0;
        periodRunningHours = 0;
        dataQualityWarning = 'meter_reset';
      } else if (rhIncrease > 0 && totalPeriodHours > 0) {
        const rawRate = (rhIncrease / totalPeriodHours) * 100;
        if (rawRate > 100) {
          dataQualityWarning = 'capped_100';
        }
        utilizationRate = Math.round(Math.min(rawRate, 100.0) * 10) / 10;
        periodRunningHours = Math.round(rhIncrease * 10) / 10;
      }

      const averageDailyHours = periodDays > 0 && periodRunningHours > 0
        ? Math.round((periodRunningHours / periodDays) * 10) / 10
        : 0;

      const auditEntry = lastUpdatedByMap.get(component.cuuid) ?? null;
      const lastUpdatedBy = auditEntry?.userId ?? null;

      // Compute the most recent RH-specific "Last Updated" date as MAX of three
      // sources that are only written when Running Hours actually change:
      //   1. running_hours_audit.dateUpdatedLocal — the user's entered reading date
      //   2. components.last_updated              — written on every RH update
      //   3. components.rh_master_updated_at      — explicit RH timestamp
      // Nulls and unparseable values are filtered out before the comparison.
      const auditDateParsed = safeParseDate(auditEntry?.auditDate);
      const lastUpdatedParsed = safeParseDate((component as any).lastUpdated);
      const rhMasterUpdatedParsed = safeParseDate((component as any).rhMasterUpdatedAt);
      const rhDates = [auditDateParsed, lastUpdatedParsed, rhMasterUpdatedParsed].filter((d): d is Date => d !== null);
      const latestRHDate = rhDates.length > 0
        ? new Date(Math.max(...rhDates.map(d => d.getTime())))
        : null;

      return {
        ...component,
        sfiCode: component.componentCode || '',
        latestUpdate: latestRHDate
          ? latestRHDate.toISOString()
          : ((component as any).lastUpdated || (component as any).rhMasterUpdatedAt || null),
        currentCumulativeRH: totalCumulativeRH.toFixed(2),
        currentMeterRH: currentMeterRH.toFixed(2),
        meterReplacedLastRh: meterReplacedLastRh > 0 ? meterReplacedLastRh.toFixed(2) : null,
        meterReplacedDate: component.meterReplacedDate || null,
        inheritedCount,
        utilizationRate,
        periodRunningHours,
        lastUpdatedBy,
        rhAtPeriodStart: Math.round(rhAtPeriodStart * 100) / 100,
        periodStartDate: periodStartDate.toISOString(),
        maxPossibleHours: totalPeriodHours,
        periodDays,
        dataQualityWarning,
        averageDailyHours
      };
  });

  parentsWithCounts.sort((a, b) => (a.componentCode || '').localeCompare(b.componentCode || ''));

  return parentsWithCounts;
}

// ══════════════════════════════════════════════════════════
// Running Hours Children (from runningHoursRoutes.ts)
// ══════════════════════════════════════════════════════════

export async function listChildren(parentCode: string, vesselId: string) {
  const allComponents = await repo.getComponents(vesselId);

  // Find the parent component by code or id
  const parent = allComponents.find(c => c.componentCode === parentCode || c.id === parentCode);
  if (!parent) {
    throw new NotFoundError('Parent component not found');
  }

  // Scope children to the parent's OWN vessel: under aggregate scope ('all')
  // the incoming vesselId is not a concrete vessel, and component codes can
  // repeat across vessels.
  const children = await repo.getInheritedComponents(parent.cuuid, parent.vesselId || vesselId);
  const activeChildren = children.filter((child: any) => child.isActive !== false);

  // Batch-fetch the installed stamps' OWN accrued hours per vessel (Task #372):
  // the component counter shows the inherited engine total by design; the stamp
  // tracks only the hours it actually ran while installed.
  const stampsByVessel = new Map<string, string[]>();
  for (const child of activeChildren) {
    const cVessel = (child as any).vesselId;
    const cStamp = (child as any).currentStamp;
    if (cVessel && cStamp) {
      const list = stampsByVessel.get(cVessel) || [];
      list.push(cStamp);
      stampsByVessel.set(cVessel, list);
    }
  }
  const stampInfoByVesselStamp = new Map<string, repo.StampRhInfo>();
  for (const [cVessel, stamps] of Array.from(stampsByVessel.entries())) {
    const infoMap = await repo.getInstalledStampRhBatch(cVessel, stamps);
    for (const [stamp, info] of Array.from(infoMap.entries())) {
      stampInfoByVesselStamp.set(`${cVessel}::${stamp}`, info);
    }
  }

  const childrenWithRH = activeChildren.map(child => {
    const displayRH = child.currentCumulativeRH || child.rhCurrentInheritedCached || '0.00';
    const stampInfo = (child as any).currentStamp && (child as any).vesselId
      ? stampInfoByVesselStamp.get(`${(child as any).vesselId}::${(child as any).currentStamp}`) || null
      : null;
    return {
      id: child.id,
      componentCode: child.componentCode || '',
      name: child.name || '',
      currentCumulativeRH: displayRH,
      rhCounterType: child.rhCounterType || 'INHERITED',
      lastUpdated: child.lastUpdated || child.updatedAt || '-',
      stamp: stampInfo ? {
        stamp: stampInfo.stamp,
        stampName: stampInfo.stampName,
        currentRh: stampInfo.currentRh,
        rhLastUpdated: stampInfo.rhLastUpdated
      } : null
    };
  });

  // Sort by component code
  childrenWithRH.sort((a, b) => a.componentCode.localeCompare(b.componentCode));

  return {
    parent: {
      componentCode: parent.componentCode,
      name: parent.name,
      currentCumulativeRH: parent.currentCumulativeRH || '0.00'
    },
    children: childrenWithRH
  };
}

// ══════════════════════════════════════════════════════════
// Update Child (INHERITED) Component RH (from runningHoursRoutes.ts)
// ══════════════════════════════════════════════════════════

export async function updateChildRH(componentId: string, body: {
  newRHValue: number;
  comments?: string;
  userId?: string;
  userUuid?: string;
  userRole?: string;
  adminOverride?: boolean;
  dateUpdated?: string;
}) {
  const { newRHValue, comments, userId, userUuid, userRole, adminOverride, dateUpdated } = body;

  // Validate newRHValue
  if (typeof newRHValue !== 'number' || newRHValue < 0) {
    throw new ValidationError('newRHValue must be a non-negative number');
  }

  // Get the component
  const component = await repo.getComponent(componentId);
  if (!component) {
    throw new NotFoundError('Component not found');
  }

  // Only allow updating INHERITED components via this endpoint
  // MASTER components should be updated via the cascade endpoint
  if (component.rhCounterType === 'MASTER') {
    throw new ValidationError('Cannot update MASTER component via this endpoint. Use the Update RH button instead.');
  }

  const previousRH = component.currentCumulativeRH || '0.00';
  const currentRHValue = parseFloat(previousRH);

  // Use same fallback logic as the Running Hours display
  const componentLastUpdated = resolveLastUpdated(component);

  // Task #427: canonicalize the user's reading date ONCE at the service
  // boundary — validation, component write, audit insert, and stamp accrual
  // all use this SAME calendar day (offset/locale inputs can no longer make
  // them disagree).
  // Absent → today; PRESENT-but-unparseable → reject (never silently 'today').
  const canonicalDay = requireReadingDayInput(dateUpdated ?? null) ?? todayReadingDay();

  // Validate running hours increase against daily limits
  const validation = validateRunningHoursIncrease({
    currentRH: currentRHValue,
    newRH: newRHValue,
    componentLastUpdated: componentLastUpdated,
    newUpdateDate: canonicalDay,
    userRole: userRole || 'Ship',
    adminOverride: adminOverride || false
  });

  if (!validation.allowed) {
    throw new ValidationError(validation.message, {
      validation: {
        maxAllowedIncrease: validation.maxAllowedIncrease,
        requestedIncrease: validation.requestedIncrease,
        daysSinceLastUpdate: validation.daysSinceLastUpdate,
        lastUpdateDate: validation.lastUpdateDate,
        requiresAdminOverride: validation.requiresAdminOverride,
        canOverride: canAdminOverride(userRole || 'Ship')
      }
    });
  }

  const newRHFormatted = newRHValue.toFixed(2);

  // Update component RH - only update currentCumulativeRH (child's actual hours)
  // Do NOT update rhCurrentInheritedCached as it stores the master's value
  // Use user's entered reading date for last_updated (not server time) so the
  // overview grid MAX logic shows the correct reading date, not today's date.
  // Component write + stamp DELTA accrual happen in ONE locked transaction (Task #374):
  // the delta is computed from a fresh in-tx read, so a duplicate/overlapping
  // submission sees the committed value and accrues 0 instead of double-counting.
  // Task #427: rotational-stamp date contract is the CANONICAL calendar day
  // (YYYY-MM-DD), never an instant — offset/local-midnight inputs must not
  // shift the stored day.
  const atomicResult = await repo.updateChildRhWithStampAccrual({
    componentId,
    newRHValue,
    lastUpdated: canonicalDay,
    readingDateIso: canonicalDay,
    userId: userId || null,
  });
  // Audit the value that was actually committed as previous (fresh in-tx read),
  // not the possibly-stale pre-validation read.
  const committedPreviousRH = atomicResult.previousRH.toFixed(2);

  // dateUpdatedLocal must also use the user's entered date so the audit-based
  // MAX in listParents reads the correct reading date, not the server save time.
  const auditDateLocal = canonicalDay;

  await repo.createRunningHoursAudit({
    vesselId: component.vesselId || '',
    componentId: componentId,
    previousRH: committedPreviousRH,
    newRH: newRHFormatted,
    cumulativeRH: newRHFormatted,
    dateUpdatedLocal: auditDateLocal,
    dateUpdatedTZ: 'UTC',
    enteredAtUTC: new Date(),
    userId: userId || 'system',
    updatedByUuid: userUuid || null,
    source: 'manual',
    notes: comments || 'Manual update of child component RH',
    // (previousRH above reflects the committed in-tx read)
    meterReplaced: false,
    version: 1
  });

  return {
    success: true,
    message: `Running hours updated to ${newRHFormatted} for ${component.name}`,
    previousRH,
    newRH: newRHFormatted,
    validation: {
      maxAllowedIncrease: validation.maxAllowedIncrease,
      actualIncrease: validation.requestedIncrease
    }
  };
}

// ══════════════════════════════════════════════════════════
// Reset Child RH to 0 (from runningHoursRoutes.ts)
// ══════════════════════════════════════════════════════════

export async function resetChildRH(componentId: string, body: {
  oldMeterFinal?: string;
  userId?: string;
  userUuid?: string;
  notes?: string;
}) {
  const { oldMeterFinal, userId, userUuid, notes } = body;

  const component = await repo.getComponent(componentId);
  if (!component) {
    throw new NotFoundError('Component not found');
  }

  const previousRH = component.currentCumulativeRH || '0.00';

  // NOTE (Task #369): NO stamp accrual here by design — this is a baseline reset
  // (component replaced / meter reset), not hours the installed stamp actually ran.
  // The stamp keeps its own accrued service history.

  // Update component RH to 0
  await repo.updateComponent(componentId, {
    currentCumulativeRH: '0.00',
    runningHours: '0.00',
    lastUpdated: new Date().toISOString()
  });

  await repo.createRunningHoursAudit({
    vesselId: component.vesselId || '',
    componentId: componentId,
    previousRH: previousRH,
    newRH: '0.00',
    cumulativeRH: '0.00',
    dateUpdatedLocal: new Date().toISOString().split('T')[0],
    dateUpdatedTZ: 'UTC',
    enteredAtUTC: new Date(),
    userId: userId || 'system',
    updatedByUuid: userUuid || null,
    source: 'reset',
    notes: notes || 'Component replaced - RH reset to 0',
    meterReplaced: true,
    oldMeterFinal: oldMeterFinal || previousRH,
    newMeterStart: '0.00',
    version: 1
  });

  return {
    success: true,
    message: `Running hours reset to 0 for ${component.name}. Future parent deltas will be applied.`,
    previousRH,
    newRH: '0.00'
  };
}

// ══════════════════════════════════════════════════════════
// RH Config: Get Master Components for Dropdown (from runningHoursRoutes.ts)
// ══════════════════════════════════════════════════════════

export async function listMasterComponents(vesselId: string) {
  const masterComponents = await repo.getMasterComponents(vesselId);

  return masterComponents.map(c => ({
    id: c.id,
    componentCode: c.componentCode,
    name: c.name,
    rhCurrentMaster: c.rhCurrentMaster || '0',
    rhMasterUpdatedAt: c.rhMasterUpdatedAt
  }));
}

// ══════════════════════════════════════════════════════════
// RH Config: Get/Update Component RH Config (from runningHoursRoutes.ts)
// ══════════════════════════════════════════════════════════

export async function getRHConfig(componentId: string) {
  const component = await repo.getComponent(componentId);
  if (!component) {
    throw new NotFoundError('Component not found');
  }

  // Get master component details if INHERITED
  let rhMasterComponentName: string | null = null;
  let masterComponent: Component | undefined = undefined;
  if (component.rhCounterType === 'INHERITED' && component.rhMasterComponentId) {
    masterComponent = await repo.getComponent(component.rhMasterComponentId);
    rhMasterComponentName = masterComponent?.name || null;
  }

  // Determine current RH value based on counter type
  let rhCurrentValue: string | null = null;
  let rhLastUpdated: Date | null = null;

  if (component.rhCounterType === 'MASTER') {
    // MASTER: Bind Running Hours from the component's own rhCurrentMaster
    rhCurrentValue = component.rhCurrentMaster;
    rhLastUpdated = component.rhMasterUpdatedAt;
  } else if (component.rhCounterType === 'INHERITED') {
    // INHERITED: Bind Running Hours LIVE from the master component
    if (masterComponent) {
      rhCurrentValue = masterComponent.rhCurrentMaster;
      rhLastUpdated = masterComponent.rhMasterUpdatedAt;
    } else {
      // Fallback to cached value if master component not found
      rhCurrentValue = component.rhCurrentInheritedCached;
      rhLastUpdated = component.rhInheritedUpdatedAt;
    }
  }

  return {
    componentId: component.cuuid,
    componentName: component.name,
    rhCounterType: component.rhCounterType,
    rhMasterComponentId: component.rhMasterComponentId,
    rhMasterComponentName,
    rhCurrentValue,
    rhLastUpdated,
    rhUpdateSource: component.rhMasterUpdateSource
  };
}

export async function updateRHConfig(componentId: string, body: unknown) {
  // Validate request body with Zod
  const parseResult = updateRHConfigSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError('Invalid request body', { details: parseResult.error.format() });
  }

  const { rhCounterType, rhMasterComponentId, userId } = parseResult.data;

  // Get the current component to validate
  const component = await repo.getComponent(componentId);
  if (!component) {
    throw new NotFoundError('Component not found');
  }

  // Safety check: Prevent self-referential master link
  if (rhCounterType === 'INHERITED' && rhMasterComponentId === componentId) {
    throw new ValidationError('A component cannot inherit running hours from itself');
  }

  // Validate rhMasterComponentId for INHERITED type
  if (rhCounterType === 'INHERITED') {
    if (!rhMasterComponentId) {
      throw new ValidationError('rhMasterComponentId is required for INHERITED counter type');
    }

    // Safety check: Verify master component exists and is in same vessel
    const masterComponent = await repo.getComponent(rhMasterComponentId);
    if (!masterComponent) {
      throw new ValidationError('Master component not found');
    }

    if (masterComponent.vesselId !== component.vesselId) {
      throw new ValidationError('Master component must be from the same vessel');
    }

    if (masterComponent.rhCounterType !== 'MASTER') {
      throw new ValidationError('Selected component is not configured as a MASTER counter type');
    }
  }

  // Downgrade protection: Prevent MASTER -> NONE/INHERITED if component has dependents
  if (component.rhCounterType === 'MASTER' && rhCounterType !== 'MASTER') {
    const dependents = await repo.getInheritedComponents(componentId);
    if (dependents.length > 0) {
      const dependentNames = dependents.slice(0, 3).map(d => d.name).join(', ');
      const moreCount = dependents.length > 3 ? ` and ${dependents.length - 3} more` : '';
      throw new ValidationError(
        `Cannot change from MASTER: ${dependents.length} component(s) inherit from this counter (${dependentNames}${moreCount}). Reassign them first.`
      );
    }
  }

  const updatedComponent = await repo.updateRHConfig({
    componentId,
    rhCounterType,
    rhMasterComponentId: rhCounterType === 'INHERITED' ? rhMasterComponentId : null,
    userId
  });

  return {
    success: true,
    message: `RH counter type updated to ${rhCounterType}`,
    component: updatedComponent
  };
}

// ══════════════════════════════════════════════════════════
// RH Config: Update Master RH with Cascade (from runningHoursRoutes.ts)
// ══════════════════════════════════════════════════════════

export async function updateMasterRH(componentId: string, body: unknown) {
  // Validate request body with Zod
  const parseResult = updateMasterRHSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError('Invalid request body', { details: parseResult.error.format() });
  }

  const { newRHValue, updateSource, userId, userUuid, userRole, adminOverride, comments, dateUpdated } = parseResult.data;

  // Task #427: canonicalize the user's reading date ONCE at the service
  // boundary — validation and persistence (cascade writes date_updated_local
  // + component stamps) use the SAME calendar day.
  // Absent → today; PRESENT-but-unparseable → reject (never silently 'today').
  const canonicalDay = requireReadingDayInput(dateUpdated ?? null) ?? todayReadingDay();

  // Verify component exists and is a MASTER type
  const component = await repo.getComponent(componentId);
  if (!component) {
    throw new NotFoundError('Component not found');
  }

  if (component.rhCounterType !== 'MASTER') {
    throw new ValidationError('Running hours can only be updated for MASTER counter type components');
  }

  // Validate running hours increase against daily limits (MANUAL and WORKORDER updates).
  // IMPORT and AUTOMATION bypass this check — they carry pre-validated bulk data.
  if (updateSource === 'MANUAL' || updateSource === 'WORKORDER') {
    const currentRHValue = parseFloat(component.rhCurrentMaster || component.currentCumulativeRH || '0');
    const lastUpdate = resolveLastUpdated(component);
    const validation = validateRunningHoursIncrease({
      currentRH: currentRHValue,
      newRH: newRHValue,
      componentLastUpdated: lastUpdate,
      newUpdateDate: canonicalDay,
      userRole: userRole || 'Ship',
      adminOverride: adminOverride || false
    });

    if (!validation.allowed) {
      throw new ValidationError(validation.message, {
        validation: {
          maxAllowedIncrease: validation.maxAllowedIncrease,
          requestedIncrease: validation.requestedIncrease,
          daysSinceLastUpdate: validation.daysSinceLastUpdate,
          lastUpdateDate: validation.lastUpdateDate,
          requiresAdminOverride: validation.requiresAdminOverride,
          canOverride: canAdminOverride(userRole || 'Ship')
        }
      });
    }
  }

  const result = await repo.updateMasterRunningHours({
    componentId,
    newRHValue,
    updateSource,
    userId,
    userUuid,
    comments,
    // Persist the reading date (WO completion date / RH Section "Date Updated") so the stored
    // reading and the component's last-updated reflect when the hours were observed, not "now".
    // Task #427: canonical YYYY-MM-DD only.
    dateUpdated: canonicalDay
  });

  // TRIGGER 1 HOOK: After MASTER RH is updated, scan for RH-based WO generation
  let woGenerationResult = { rhJobsChecked: 0, rhWOsGenerated: 0 };
  try {
    if (component.vesselId) {
      const { jobDueScanner } = await import('../../../services/jobDueScanner');
      // Scope the event-driven generation to the affected vessel only (master RH
      // + its inherited cascades are all within this vessel). Avoids a fleet-wide
      // scan on every RH entry — far lower heap/CPU than the previous unscoped call.
      // Task #394: tag the trigger — on shore, RH-triggered scans are always refused
      // (office RH entries must never generate WOs); on ship this changes nothing.
      const scanResult = await jobDueScanner.runScan(component.vesselId, { triggerSource: 'rh-update' });
      woGenerationResult = {
        rhJobsChecked: scanResult.rhJobsChecked,
        rhWOsGenerated: scanResult.rhWOsGenerated
      };

      if (scanResult.rhWOsGenerated > 0) {
        console.log(`[RH Update Trigger] Generated ${scanResult.rhWOsGenerated} WO(s) after MASTER RH update on ${component.name}`);
      }
    }
  } catch (scanError) {
    // Don't fail the RH update if WO generation fails
    console.error('[RH Update Trigger] WO generation scan failed:', scanError);
  }

  return {
    success: true,
    message: `Master RH updated to ${newRHValue}. Cascaded to ${result.inheritedUpdated} inherited components.`,
    masterUpdated: result.masterUpdated,
    inheritedUpdated: result.inheritedUpdated,
    woGeneration: woGenerationResult
  };
}

// ══════════════════════════════════════════════════════════
// RH Config: Get Inherited Components (from runningHoursRoutes.ts)
// ══════════════════════════════════════════════════════════

export async function listInheritedComponents(masterComponentId: string) {
  const inheritedComponents = await repo.getInheritedComponents(masterComponentId);

  return inheritedComponents.map(c => ({
    id: c.id,
    componentCode: c.componentCode,
    name: c.name,
    rhCurrentInheritedCached: c.rhCurrentInheritedCached || '0',
    rhInheritedUpdatedAt: c.rhInheritedUpdatedAt
  }));
}

// ══════════════════════════════════════════════════════════
// One-time Propagation (from runningHoursRoutes.ts)
// ══════════════════════════════════════════════════════════

export async function propagateAll(vesselId: string, userId: string) {
  // Get all MASTER components for the vessel
  const allComponents = await repo.getComponents(vesselId);
  const masterComponents = allComponents.filter(c => c.rhCounterType === 'MASTER');

  let totalMastersProcessed = 0;
  let totalInheritedUpdated = 0;
  const results: { masterCode: string; masterName: string; rhValue: string; inheritedUpdated: number }[] = [];

  for (const master of masterComponents) {
    const currentRH = parseFloat(master.currentCumulativeRH || master.rhCurrentMaster || '0');

    // Only process masters that have RH > 0
    if (currentRH > 0) {
      try {
        const result = await repo.updateMasterRunningHours({
          componentId: master.cuuid,
          newRHValue: currentRH,
          updateSource: 'AUTOMATION',
          userId: userId,
          comments: 'One-time propagation to fix inherited components'
        });

        totalMastersProcessed++;
        totalInheritedUpdated += result.inheritedUpdated;
        results.push({
          masterCode: master.componentCode || '',
          masterName: master.name || '',
          rhValue: currentRH.toString(),
          inheritedUpdated: result.inheritedUpdated
        });
      } catch (err) {
        console.error(`Failed to propagate RH for master ${master.componentCode}:`, err);
      }
    }
  }

  return {
    success: true,
    message: `Propagated RH values from ${totalMastersProcessed} MASTER components to ${totalInheritedUpdated} INHERITED components`,
    totalMastersProcessed,
    totalInheritedUpdated,
    details: results
  };
}

// ══════════════════════════════════════════════════════════
// Running Hours History
// ══════════════════════════════════════════════════════════

export async function getRunningHoursHistory(query: RHHistoryQuery): Promise<RHHistoryResult> {
  return repo.getRunningHoursHistory(query);
}

// ══════════════════════════════════════════════════════════
// Meter Replacement History
// ══════════════════════════════════════════════════════════

export async function getMeterReplacementHistory(componentId: string) {
  return repo.getMeterReplacementHistory(componentId);
}
