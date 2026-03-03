import * as repo from '../repositories/componentRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { Component, InsertComponent } from '@shared/schema';

export async function listByVessel(vesselId: string): Promise<Component[]> {
  return repo.findByVesselId(vesselId);
}

export async function listAll(vesselId?: string): Promise<Component[]> {
  if (vesselId) {
    return repo.findByVesselId(vesselId);
  }
  return repo.findAll();
}

export async function getById(id: string): Promise<Component | undefined> {
  return repo.findById(id);
}

export async function create(data: any): Promise<Component> {
  const mandatoryFields: { key: string; label: string; isBoolean?: boolean }[] = [
    { key: 'name', label: 'Component Name' },
    { key: 'componentCode', label: 'Component Code' },
    { key: 'parentId', label: 'Parent Component Code' },
    { key: 'componentCategory', label: 'Component Category' },
    { key: 'model', label: 'Model' },
    { key: 'modelCode', label: 'Model Code' },
    { key: 'critical', label: 'Criticality', isBoolean: true },
    { key: 'conditionBased', label: 'Condition Based', isBoolean: true },
    { key: 'eqptSystemDept', label: 'Equipment / System Department' },
    { key: 'isActive', label: 'Is Active', isBoolean: true },
  ];
  const missing = mandatoryFields.filter(f => {
    const val = data[f.key];
    if (f.isBoolean) return val === undefined || val === null || val === '';
    return !val || (typeof val === 'string' && val.trim() === '');
  }).map(f => f.label);
  if (missing.length > 0) {
    throw new ValidationError(`Missing mandatory fields: ${missing.join(', ')}`);
  }

  // RH field validation (B7.B rules)
  const effectiveRhType = data.rhCounterType || 'NOT_RH_DRIVEN';

  if (data.rhCounterType || data.rhMasterComponentId) {
    if (effectiveRhType === 'MASTER') {
      if (data.rhMasterComponentId) {
        throw new ValidationError('MASTER counter type cannot have a master component reference');
      }
    } else if (effectiveRhType === 'INHERITED') {
      if (!data.rhMasterComponentId) {
        throw new ValidationError('INHERITED counter type requires rhMasterComponentId');
      }
      const masterComponent = await repo.findById(data.rhMasterComponentId);
      if (!masterComponent) {
        throw new ValidationError('Master component not found');
      }
      if (masterComponent.vesselId !== data.vesselId) {
        throw new ValidationError('Master component must be from the same vessel');
      }
      if (masterComponent.rhCounterType !== 'MASTER') {
        throw new ValidationError('Referenced component is not a MASTER counter type');
      }
    } else if (effectiveRhType === 'NOT_RH_DRIVEN') {
      if (data.rhMasterComponentId) {
        throw new ValidationError('NOT_RH_DRIVEN counter type cannot have a master component reference');
      }
    }
  }

  const component = await repo.create(data);
  console.log('[API_CREATE] New component:', {
    id: component.cuuid,
    code: component.componentCode,
    parentId: component.parentId,
    vesselId: component.vesselId
  });
  return component;
}

export async function update(id: string, data: any, userId: string): Promise<Component> {
  console.log(`🔧 PATCH /api/components/${id} with:`, JSON.stringify(data, null, 2).substring(0, 500));

  const existingComponent = await repo.findById(id);
  if (!existingComponent) {
    throw new NotFoundError('Component not found');
  }

  const mandatoryPatchFields: { key: string; label: string; isBoolean?: boolean }[] = [
    { key: 'name', label: 'Component Name' },
    { key: 'componentCode', label: 'Component Code' },
    { key: 'parentId', label: 'Parent Component Code' },
    { key: 'componentCategory', label: 'Component Category' },
    { key: 'model', label: 'Model' },
    { key: 'modelCode', label: 'Model Code' },
    { key: 'critical', label: 'Criticality', isBoolean: true },
    { key: 'conditionBased', label: 'Condition Based', isBoolean: true },
    { key: 'eqptSystemDept', label: 'Equipment / System Department' },
    { key: 'isActive', label: 'Is Active', isBoolean: true },
  ];
  const invalidPatch = mandatoryPatchFields.filter(f => {
    if (!(f.key in data)) return false;
    const val = data[f.key];
    if (f.isBoolean) return val === undefined || val === null || val === '';
    return val === null || val === '' || (typeof val === 'string' && val.trim() === '');
  }).map(f => f.label);
  if (invalidPatch.length > 0) {
    throw new ValidationError(`Cannot set mandatory fields to empty: ${invalidPatch.join(', ')}`);
  }

  // RH field validation (B7.B rules)
  const effectiveRhType = data.rhCounterType || existingComponent.rhCounterType || 'NOT_RH_DRIVEN';
  const effectiveMasterId = data.rhMasterComponentId !== undefined
    ? data.rhMasterComponentId
    : existingComponent.rhMasterComponentId;

  if (data.rhCounterType || data.rhMasterComponentId !== undefined) {
    if (effectiveRhType === 'MASTER') {
      if (effectiveMasterId) {
        throw new ValidationError('MASTER counter type cannot have a master component reference');
      }
    } else if (effectiveRhType === 'INHERITED') {
      if (!effectiveMasterId) {
        throw new ValidationError('INHERITED counter type requires rhMasterComponentId');
      }
      if (effectiveMasterId === id) {
        throw new ValidationError('A component cannot inherit running hours from itself');
      }
      const masterComponent = await repo.findById(effectiveMasterId);
      if (!masterComponent) {
        throw new ValidationError('Master component not found');
      }
      if (masterComponent.vesselId !== existingComponent.vesselId) {
        throw new ValidationError('Master component must be from the same vessel');
      }
      if (masterComponent.rhCounterType !== 'MASTER') {
        throw new ValidationError('Referenced component is not a MASTER counter type');
      }
    } else if (effectiveRhType === 'NOT_RH_DRIVEN') {
      if (effectiveMasterId) {
        throw new ValidationError('NOT_RH_DRIVEN counter type cannot have a master component reference');
      }
    }

    // Downgrade protection
    if (existingComponent.rhCounterType === 'MASTER' && effectiveRhType !== 'MASTER') {
      const dependents = await repo.getInheritedComponents(id);
      if (dependents.length > 0) {
        const dependentNames = dependents.slice(0, 3).map((d: any) => d.name).join(', ');
        const moreCount = dependents.length > 3 ? ` and ${dependents.length - 3} more` : '';
        throw new ValidationError(
          `Cannot change from MASTER: ${dependents.length} component(s) inherit from this counter (${dependentNames}${moreCount}). Reassign them first.`
        );
      }
    }
  }

  // INTERCEPT RH UPDATES
  let component;
  if (data.currentCumulativeRH !== undefined || data.runningHours !== undefined) {
    const rhValue = parseFloat(data.currentCumulativeRH || data.runningHours || '0');
    if (!isNaN(rhValue)) {
      const result = await repo.setRunningHours({
        componentId: id,
        newRHValue: rhValue,
        updateSource: 'MANUAL',
        userId,
        lastUpdatedDate: data.lastUpdated
      });
      console.log(`🔄 RH Update: synced ${result.inheritedUpdated} inherited components`);

      const { currentCumulativeRH, runningHours, lastUpdated, ...otherData } = data;
      if (Object.keys(otherData).length > 0) {
        component = await repo.update(id, otherData);
      } else {
        component = result.component;
      }
    } else {
      component = await repo.update(id, data);
    }
  } else {
    component = await repo.update(id, data);
  }

  console.log(`✅ Updated component:`, component.componentCode, '| vesselId:', component.vesselId, '| parentId:', component.parentId);
  return component;
}

export async function updateSortOrder(body: any) {
  const { z } = await import('zod');
  const sortOrderSchema = z.object({
    updates: z.array(z.object({
      id: z.string(),
      sortOrder: z.number(),
    })),
  });
  const { updates } = sortOrderSchema.parse(body);
  return repo.updateSortOrder(updates);
}

export async function remove(id: string): Promise<void> {
  return repo.remove(id);
}

export async function inactivate(id: string, userId: string, cascadeInactivate: boolean = false) {
  return repo.inactivate(id, userId, { cascadeInactivate });
}
