/**
 * Rotational Items — service layer.
 *
 * Physical parts identified by a unique Stamp; RH history follows the stamp,
 * not the equipment position. rotational_items is BOTH_EDITABLE — every write
 * here MUST call logFieldChanges/logSoftDelete or the change never syncs.
 *
 * component_code/component_name are HISTORICAL SNAPSHOTS ("where was this item
 * last fitted") written at install/swap time — never updated on component renames.
 */
import * as repo from '../repositories/rotationalItemRepository';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors';
import { logFieldChanges, logSoftDelete } from '../../sync/fieldLogger';
import { getRequestContext } from '../../../middleware/requestContext';
import {
  ROTATIONAL_ITEM_STATUSES,
  type RotationalItem,
  type InsertRotationalItem,
  type RotationalItemStatus,
} from '@shared/schema';

const TABLE = 'rotational_items';

// asyncHandler only maps AppError subclasses to HTTP statuses — anything else is a 500.
export class RotationalItemValidationError extends ValidationError {}

function currentUserUuid(): string | null {
  return getRequestContext()?.userId ?? null;
}

function normalizeStamp(stamp: unknown): string {
  const s = typeof stamp === 'string' ? stamp.trim() : '';
  if (!s) throw new RotationalItemValidationError('Stamp is required for a rotational item');
  return s;
}

function validateStatus(status: unknown): RotationalItemStatus {
  if (typeof status === 'string' && (ROTATIONAL_ITEM_STATUSES as readonly string[]).includes(status)) {
    return status as RotationalItemStatus;
  }
  throw new RotationalItemValidationError(
    `Invalid status "${String(status)}" — must be one of: ${ROTATIONAL_ITEM_STATUSES.join(', ')}`,
  );
}

export async function listByVessel(vesselId: string, status?: string): Promise<RotationalItem[]> {
  if (!vesselId) throw new RotationalItemValidationError('vesselId is required');
  if (status !== undefined) validateStatus(status);
  return repo.listByVessel(vesselId, status);
}

export async function getByStamp(vesselId: string, stamp: string): Promise<RotationalItem | undefined> {
  return repo.getByStamp(vesselId, normalizeStamp(stamp));
}

export async function createRotationalItem(
  data: Omit<InsertRotationalItem, 'riuuid'> & { riuuid?: string },
): Promise<RotationalItem> {
  const stamp = normalizeStamp(data.stamp);
  const status = validateStatus(data.status ?? 'Spare');
  if (!data.vesselId) throw new RotationalItemValidationError('vesselId is required');

  const existing = await repo.getByStamp(data.vesselId, stamp);
  if (existing) {
    throw new RotationalItemValidationError(
      `Stamp "${stamp}" already exists on this vessel (status: ${existing.status})`,
    );
  }

  const userUuid = currentUserUuid();
  let created;
  try {
    created = await repo.create({
      ...data,
      stamp,
      status,
      createdByUuid: data.createdByUuid ?? userUuid,
      updatedByUuid: userUuid,
    });
  } catch (err: any) {
    // Concurrent create race: the precheck above is non-atomic; the partial unique
    // index uq_rotational_items_vessel_stamp is the real integrity control (23505).
    if (err?.code === '23505') {
      throw new ConflictError(`Stamp "${stamp}" already exists on this vessel`);
    }
    throw err;
  }
  await logFieldChanges(TABLE, created.riuuid, created.vesselId, null, created, userUuid);
  return created;
}

export async function updateRotationalItem(
  riuuid: string,
  data: Partial<Pick<InsertRotationalItem,
    'status' | 'currentRh' | 'rhLastUpdated' | 'componentId' | 'componentCuuid' | 'componentCode' | 'componentName'>>,
): Promise<RotationalItem> {
  const oldRow = await repo.getByRiuuid(riuuid);
  if (!oldRow) throw new NotFoundError('Rotational item not found');
  if (data.status !== undefined) validateStatus(data.status);

  const userUuid = currentUserUuid();
  const updated = await repo.update(riuuid, { ...data, updatedByUuid: userUuid });
  if (!updated) throw new NotFoundError('Rotational item not found');
  await logFieldChanges(TABLE, riuuid, updated.vesselId, oldRow, updated, userUuid);
  return updated;
}

export async function deleteRotationalItem(riuuid: string): Promise<void> {
  const oldRow = await repo.getByRiuuid(riuuid);
  if (!oldRow) throw new NotFoundError('Rotational item not found');
  const userUuid = currentUserUuid();
  await repo.softDelete(riuuid, userUuid);
  await logSoftDelete(TABLE, riuuid, oldRow.vesselId, userUuid);
}

/**
 * Idempotent upsert used by component save / bulk import (Tasks #356/#357):
 * ensures a registry entry exists for a component newly marked rotational.
 * If the stamp already exists on the vessel, returns it unchanged.
 */
export async function ensureRotationalItemForComponent(params: {
  vesselId: string;
  stamp: string;
  componentId: string;
  componentCuuid: string | null;
  componentCode: string | null;
  componentName: string | null;
  currentRh: string | number | null;
  rhLastUpdated: string | null;
}): Promise<RotationalItem> {
  const stamp = normalizeStamp(params.stamp);
  const existing = await repo.getByStamp(params.vesselId, stamp);
  if (existing) return existing;
  return createRotationalItem({
    vesselId: params.vesselId,
    stamp,
    status: 'Installed',
    componentId: params.componentId,
    componentCuuid: params.componentCuuid,
    componentCode: params.componentCode,
    componentName: params.componentName,
    currentRh: params.currentRh != null ? String(params.currentRh) : '0',
    rhLastUpdated: params.rhLastUpdated,
  });
}
