import {
  runningHoursRepository,
  validateRunningHoursIncrease,
  canAdminOverride,
  type RHValidationInput,
  type RHValidationResult,
} from "../repositories/runningHoursRepository";
import type {
  Component,
  RunningHoursAudit,
  InsertRunningHoursAudit,
} from "@shared/v2/running-hours/schema";

export class RunningHoursService {

  async getRunningHoursAuditsForVessel(vesselId: string): Promise<RunningHoursAudit[]> {
    return runningHoursRepository.getRunningHoursAuditsForVessel(vesselId);
  }

  async getRunningHoursAuditsForComponent(componentId: string, limit?: number): Promise<RunningHoursAudit[]> {
    return runningHoursRepository.getRunningHoursAudits(componentId, limit);
  }

  async createRunningHoursAudit(auditData: InsertRunningHoursAudit): Promise<RunningHoursAudit> {
    return runningHoursRepository.createRunningHoursAudit(auditData);
  }

  async getParents(vesselId: string) {
    const allComponents = await runningHoursRepository.getComponents(vesselId);
    const masterComponents = allComponents.filter(c => c.rhCounterType === 'MASTER');

    const parentsWithCounts = await Promise.all(
      masterComponents.map(async (component) => {
        const inheritedComponents = await runningHoursRepository.getInheritedComponents(component.id, vesselId);

        const meterReplacedLastRh = parseFloat(component.meterReplacedLastRh || '0');
        const currentMeterRH = parseFloat(component.rhCurrentMaster || component.currentCumulativeRH || '0');
        const totalCumulativeRH = meterReplacedLastRh + currentMeterRH;

        return {
          ...component,
          sfiCode: component.componentCode || '',
          latestUpdate: component.lastUpdated || (component.rhMasterUpdatedAt ? new Date(component.rhMasterUpdatedAt).toISOString() : null) || (component.updatedAt ? new Date(component.updatedAt).toISOString() : null) || new Date().toISOString(),
          currentCumulativeRH: totalCumulativeRH.toFixed(2),
          currentMeterRH: currentMeterRH.toFixed(2),
          meterReplacedLastRh: meterReplacedLastRh > 0 ? meterReplacedLastRh.toFixed(2) : null,
          meterReplacedDate: component.meterReplacedDate || null,
          inheritedCount: inheritedComponents.length
        };
      })
    );

    parentsWithCounts.sort((a, b) => (a.componentCode || '').localeCompare(b.componentCode || ''));
    return parentsWithCounts;
  }

  async getChildren(parentCode: string, vesselId: string) {
    const allComponents = await runningHoursRepository.getComponents(vesselId);
    const parent = allComponents.find(c => c.componentCode === parentCode || c.id === parentCode);

    if (!parent) {
      return null;
    }

    const children = await runningHoursRepository.getInheritedComponents(parent.id, vesselId);

    const childrenWithRH = children.map(child => {
      const displayRH = child.currentCumulativeRH || child.rhCurrentInheritedCached || '0.00';
      return {
        id: child.id,
        componentCode: child.componentCode || '',
        name: child.name || '',
        currentCumulativeRH: displayRH,
        rhCounterType: child.rhCounterType || 'INHERITED',
        lastUpdated: child.lastUpdated || (child.updatedAt ? new Date(child.updatedAt).toISOString() : '-')
      };
    });

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

  async updateChildRH(componentId: string, newRHValue: number, comments?: string, userId?: string, userRole?: string, adminOverride?: boolean, dateUpdated?: string) {
    const component = await runningHoursRepository.getComponent(componentId);
    if (!component) {
      return { error: 'Component not found', status: 404 };
    }

    if (component.rhCounterType === 'MASTER') {
      return { error: 'Cannot update MASTER component via this endpoint. Use the Update RH button instead.', status: 400 };
    }

    const previousRH = component.currentCumulativeRH || '0.00';
    const currentRHValue = parseFloat(previousRH);

    const componentLastUpdated = component.lastUpdated
      || (component.rhMasterUpdatedAt ? new Date(component.rhMasterUpdatedAt).toISOString() : null)
      || (component.updatedAt ? new Date(component.updatedAt).toISOString() : null);

    const validation = validateRunningHoursIncrease({
      currentRH: currentRHValue,
      newRH: newRHValue,
      componentLastUpdated: componentLastUpdated,
      newUpdateDate: dateUpdated || new Date().toISOString(),
      userRole: userRole || 'Ship',
      adminOverride: adminOverride || false
    });

    if (!validation.allowed) {
      return {
        error: validation.message,
        status: 400,
        validation: {
          maxAllowedIncrease: validation.maxAllowedIncrease,
          requestedIncrease: validation.requestedIncrease,
          daysSinceLastUpdate: validation.daysSinceLastUpdate,
          lastUpdateDate: validation.lastUpdateDate,
          requiresAdminOverride: validation.requiresAdminOverride,
          canOverride: canAdminOverride(userRole || 'Ship')
        }
      };
    }

    const newRHFormatted = newRHValue.toFixed(2);

    await runningHoursRepository.updateComponent(componentId, {
      currentCumulativeRH: newRHFormatted,
      runningHours: newRHFormatted,
      lastUpdated: new Date().toISOString()
    } as any);

    await runningHoursRepository.createRunningHoursAudit({
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

  async resetChildRH(componentId: string, oldMeterFinal?: string, userId?: string, notes?: string) {
    const component = await runningHoursRepository.getComponent(componentId);
    if (!component) {
      return { error: 'Component not found', status: 404 };
    }

    const previousRH = component.currentCumulativeRH || '0.00';

    await runningHoursRepository.updateComponent(componentId, {
      currentCumulativeRH: '0.00',
      runningHours: '0.00',
      lastUpdated: new Date().toISOString()
    } as any);

    await runningHoursRepository.createRunningHoursAudit({
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

  async getMasterComponentsForDropdown(vesselId: string) {
    const masterComponents = await runningHoursRepository.getMasterComponents(vesselId);
    return masterComponents.map(c => ({
      id: c.id,
      componentCode: c.componentCode,
      name: c.name,
      rhCurrentMaster: c.rhCurrentMaster || '0',
      rhMasterUpdatedAt: c.rhMasterUpdatedAt
    }));
  }

  async getRHConfig(componentId: string) {
    const component = await runningHoursRepository.getComponent(componentId);
    if (!component) {
      return null;
    }

    let rhMasterComponentName: string | null = null;
    let masterComponent: Component | undefined;
    if (component.rhCounterType === 'INHERITED' && component.rhMasterComponentId) {
      masterComponent = await runningHoursRepository.getComponent(component.rhMasterComponentId);
      rhMasterComponentName = masterComponent?.name || null;
    }

    let rhCurrentValue: string | null = null;
    let rhLastUpdated: Date | null = null;

    if (component.rhCounterType === 'MASTER') {
      rhCurrentValue = component.rhCurrentMaster;
      rhLastUpdated = component.rhMasterUpdatedAt;
    } else if (component.rhCounterType === 'INHERITED') {
      if (masterComponent) {
        rhCurrentValue = masterComponent.rhCurrentMaster;
        rhLastUpdated = masterComponent.rhMasterUpdatedAt;
      } else {
        rhCurrentValue = component.rhCurrentInheritedCached;
        rhLastUpdated = component.rhInheritedUpdatedAt;
      }
    }

    return {
      componentId: component.id,
      componentName: component.name,
      rhCounterType: component.rhCounterType,
      rhMasterComponentId: component.rhMasterComponentId,
      rhMasterComponentName,
      rhCurrentValue,
      rhLastUpdated,
      rhUpdateSource: component.rhMasterUpdateSource
    };
  }

  async updateRHConfig(componentId: string, rhCounterType: 'MASTER' | 'INHERITED' | 'NOT_RH_DRIVEN', rhMasterComponentId?: string | null, userId?: string) {
    const component = await runningHoursRepository.getComponent(componentId);
    if (!component) {
      return { error: 'Component not found', status: 404 };
    }

    if (rhCounterType === 'INHERITED' && rhMasterComponentId === componentId) {
      return { error: 'A component cannot inherit running hours from itself', status: 400 };
    }

    if (rhCounterType === 'INHERITED') {
      if (!rhMasterComponentId) {
        return { error: 'rhMasterComponentId is required for INHERITED counter type', status: 400 };
      }

      const masterComponent = await runningHoursRepository.getComponent(rhMasterComponentId);
      if (!masterComponent) {
        return { error: 'Master component not found', status: 400 };
      }

      if (masterComponent.vesselId !== component.vesselId) {
        return { error: 'Master component must be from the same vessel', status: 400 };
      }

      if (masterComponent.rhCounterType !== 'MASTER') {
        return { error: 'Selected component is not configured as a MASTER counter type', status: 400 };
      }
    }

    if (component.rhCounterType === 'MASTER' && rhCounterType !== 'MASTER') {
      const dependents = await runningHoursRepository.getInheritedComponents(componentId);
      if (dependents.length > 0) {
        const dependentNames = dependents.slice(0, 3).map(d => d.name).join(', ');
        const moreCount = dependents.length > 3 ? ` and ${dependents.length - 3} more` : '';
        return {
          error: `Cannot change from MASTER: ${dependents.length} component(s) inherit from this counter (${dependentNames}${moreCount}). Reassign them first.`,
          status: 400
        };
      }
    }

    const updatedComponent = await runningHoursRepository.updateRHConfig({
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

  async updateMasterRH(componentId: string, newRHValue: number, updateSource: 'MANUAL' | 'IMPORT' | 'AUTOMATION', userId: string, userRole: string, adminOverride: boolean, comments?: string, dateUpdated?: string) {
    const component = await runningHoursRepository.getComponent(componentId);
    if (!component) {
      return { error: 'Component not found', status: 404 };
    }

    if (component.rhCounterType !== 'MASTER') {
      return { error: 'Running hours can only be updated for MASTER counter type components', status: 400 };
    }

    if (updateSource === 'MANUAL') {
      const currentRHValue = parseFloat(component.rhCurrentMaster || component.currentCumulativeRH || '0');
      const lastUpdate = component.lastUpdated
        || (component.rhMasterUpdatedAt ? new Date(component.rhMasterUpdatedAt).toISOString() : null)
        || (component.updatedAt ? new Date(component.updatedAt).toISOString() : null);
      const validation = validateRunningHoursIncrease({
        currentRH: currentRHValue,
        newRH: newRHValue,
        componentLastUpdated: lastUpdate,
        newUpdateDate: dateUpdated || new Date().toISOString(),
        userRole: userRole || 'Ship',
        adminOverride: adminOverride || false
      });

      if (!validation.allowed) {
        return {
          error: validation.message,
          status: 400,
          validation: {
            maxAllowedIncrease: validation.maxAllowedIncrease,
            requestedIncrease: validation.requestedIncrease,
            daysSinceLastUpdate: validation.daysSinceLastUpdate,
            lastUpdateDate: validation.lastUpdateDate,
            requiresAdminOverride: validation.requiresAdminOverride,
            canOverride: canAdminOverride(userRole || 'Ship')
          }
        };
      }
    }

    const result = await runningHoursRepository.updateMasterRunningHours({
      componentId,
      newRHValue,
      updateSource,
      userId,
      comments
    });

    return {
      success: true,
      message: `Master RH updated to ${newRHValue}. Cascaded to ${result.inheritedUpdated} inherited components.`,
      masterUpdated: result.masterUpdated,
      inheritedUpdated: result.inheritedUpdated,
    };
  }

  async getInheritedComponentsList(masterComponentId: string) {
    const inheritedComponents = await runningHoursRepository.getInheritedComponents(masterComponentId);
    return inheritedComponents.map(c => ({
      id: c.id,
      componentCode: c.componentCode,
      name: c.name,
      rhCurrentInheritedCached: c.rhCurrentInheritedCached || '0',
      rhInheritedUpdatedAt: c.rhInheritedUpdatedAt
    }));
  }

  async propagateAll(vesselId: string, userId: string) {
    const allComponents = await runningHoursRepository.getComponents(vesselId);
    const masterComponents = allComponents.filter(c => c.rhCounterType === 'MASTER');

    let totalMastersProcessed = 0;
    let totalInheritedUpdated = 0;
    const results: { masterCode: string; masterName: string; rhValue: string; inheritedUpdated: number }[] = [];

    for (const master of masterComponents) {
      const currentRH = parseFloat(master.currentCumulativeRH || master.rhCurrentMaster || '0');

      if (currentRH > 0) {
        try {
          const result = await runningHoursRepository.updateMasterRunningHours({
            componentId: master.id,
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
          console.error(`[v2] Failed to propagate RH for master ${master.componentCode}:`, err);
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

  validateRunningHoursUpdate(updateData: { componentId?: string; newRunningHours?: number | null; updatedBy?: string }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!updateData.componentId) errors.push('Component ID is required');
    if (updateData.newRunningHours === undefined || updateData.newRunningHours === null) {
      errors.push('New running hours value is required');
    } else if (updateData.newRunningHours < 0) {
      errors.push('Running hours cannot be negative');
    }
    if (!updateData.updatedBy) errors.push('Updated by is required');
    return { valid: errors.length === 0, errors };
  }

  async getLatestRunningHours(componentId: string): Promise<number | null> {
    const component = await runningHoursRepository.getComponent(componentId);
    if (!component || !component.runningHours) return null;
    return typeof component.runningHours === 'string' ? parseFloat(component.runningHours) : component.runningHours;
  }

  calculateDelta(oldValue: number, newValue: number): number {
    return newValue - oldValue;
  }

  isRealisticUpdate(oldValue: number, newValue: number, maxHourlyIncrease: number = 24): boolean {
    const delta = newValue - oldValue;
    if (delta < 0) return false;
    if (delta > maxHourlyIncrease) return false;
    return true;
  }
}

export const runningHoursService = new RunningHoursService();
