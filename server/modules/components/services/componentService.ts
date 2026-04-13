import * as repo from '../repositories/componentRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { Component, InsertComponent } from '@shared/schema';
import { makerList } from '@shared/schema';
import { eq, and, ilike } from 'drizzle-orm';
import { db } from '../../../db';

const ALLOWED_DEPARTMENTS = ['Engine', 'Deck', 'Electrical', 'Galley', 'LSA', 'FFA'];

async function validateMaker(makerName?: string, makerCode?: string) {
  const hasName = makerName && makerName.trim();
  const hasCode = makerCode && makerCode.trim();
  if (!hasName && !hasCode) return;

  if (hasName && hasCode) {
    const matches = await db.select().from(makerList)
      .where(and(
        ilike(makerList.makerName, makerName!.trim()),
        eq(makerList.makerCode, makerCode!.trim())
      ));
    if (matches.length === 0) {
      throw new ValidationError('Maker and Maker Code combination not found in Maker List. Please select a valid Maker.');
    }
  } else if (hasName) {
    const matches = await db.select().from(makerList)
      .where(ilike(makerList.makerName, makerName!.trim()));
    if (matches.length === 0) {
      throw new ValidationError('Maker not found in Maker List. Please select a valid Maker.');
    }
  } else if (hasCode) {
    const matches = await db.select().from(makerList)
      .where(eq(makerList.makerCode, makerCode!.trim()));
    if (matches.length === 0) {
      throw new ValidationError('Maker Code not found in Maker List.');
    }
  }
}

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
  const isParent = data.isParent === true || data.isParent === 'Yes';
  const parentOptionalKeys = ['eqptSystemDept'];

  const allMandatoryFields: { key: string; label: string; isBoolean?: boolean }[] = [
    { key: 'name', label: 'Component Name' },
    { key: 'componentCode', label: 'Component Code' },
    { key: 'parentId', label: 'Parent Component Code' },
    { key: 'componentCategory', label: 'Component Category' },
    { key: 'eqptSystemDept', label: 'Equipment / System Department' },
    { key: 'isActive', label: 'Is Active', isBoolean: true },
  ];
  const mandatoryFields = isParent
    ? allMandatoryFields.filter(f => !parentOptionalKeys.includes(f.key))
    : allMandatoryFields;

  const missing = mandatoryFields.filter(f => {
    const val = data[f.key];
    if (f.isBoolean) return val === undefined || val === null || val === '';
    return !val || (typeof val === 'string' && val.trim() === '');
  }).map(f => f.label);
  if (missing.length > 0) {
    throw new ValidationError(`Missing mandatory fields: ${missing.join(', ')}`);
  }

  if (data.eqptSystemDept && !ALLOWED_DEPARTMENTS.includes(data.eqptSystemDept)) {
    throw new ValidationError(`Invalid Equipment / System Department. Allowed values are: ${ALLOWED_DEPARTMENTS.join(', ')}.`);
  }

  await validateMaker(data.maker, data.makerCode);

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
      const masterComponent = await repo.findByIdOrCode(data.rhMasterComponentId, data.vesselId);
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

  const effectiveIsParent = data.isParent !== undefined ? (data.isParent === true || data.isParent === 'Yes') : (existingComponent as any).isParent === true;
  const parentOptionalKeys = ['eqptSystemDept'];

  const allMandatoryPatchFields: { key: string; label: string; isBoolean?: boolean }[] = [
    { key: 'name', label: 'Component Name' },
    { key: 'componentCode', label: 'Component Code' },
    { key: 'parentId', label: 'Parent Component Code' },
    { key: 'componentCategory', label: 'Component Category' },
    { key: 'eqptSystemDept', label: 'Equipment / System Department' },
    { key: 'isActive', label: 'Is Active', isBoolean: true },
  ];
  const mandatoryPatchFields = effectiveIsParent
    ? allMandatoryPatchFields.filter(f => !parentOptionalKeys.includes(f.key))
    : allMandatoryPatchFields;

  const invalidPatch = mandatoryPatchFields.filter(f => {
    if (!(f.key in data)) return false;
    const val = data[f.key];
    if (f.isBoolean) return val === undefined || val === null || val === '';
    return val === null || val === '' || (typeof val === 'string' && val.trim() === '');
  }).map(f => f.label);
  if (invalidPatch.length > 0) {
    throw new ValidationError(`Cannot set mandatory fields to empty: ${invalidPatch.join(', ')}`);
  }

  if (data.eqptSystemDept !== undefined && data.eqptSystemDept !== null && data.eqptSystemDept !== '' && !ALLOWED_DEPARTMENTS.includes(data.eqptSystemDept)) {
    throw new ValidationError(`Invalid Equipment / System Department. Allowed values are: ${ALLOWED_DEPARTMENTS.join(', ')}.`);
  }

  if (data.maker !== undefined || data.makerCode !== undefined) {
    await validateMaker(data.maker, data.makerCode);
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
      const masterComponent = await repo.findByIdOrCode(effectiveMasterId, existingComponent.vesselId);
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
    reparents: z.array(z.object({
      id: z.string(),
      newParentCode: z.string(),
    })).optional().default([]),
  });
  const { updates, reparents } = sortOrderSchema.parse(body);
  if (reparents.length > 0) {
    return repo.updateHierarchyAndSortOrder(updates, reparents);
  }
  return repo.updateSortOrder(updates);
}

export async function remove(id: string): Promise<void> {
  return repo.remove(id);
}

export async function inactivate(id: string, vesselId: string, userId: string) {
  return repo.inactivate(id, vesselId, userId);
}
