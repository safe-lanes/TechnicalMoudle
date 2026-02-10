import { eq, and, or, desc, gte, lte } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  v2Components,
  v2RunningHoursAudit,
  type Component,
  type RunningHoursAudit,
  type InsertRunningHoursAudit,
} from "@shared/v2/running-hours/schema";

export interface RHValidationInput {
  currentRH: number;
  newRH: number;
  componentLastUpdated: string | null;
  newUpdateDate: string;
  userRole: string;
  adminOverride?: boolean;
}

export interface RHValidationResult {
  allowed: boolean;
  maxAllowedIncrease: number;
  requestedIncrease: number;
  daysSinceLastUpdate: number;
  lastUpdateDate: string | null;
  message: string;
  requiresAdminOverride: boolean;
}

const MAX_HOURS_PER_DAY = 25;

function getCalendarDate(dateStr: string): Date {
  const date = new Date(dateStr);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getDaysBetweenCalendarDates(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((date2.getTime() - date1.getTime()) / msPerDay);
}

export function validateRunningHoursIncrease(input: RHValidationInput): RHValidationResult {
  const { currentRH, newRH, componentLastUpdated, newUpdateDate, userRole, adminOverride } = input;

  const requestedIncrease = newRH - currentRH;

  if (requestedIncrease <= 0) {
    return {
      allowed: true,
      maxAllowedIncrease: 0,
      requestedIncrease,
      daysSinceLastUpdate: 0,
      lastUpdateDate: componentLastUpdated,
      message: 'No increase or decrease - no validation needed',
      requiresAdminOverride: false
    };
  }

  let daysSinceLastUpdate = 0;
  let sameDayUpdate = false;

  if (componentLastUpdated) {
    const lastCalendarDate = getCalendarDate(componentLastUpdated);
    const newCalendarDate = getCalendarDate(newUpdateDate);
    daysSinceLastUpdate = getDaysBetweenCalendarDates(lastCalendarDate, newCalendarDate);
    if (daysSinceLastUpdate === 0) {
      sameDayUpdate = true;
    }
  } else {
    daysSinceLastUpdate = 1;
  }

  let maxAllowedIncrease: number;

  if (sameDayUpdate) {
    const canOverride = userRole === 'Sail Admin' && adminOverride === true;
    return {
      allowed: canOverride,
      maxAllowedIncrease: 0,
      requestedIncrease,
      daysSinceLastUpdate: 0,
      lastUpdateDate: componentLastUpdated,
      message: canOverride
        ? 'Sail Admin override applied for same-day duplicate update'
        : 'Same-day update already performed. Only one update of max 25 hours is allowed per day.',
      requiresAdminOverride: !canOverride
    };
  } else {
    maxAllowedIncrease = daysSinceLastUpdate * MAX_HOURS_PER_DAY;
  }

  const isWithinLimit = requestedIncrease <= maxAllowedIncrease;

  if (isWithinLimit) {
    return {
      allowed: true,
      maxAllowedIncrease,
      requestedIncrease,
      daysSinceLastUpdate,
      lastUpdateDate: componentLastUpdated,
      message: `Increase of ${requestedIncrease} hours is within the allowed limit of ${maxAllowedIncrease} hours`,
      requiresAdminOverride: false
    };
  }

  const canOverride = userRole === 'Sail Admin' && adminOverride === true;

  return {
    allowed: canOverride,
    maxAllowedIncrease,
    requestedIncrease,
    daysSinceLastUpdate,
    lastUpdateDate: componentLastUpdated,
    message: canOverride
      ? `Sail Admin override applied. Increase of ${requestedIncrease} hours exceeds normal limit of ${maxAllowedIncrease} hours (${daysSinceLastUpdate} days × 25 hours/day).`
      : `Increase of ${requestedIncrease} hours exceeds maximum allowed of ${maxAllowedIncrease} hours. Maximum allowed is ${daysSinceLastUpdate} day(s) × 25 hours/day = ${maxAllowedIncrease} hours.`,
    requiresAdminOverride: !canOverride
  };
}

export function canAdminOverride(userRole: string): boolean {
  return userRole === 'Sail Admin';
}

export class RunningHoursRepository {

  async getComponent(componentId: string): Promise<Component | undefined> {
    const db = await getDb();
    const result = await db.select().from(v2Components)
      .where(eq(v2Components.id, componentId))
      .limit(1);
    return result[0] || undefined;
  }

  async getComponents(vesselId: string): Promise<Component[]> {
    const db = await getDb();
    return await db.select().from(v2Components)
      .where(and(
        eq(v2Components.vesselId, vesselId),
        eq(v2Components.dataScope, 'vessel')
      ));
  }

  async getMasterComponents(vesselId: string): Promise<Component[]> {
    const db = await getDb();
    return await db.select().from(v2Components)
      .where(and(
        eq(v2Components.vesselId, vesselId),
        eq(v2Components.rhCounterType, 'MASTER'),
        eq(v2Components.dataScope, 'vessel')
      ));
  }

  async getInheritedComponents(masterComponentId: string, vesselId?: string): Promise<Component[]> {
    const db = await getDb();

    let masterComponent = await this.getComponent(masterComponentId);

    if (!masterComponent) {
      const byCode = await db.select().from(v2Components)
        .where(eq(v2Components.componentCode, masterComponentId))
        .limit(1);
      masterComponent = byCode[0] || undefined;
    }

    const masterComponentCode = masterComponent?.componentCode || masterComponentId;
    const masterComponentFullId = masterComponent?.id || masterComponentId;
    const effectiveVesselId = vesselId || masterComponent?.vesselId;

    if (!effectiveVesselId) {
      console.warn(`⚠️ [v2/getInheritedComponents] Cannot determine vesselId for master "${masterComponentId}" - returning empty to prevent cross-vessel leak`);
      return [];
    }

    return await db.select().from(v2Components)
      .where(and(
        eq(v2Components.rhCounterType, 'INHERITED'),
        eq(v2Components.vesselId, effectiveVesselId),
        or(
          eq(v2Components.rhMasterComponentId, masterComponentFullId),
          eq(v2Components.rhMasterComponentId, masterComponentCode),
          eq(v2Components.rhMasterComponentId, masterComponentId),
          eq(v2Components.rhCounterSource, masterComponentCode)
        )
      ));
  }

  async updateComponent(componentId: string, data: Partial<Component>): Promise<Component> {
    const db = await getDb();
    const result = await db.update(v2Components)
      .set(data as any)
      .where(eq(v2Components.id, componentId))
      .returning();
    if (!result[0]) {
      throw new Error(`Component ${componentId} not found`);
    }
    return result[0];
  }

  async updateRHConfig(params: {
    componentId: string;
    rhCounterType: 'MASTER' | 'INHERITED' | 'NOT_RH_DRIVEN';
    rhMasterComponentId?: string | null;
    userId?: string;
  }): Promise<Component> {
    const db = await getDb();
    const now = new Date();

    const updateData: any = {
      rhCounterType: params.rhCounterType,
      updatedAt: now,
    };

    if (params.rhCounterType === 'MASTER') {
      updateData.rhMasterComponentId = null;
      updateData.rhCurrentInheritedCached = null;
      updateData.rhInheritedUpdatedAt = null;
      const existing = await this.getComponent(params.componentId);
      if (!existing?.rhCurrentMaster) {
        updateData.rhCurrentMaster = '0';
        updateData.rhMasterUpdatedAt = now;
        updateData.rhMasterUpdatedBy = params.userId || 'system';
        updateData.rhMasterUpdateSource = 'MANUAL';
      }
    } else if (params.rhCounterType === 'INHERITED') {
      if (!params.rhMasterComponentId) {
        throw new Error('rhMasterComponentId is required for INHERITED counter type');
      }
      updateData.rhMasterComponentId = params.rhMasterComponentId;
      updateData.rhCurrentMaster = null;
      updateData.rhMasterUpdatedAt = null;
      updateData.rhMasterUpdatedBy = null;
      updateData.rhMasterUpdateSource = null;

      const masterComponent = await this.getComponent(params.rhMasterComponentId);
      if (masterComponent) {
        updateData.rhCurrentInheritedCached = masterComponent.rhCurrentMaster || '0';
        updateData.rhInheritedUpdatedAt = now;
      }
    } else {
      updateData.rhMasterComponentId = null;
      updateData.rhCurrentMaster = null;
      updateData.rhMasterUpdatedAt = null;
      updateData.rhMasterUpdatedBy = null;
      updateData.rhMasterUpdateSource = null;
      updateData.rhCurrentInheritedCached = null;
      updateData.rhInheritedUpdatedAt = null;
    }

    const result = await db.update(v2Components)
      .set(updateData)
      .where(eq(v2Components.id, params.componentId))
      .returning();

    if (!result[0]) {
      throw new Error(`Component ${params.componentId} not found`);
    }
    return result[0];
  }

  async updateMasterRunningHours(params: {
    componentId: string;
    newRHValue: number;
    updateSource: 'MANUAL' | 'IMPORT' | 'AUTOMATION';
    userId: string;
    comments?: string;
  }): Promise<{ masterUpdated: Component; inheritedUpdated: number }> {
    const db = await getDb();
    const now = new Date();

    const component = await this.getComponent(params.componentId);
    if (!component) {
      throw new Error(`Component ${params.componentId} not found`);
    }
    if (component.rhCounterType !== 'MASTER') {
      throw new Error(`Component ${params.componentId} is not a MASTER counter type. Cannot update RH directly.`);
    }

    const previousMasterRH = parseFloat(component.rhCurrentMaster || component.currentCumulativeRH || '0');
    const delta = params.newRHValue - previousMasterRH;

    const masterResult = await db.update(v2Components)
      .set({
        rhCurrentMaster: params.newRHValue.toString(),
        currentCumulativeRH: params.newRHValue.toString(),
        rhMasterUpdatedAt: now,
        rhMasterUpdatedBy: params.userId,
        rhMasterUpdateSource: params.updateSource,
        lastUpdated: now.toISOString(),
        updatedAt: now,
      })
      .where(eq(v2Components.id, params.componentId))
      .returning();

    if (!masterResult[0]) {
      throw new Error(`Failed to update MASTER component ${params.componentId}`);
    }

    const masterComponentCode = component.componentCode || '';
    const masterVesselId = component.vesselId;

    if (!masterVesselId) {
      console.warn(`⚠️ [v2/updateMasterRunningHours] Cannot determine vesselId for master "${params.componentId}" - skipping cascade to prevent cross-vessel leak`);
      return {
        masterUpdated: masterResult[0],
        inheritedUpdated: 0,
      };
    }

    const inheritedComponents = await this.getInheritedComponents(params.componentId, masterVesselId);

    await db.insert(v2RunningHoursAudit).values({
      vesselId: masterVesselId,
      componentId: params.componentId,
      previousRH: previousMasterRH.toFixed(2),
      newRH: params.newRHValue.toFixed(2),
      cumulativeRH: params.newRHValue.toFixed(2),
      dateUpdatedLocal: now.toISOString().split('T')[0],
      dateUpdatedTZ: 'UTC',
      enteredAtUTC: now,
      userId: params.userId,
      source: params.updateSource.toLowerCase(),
      notes: params.comments || null,
      meterReplaced: false,
      version: 1,
      componentCode: masterComponentCode,
      componentName: component.name || null,
    });

    let inheritedUpdated = 0;
    for (const inherited of inheritedComponents) {
      const currentChildRH = parseFloat(inherited.currentCumulativeRH || inherited.rhCurrentInheritedCached || '0');
      const newChildRH = Math.max(0, currentChildRH + delta);

      await db.update(v2Components)
        .set({
          rhCurrentInheritedCached: params.newRHValue.toString(),
          currentCumulativeRH: newChildRH.toString(),
          rhInheritedUpdatedAt: now,
          lastUpdated: now.toISOString(),
          updatedAt: now,
        })
        .where(eq(v2Components.id, inherited.id));

      inheritedUpdated++;
    }

    return {
      masterUpdated: masterResult[0],
      inheritedUpdated,
    };
  }

  async cascadeRunningHoursUpdate(params: {
    parentComponentId: string;
    mode: 'setTotal' | 'addDelta';
    value: number;
    dateUpdated: string;
    comments?: string;
    meterReplaced?: boolean;
    oldMeterFinal?: string;
    newMeterStart?: string;
    isRenewalReset?: boolean;
    renewalActionType?: string;
    renewalReason?: string;
    renewalReference?: string;
    renewalEvidenceUrls?: string[];
  }): Promise<{ updatedComponents: number; auditsCreated: number; workOrdersGenerated: number; workOrders: any[] }> {
    const db = await getDb();
    const { parentComponentId, mode, value, dateUpdated, comments, meterReplaced, oldMeterFinal, newMeterStart, isRenewalReset, renewalActionType, renewalReason, renewalReference, renewalEvidenceUrls } = params;
    const now = new Date();

    const children = await db.select().from(v2Components)
      .where(eq(v2Components.parentId, parentComponentId));

    const parentResult = await db.select().from(v2Components)
      .where(eq(v2Components.id, parentComponentId))
      .limit(1);

    let updatedComponents = 0;
    let auditsCreated = 0;
    let newRH = 0;

    if (parentResult.length > 0) {
      const parent = parentResult[0];
      const currentRH = parseFloat(parent.currentCumulativeRH || parent.rhCurrentMaster || '0');

      const latestAudit = await db.select()
        .from(v2RunningHoursAudit)
        .where(eq(v2RunningHoursAudit.componentId, parentComponentId))
        .orderBy(desc(v2RunningHoursAudit.enteredAtUTC))
        .limit(1);

      if (latestAudit.length > 0) {
        const latestDate = latestAudit[0].dateUpdatedLocal;
        const parseDate = (dateStr: string): Date => {
          const months: Record<string, number> = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };
          const parts = dateStr.match(/(\d{2})-([A-Za-z]{3})-(\d{4})\s*(\d{2})?:?(\d{2})?/);
          if (parts) {
            const [, day, month, year, hours = '00', minutes = '00'] = parts;
            return new Date(parseInt(year), months[month], parseInt(day), parseInt(hours), parseInt(minutes));
          }
          return new Date(dateStr);
        };

        const latestParsedDate = parseDate(latestDate);
        const newParsedDate = parseDate(dateUpdated);

        if (newParsedDate < latestParsedDate) {
          throw new Error(`Invalid date. You cannot add a Running Hours entry earlier than the latest saved entry date (${latestDate}).`);
        }
      }

      if (mode === 'setTotal' && value < currentRH && !isRenewalReset) {
        throw new Error(`Invalid Running Hours. Reading cannot be less than the last saved reading (Last: ${currentRH}).`);
      }

      if (mode === 'setTotal' && value === 0 && !isRenewalReset) {
        throw new Error('Running Hours cannot be set to 0 without confirming renewal/replacement.');
      }

      let previousTotalForReplacement = 0;
      if (meterReplaced) {
        const existingMeterReplacedLastRh = parseFloat(parent.meterReplacedLastRh || '0');
        previousTotalForReplacement = existingMeterReplacedLastRh + currentRH;
        newRH = value;
      } else {
        newRH = mode === 'addDelta' ? currentRH + value : value;
      }

      const updateData: any = {
        currentCumulativeRH: newRH.toString(),
        lastUpdated: dateUpdated,
        updatedAt: now
      };

      if (meterReplaced) {
        updateData.meterReplacedLastRh = previousTotalForReplacement.toString();
        updateData.meterReplacedDate = now;
      }

      if (parent.rhCounterType === 'MASTER') {
        updateData.rhCurrentMaster = newRH.toString();
        updateData.rhMasterUpdatedAt = now;
        updateData.rhMasterUpdateSource = 'MANUAL';
      }

      await db.update(v2Components)
        .set(updateData)
        .where(eq(v2Components.id, parentComponentId));

      const totalCumulativeRH = meterReplaced
        ? previousTotalForReplacement + newRH
        : (parseFloat(parent.meterReplacedLastRh || '0') + newRH);

      await db.insert(v2RunningHoursAudit).values({
        vesselId: parent.vesselId || 'unknown',
        componentId: parentComponentId,
        previousRH: currentRH.toString(),
        newRH: newRH.toString(),
        cumulativeRH: totalCumulativeRH.toString(),
        dateUpdatedLocal: dateUpdated,
        dateUpdatedTZ: 'UTC',
        enteredAtUTC: now,
        userId: 'system',
        source: 'cascade',
        notes: meterReplaced
          ? `Meter replaced. Old meter final: ${oldMeterFinal || currentRH}. New meter start: ${newMeterStart || value}. ${comments || ''}`
          : comments,
        meterReplaced: meterReplaced || false,
        isRenewalReset: isRenewalReset || false,
        renewalActionType: renewalActionType || null,
        renewalReason: renewalReason || null,
        renewalReference: renewalReference || null,
        renewalEvidenceUrls: renewalEvidenceUrls || null,
        componentCode: parent.componentCode || null,
        componentName: parent.name || null,
      });

      updatedComponents++;
      auditsCreated++;

      if (parent.rhCounterType === 'MASTER') {
        const masterComponentCode = parent.componentCode || '';
        const masterVesselId = parent.vesselId;

        if (!masterVesselId) {
          console.warn(`⚠️ [v2/cascadeRunningHoursUpdate] Cannot determine vesselId for master "${parentComponentId}" - skipping inherited cascade to prevent cross-vessel leak`);
        } else {
          const inheritedComponents = await db.select().from(v2Components)
            .where(and(
              eq(v2Components.rhCounterType, 'INHERITED'),
              eq(v2Components.vesselId, masterVesselId),
              or(
                eq(v2Components.rhMasterComponentId, parentComponentId),
                eq(v2Components.rhMasterComponentId, masterComponentCode),
                eq(v2Components.rhCounterSource, masterComponentCode)
              )
            ));

          const delta = newRH - currentRH;

          for (const inherited of inheritedComponents) {
            const inheritedCurrentRH = parseFloat(inherited.currentCumulativeRH || inherited.rhCurrentInheritedCached || '0');
            const newInheritedRH = inheritedCurrentRH + delta;

            await db.update(v2Components)
              .set({
                rhCurrentInheritedCached: newRH.toString(),
                rhInheritedUpdatedAt: now,
                currentCumulativeRH: newInheritedRH.toString(),
                lastUpdated: dateUpdated,
                updatedAt: now
              })
              .where(eq(v2Components.id, inherited.id));

            await db.insert(v2RunningHoursAudit).values({
              vesselId: inherited.vesselId || 'unknown',
              componentId: inherited.id,
              previousRH: inheritedCurrentRH.toString(),
              newRH: newInheritedRH.toString(),
              cumulativeRH: newInheritedRH.toString(),
              dateUpdatedLocal: dateUpdated,
              dateUpdatedTZ: 'UTC',
              enteredAtUTC: now,
              userId: 'system',
              source: 'inherited_cascade',
              notes: `Inherited delta ${delta} from MASTER ${parent.componentCode || parent.name}`,
            });

            updatedComponents++;
            auditsCreated++;
          }
        }
      }
    }

    const structuralDelta = mode === 'addDelta' ? value : (newRH - parseFloat(parentResult[0]?.currentCumulativeRH || '0'));

    for (const child of children) {
      const childCurrentRH = parseFloat(child.currentCumulativeRH || '0');
      const childNewRH = childCurrentRH + structuralDelta;

      const childUpdateData: any = {
        currentCumulativeRH: childNewRH.toString(),
        lastUpdated: dateUpdated,
        updatedAt: now
      };

      if (child.rhCounterType === 'MASTER') {
        childUpdateData.rhCurrentMaster = childNewRH.toString();
        childUpdateData.rhMasterUpdatedAt = now;
      }

      if (child.rhCounterType === 'INHERITED' && child.rhMasterComponentId === parentComponentId) {
        childUpdateData.rhCurrentInheritedCached = newRH.toString();
        childUpdateData.rhInheritedUpdatedAt = now;
      }

      await db.update(v2Components)
        .set(childUpdateData)
        .where(eq(v2Components.id, child.id));

      await db.insert(v2RunningHoursAudit).values({
        vesselId: child.vesselId || 'unknown',
        componentId: child.id,
        previousRH: childCurrentRH.toString(),
        newRH: childNewRH.toString(),
        cumulativeRH: childNewRH.toString(),
        dateUpdatedLocal: dateUpdated,
        dateUpdatedTZ: 'UTC',
        enteredAtUTC: now,
        userId: 'system',
        source: 'cascade',
        notes: comments,
      });

      updatedComponents++;
      auditsCreated++;
    }

    return {
      updatedComponents,
      auditsCreated,
      workOrdersGenerated: 0,
      workOrders: []
    };
  }

  async createRunningHoursAudit(audit: InsertRunningHoursAudit): Promise<RunningHoursAudit> {
    const db = await getDb();
    const result = await db.insert(v2RunningHoursAudit).values(audit).returning();
    return result[0];
  }

  async getRunningHoursAudits(componentId: string, limit?: number): Promise<RunningHoursAudit[]> {
    const db = await getDb();
    let query = db.select().from(v2RunningHoursAudit)
      .where(eq(v2RunningHoursAudit.componentId, componentId))
      .orderBy(desc(v2RunningHoursAudit.enteredAtUTC));

    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async getRunningHoursAuditsForVessel(vesselId: string): Promise<RunningHoursAudit[]> {
    const db = await getDb();
    return await db.select().from(v2RunningHoursAudit)
      .where(eq(v2RunningHoursAudit.vesselId, vesselId))
      .orderBy(desc(v2RunningHoursAudit.enteredAtUTC));
  }

  async getRunningHoursAuditsInDateRange(
    componentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RunningHoursAudit[]> {
    const db = await getDb();
    return await db.select().from(v2RunningHoursAudit)
      .where(and(
        eq(v2RunningHoursAudit.componentId, componentId),
        gte(v2RunningHoursAudit.enteredAtUTC, startDate),
        lte(v2RunningHoursAudit.enteredAtUTC, endDate)
      ))
      .orderBy(desc(v2RunningHoursAudit.enteredAtUTC));
  }
}

export const runningHoursRepository = new RunningHoursRepository();
