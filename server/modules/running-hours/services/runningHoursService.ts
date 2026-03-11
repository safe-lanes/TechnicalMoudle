import * as repo from '../repositories/runningHoursRepository';
import { validateRunningHoursIncrease, canAdminOverride } from '../utils/rhValidation';
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
  updateSource: z.enum(['MANUAL', 'IMPORT', 'AUTOMATION']).optional().default('MANUAL'),
  userId: z.string().optional().default('system'),
  userRole: z.string().optional().default('Ship'),
  adminOverride: z.boolean().optional().default(false),
  comments: z.string().optional(),
  dateUpdated: z.string().optional()
});

// ── Helper: resolve last-updated date with fallback chain ──

function resolveLastUpdated(component: Component): string | null {
  return component.lastUpdated
    || (component.rhMasterUpdatedAt ? new Date(component.rhMasterUpdatedAt).toISOString() : null)
    || (component.updatedAt ? new Date(component.updatedAt).toISOString() : null);
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
  return repo.createRunningHoursAudit(parseResult.data);
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

// ══════════════════════════════════════════════════════════
// Running Hours Parents (from runningHoursRoutes.ts)
// ══════════════════════════════════════════════════════════

export async function listParents(vesselId: string, period: string = 'monthly') {
  const allComponents = await repo.getComponents(vesselId);

  const masterComponents = allComponents.filter(
    component => component.rhCounterType === 'MASTER'
  );

  const periodHoursMap: Record<string, number> = {
    weekly: 168,
    monthly: 720,
    quarterly: 2160,
    yearly: 8760
  };
  const totalPeriodHours = periodHoursMap[period] || periodHoursMap.monthly;
  const now = new Date();
  const periodStartDate = new Date(now.getTime() - totalPeriodHours * 60 * 60 * 1000);

  const parentsWithCounts = await Promise.all(
    masterComponents.map(async (component) => {
      const inheritedComponents = await repo.getInheritedComponents(component.cuuid, vesselId);

      const meterReplacedLastRh = parseFloat(component.meterReplacedLastRh || '0');
      const currentMeterRH = parseFloat(component.rhCurrentMaster || component.currentCumulativeRH || '0');
      const totalCumulativeRH = meterReplacedLastRh + currentMeterRH;

      const hoursRunInPeriod = await repo.sumPositiveDeltasInPeriod(component.cuuid, periodStartDate, now);
      const utilizationRate = totalPeriodHours > 0
        ? Math.round(Math.min((hoursRunInPeriod / totalPeriodHours) * 100, 100.0) * 10) / 10
        : 0;

      return {
        ...component,
        sfiCode: component.componentCode || '',
        latestUpdate: component.lastUpdated || component.rhMasterUpdatedAt || component.updatedAt || new Date().toISOString(),
        currentCumulativeRH: totalCumulativeRH.toFixed(2),
        currentMeterRH: currentMeterRH.toFixed(2),
        meterReplacedLastRh: meterReplacedLastRh > 0 ? meterReplacedLastRh.toFixed(2) : null,
        meterReplacedDate: component.meterReplacedDate || null,
        inheritedCount: inheritedComponents.length,
        utilizationRate,
        periodRunningHours: Math.round(hoursRunInPeriod * 10) / 10
      };
    })
  );

  // Sort by component code for consistent ordering
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

  // Use storage layer method which handles all ID formats
  const children = await repo.getInheritedComponents(parent.cuuid, vesselId);

  // Format response with RH data for each child
  const childrenWithRH = children.map(child => {
    const displayRH = child.currentCumulativeRH || child.rhCurrentInheritedCached || '0.00';
    return {
      id: child.id,
      componentCode: child.componentCode || '',
      name: child.name || '',
      currentCumulativeRH: displayRH,
      rhCounterType: child.rhCounterType || 'INHERITED',
      lastUpdated: child.lastUpdated || child.updatedAt || '-'
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
  userRole?: string;
  adminOverride?: boolean;
  dateUpdated?: string;
}) {
  const { newRHValue, comments, userId, userRole, adminOverride, dateUpdated } = body;

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

  // Validate running hours increase against daily limits
  const validation = validateRunningHoursIncrease({
    currentRH: currentRHValue,
    newRH: newRHValue,
    componentLastUpdated: componentLastUpdated,
    newUpdateDate: dateUpdated || new Date().toISOString(),
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
  await repo.updateComponent(componentId, {
    currentCumulativeRH: newRHFormatted,
    runningHours: newRHFormatted,
    lastUpdated: new Date().toISOString()
  });

  // Create audit entry for the update
  await repo.createRunningHoursAudit({
    vesselId: component.vesselId || '',
    componentId: componentId,
    previousRH: previousRH,
    newRH: newRHFormatted,
    cumulativeRH: newRHFormatted,
    dateUpdatedLocal: new Date().toISOString().split('T')[0],
    dateUpdatedTZ: 'UTC',
    enteredAtUTC: new Date(),
    userId: userId || 'system',
    source: 'manual',
    notes: comments || 'Manual update of child component RH',
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
  notes?: string;
}) {
  const { oldMeterFinal, userId, notes } = body;

  const component = await repo.getComponent(componentId);
  if (!component) {
    throw new NotFoundError('Component not found');
  }

  const previousRH = component.currentCumulativeRH || '0.00';

  // Update component RH to 0
  await repo.updateComponent(componentId, {
    currentCumulativeRH: '0.00',
    runningHours: '0.00',
    lastUpdated: new Date().toISOString()
  });

  // Create audit entry for the reset
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

  const { newRHValue, updateSource, userId, userRole, adminOverride, comments, dateUpdated } = parseResult.data;

  // Verify component exists and is a MASTER type
  const component = await repo.getComponent(componentId);
  if (!component) {
    throw new NotFoundError('Component not found');
  }

  if (component.rhCounterType !== 'MASTER') {
    throw new ValidationError('Running hours can only be updated for MASTER counter type components');
  }

  // Validate running hours increase against daily limits (only for MANUAL updates)
  if (updateSource === 'MANUAL') {
    const currentRHValue = parseFloat(component.rhCurrentMaster || component.currentCumulativeRH || '0');
    const lastUpdate = resolveLastUpdated(component);
    const validation = validateRunningHoursIncrease({
      currentRH: currentRHValue,
      newRH: newRHValue,
      componentLastUpdated: lastUpdate,
      newUpdateDate: dateUpdated || new Date().toISOString(),
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
    comments
  });

  // TRIGGER 1 HOOK: After MASTER RH is updated, scan for RH-based WO generation
  let woGenerationResult = { rhJobsChecked: 0, rhWOsGenerated: 0 };
  try {
    if (component.vesselId) {
      const { jobDueScanner } = await import('../../../services/jobDueScanner');
      const scanResult = await jobDueScanner.runScan();
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
