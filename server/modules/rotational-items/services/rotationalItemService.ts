/**
 * Rotational Items — service layer.
 *
 * Physical parts identified by a unique Stamp; RH history follows the stamp,
 * not the equipment position. rotational_items is BOTH_EDITABLE — every write
 * here MUST call logFieldChanges/logSoftDelete or the change never syncs.
 *
 * PURE MASTER TABLE (Task #366): no component back-pointer. The installed-on
 * link is DERIVED via join components.current_stamp = rotational_items.stamp
 * (per vessel). Historical "where fitted" trace lives in rotation_history.
 */
import { and, eq } from 'drizzle-orm';
import * as repo from '../repositories/rotationalItemRepository';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors';
import { logFieldChanges, logSoftDelete } from '../../sync/fieldLogger';
import { getRequestContext, getAuditActor } from '../../../middleware/requestContext';
import { getDb } from '../../../db';
import {
  ROTATIONAL_ITEM_STATUSES,
  components,
  rotationalItems,
  rotationHistory,
  runningHoursAudit,
  type RotationalItem,
  type InsertRotationalItem,
  type RotationalItemStatus,
  type RotationHistory,
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

/** Master List screen listing: items + installed-on component (derived join). */
export async function listByVesselWithHolder(vesselId: string, status?: string) {
  if (!vesselId) throw new ValidationError('vesselId is required');
  return repo.listByVesselWithHolder(vesselId, status);
}

export async function getByRiuuid(riuuid: string): Promise<RotationalItem | undefined> {
  return repo.getByRiuuid(riuuid);
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
    'stamp' | 'stampName' | 'status' | 'currentRh' | 'rhLastUpdated'>>,
): Promise<RotationalItem> {
  const oldRow = await repo.getByRiuuid(riuuid);
  if (!oldRow) throw new NotFoundError('Rotational item not found');
  if (data.status !== undefined) validateStatus(data.status);
  if (data.stamp !== undefined) {
    // Stamp rename (typo correction) — must stay unique on the vessel
    const newStamp = normalizeStamp(data.stamp);
    if (newStamp !== oldRow.stamp) {
      const clash = await repo.getByStamp(oldRow.vesselId, newStamp);
      if (clash && clash.riuuid !== riuuid) {
        throw new RotationalItemValidationError(`Stamp "${newStamp}" already exists on this vessel`);
      }
    }
    data.stamp = newStamp;
  }

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

export async function getInstalledForComponent(componentCuuid: string): Promise<RotationalItem | undefined> {
  return repo.getInstalledByComponentCuuid(componentCuuid);
}

/**
 * Detach the item from its component (component unmarked as rotational, or item removed):
 * snapshot the component's RH onto the stamp and mark it Spare. The live link is derived
 * from components.current_stamp, which the caller clears/changes on the component row.
 */
export async function detachFromComponent(
  riuuid: string,
  rhSnapshot: { currentRh: string | number | null; rhLastUpdated: string | null },
): Promise<RotationalItem | undefined> {
  // Guarded: only releases if still Installed (no-op if already released elsewhere).
  const oldRow = await repo.getByRiuuid(riuuid);
  if (!oldRow) return undefined;
  const userUuid = currentUserUuid();
  const released = await repo.releaseStamp(riuuid, {
    currentRh: rhSnapshot.currentRh != null ? String(rhSnapshot.currentRh) : null,
    rhLastUpdated: rhSnapshot.rhLastUpdated ?? null,
  }, userUuid);
  if (released) {
    // BOTH_EDITABLE sync contract: every write must be field-logged or it never syncs.
    await logFieldChanges(TABLE, riuuid, released.vesselId, oldRow, released, userUuid);
  }
  return released;
}

/**
 * Guarded claim (Spare/In Store → Installed). Returns undefined on conflict —
 * the caller must throw, never fall back to an unguarded status write.
 */
export async function claimStamp(riuuid: string): Promise<RotationalItem | undefined> {
  const oldRow = await repo.getByRiuuid(riuuid);
  if (!oldRow) return undefined;
  const userUuid = currentUserUuid();
  const claimed = await repo.claimStamp(riuuid, userUuid);
  if (claimed) {
    // BOTH_EDITABLE sync contract: every write must be field-logged or it never syncs.
    await logFieldChanges(TABLE, riuuid, claimed.vesselId, oldRow, claimed, userUuid);
  }
  return claimed;
}

/** Which live component currently holds this stamp? (derived reverse link) */
export async function getComponentHoldingStamp(vesselId: string, stamp: string) {
  return repo.getComponentHoldingStamp(vesselId, normalizeStamp(stamp));
}

/**
 * Replace the installed rotational item on a component (the actual rotation).
 *
 * Atomically (one DB transaction):
 *  - Outgoing stamp: component's current cumulative RH + last-updated date snapshotted
 *    onto the registry row; status → Spare; live link cleared (code/name kept as the
 *    "last fitted at" historical snapshot).
 *  - Incoming stamp (existing spare/in-store item, or brand-new stamp created inline):
 *    status → Installed; live link set; its stored RH becomes the component's new baseline.
 *  - Component: current_stamp, currentCumulativeRH/rhCurrentMaster and last-updated
 *    stamps set from the incoming item. NO cascade to INHERITED children — like a meter
 *    replacement, this is a baseline reset, not accumulation.
 *  - running_hours_audit row with source='rotation' (internal-only source; bypasses the
 *    25h/day cap exactly once — from the next RH update onward normal validation applies,
 *    measured from the new baseline/rotation date).
 *  - rotation_history row: immutable event log AND the ship→shore sync carrier of the
 *    swap (components is ONE_WAY_SHORE_TO_SHIP; the appliers' derived hooks re-apply
 *    stamp + baseline from this row on the receiving side).
 *
 * All rotational-table writes field-log inside the same transaction (throw-to-rollback).
 */
export async function replaceRotationalItem(params: {
  componentCuuid: string;
  incomingRiuuid?: string | null;
  newStamp?: string | null;
  newStampName?: string | null;
  newStampInitialRh?: number | string | null;
  notes?: string | null;
  userId?: string | null;
}): Promise<{ rotation: RotationHistory; component: any; incoming: RotationalItem; outgoing: RotationalItem | null }> {
  const db = await getDb();
  const userUuid = currentUserUuid() ?? params.userId ?? null;
  const actorLabel = getAuditActor().actorLabel;
  const now = new Date();

  if (!params.componentCuuid) throw new RotationalItemValidationError('componentCuuid is required');

  // Cheap pre-checks only; authoritative reads happen INSIDE the transaction under
  // row locks so a concurrent RH update between read and commit cannot produce a
  // stale outgoing-stamp snapshot ("RH follows the stamp" must hold under races).
  const wantsNew = !!(params.newStamp && String(params.newStamp).trim());
  if (!wantsNew && !params.incomingRiuuid) {
    throw new RotationalItemValidationError('Select an existing rotational item or provide a new Stamp');
  }
  if (wantsNew && params.incomingRiuuid) {
    throw new RotationalItemValidationError('Provide either an existing item or a new Stamp — not both');
  }

  let newStamp = '';
  let newInitialRh = 0;
  const newStampName = typeof params.newStampName === 'string' && params.newStampName.trim() !== ''
    ? params.newStampName.trim() : null;
  if (wantsNew) {
    newStamp = normalizeStamp(params.newStamp);
    newInitialRh = params.newStampInitialRh != null && String(params.newStampInitialRh).trim() !== ''
      ? Number(params.newStampInitialRh) : 0;
    if (!Number.isFinite(newInitialRh) || newInitialRh < 0) {
      throw new RotationalItemValidationError('Starting Running Hours must be zero or a positive number');
    }
  }

  return db.transaction(async (tx) => {
    // 0) Authoritative reads under row locks (FOR UPDATE): the component row anchors the
    //    outgoing RH snapshot; the incoming registry row anchors the new baseline.
    const compRows = await tx.select().from(components)
      .where(eq(components.cuuid, params.componentCuuid)).limit(1).for('update');
    const component = compRows[0];
    if (!component) throw new NotFoundError('Component not found');
    if (!component.rotationalItem) {
      throw new RotationalItemValidationError('Component is not marked as a Rotational Item');
    }
    if (!component.vesselId) throw new RotationalItemValidationError('Component has no vessel');
    const vesselId = component.vesselId;

    let incomingExisting: RotationalItem | undefined;
    if (wantsNew) {
      const clashRows = await tx.select().from(rotationalItems).where(and(
        eq(rotationalItems.vesselId, vesselId),
        eq(rotationalItems.stamp, newStamp),
        eq(rotationalItems.isDeleted, false),
      )).limit(1);
      if (clashRows[0]) {
        throw new RotationalItemValidationError(`Stamp "${newStamp}" already exists on this vessel (status: ${clashRows[0].status})`);
      }
    } else {
      const incomingRows = await tx.select().from(rotationalItems)
        .where(eq(rotationalItems.riuuid, params.incomingRiuuid!)).limit(1).for('update');
      incomingExisting = incomingRows[0];
      if (!incomingExisting || incomingExisting.isDeleted) throw new NotFoundError('Incoming rotational item not found');
      if (incomingExisting.vesselId !== vesselId) {
        throw new RotationalItemValidationError('Incoming item belongs to a different vessel');
      }
      if (incomingExisting.status === 'Installed') {
        throw new RotationalItemValidationError(`Stamp "${incomingExisting.stamp}" is currently installed on another component`);
      }
      if (incomingExisting.status === 'Retired') {
        throw new RotationalItemValidationError(`Stamp "${incomingExisting.stamp}" is retired and cannot be installed`);
      }
    }

    // Derived link: the outgoing item is the registry row whose stamp equals the
    // component's current_stamp (same vessel), still Installed.
    const outgoingRows = component.currentStamp
      ? await tx.select().from(rotationalItems).where(and(
          eq(rotationalItems.vesselId, vesselId),
          eq(rotationalItems.stamp, component.currentStamp),
          eq(rotationalItems.status, 'Installed'),
          eq(rotationalItems.isDeleted, false),
        )).limit(1).for('update')
      : [];
    const outgoing = outgoingRows[0];

    // Outgoing snapshot: the component's CURRENT (locked) cumulative RH is the outgoing
    // stamp's final reading.
    const outgoingRh = component.currentCumulativeRH != null ? String(component.currentCumulativeRH) : '0';
    const outgoingRhDate = component.lastUpdated || now.toISOString();

    // 1) Outgoing → Spare with RH snapshot (guarded: only if still Installed here)
    let outgoingAfter: RotationalItem | null = null;
    if (outgoing) {
      const rows = await tx.update(rotationalItems)
        .set({
          status: 'Spare',
          currentRh: outgoingRh,
          rhLastUpdated: outgoingRhDate,
          updatedByUuid: userUuid,
          updatedAt: now,
        })
        .where(and(
          eq(rotationalItems.riuuid, outgoing.riuuid),
          eq(rotationalItems.status, 'Installed'),
          eq(rotationalItems.isDeleted, false),
        ))
        .returning();
      if (!rows[0]) throw new ConflictError('Outgoing rotational item changed concurrently — please retry');
      outgoingAfter = rows[0];
      await logFieldChanges(TABLE, outgoing.riuuid, vesselId, outgoing, outgoingAfter, userUuid, tx);
    }

    // 2) Incoming → Installed (create inline, or guarded update of the existing spare)
    let incomingAfter: RotationalItem;
    if (wantsNew) {
      const rows = await tx.insert(rotationalItems).values({
        vesselId,
        stamp: newStamp,
        stampName: newStampName || null,
        status: 'Installed',
        currentRh: newInitialRh.toFixed(2),
        rhLastUpdated: now.toISOString(),
        createdByUuid: userUuid,
        updatedByUuid: userUuid,
      }).returning();
      incomingAfter = rows[0];
      await logFieldChanges(TABLE, incomingAfter.riuuid, vesselId, null, incomingAfter, userUuid, tx);
    } else {
      const rows = await tx.update(rotationalItems)
        .set({
          status: 'Installed',
          updatedByUuid: userUuid,
          updatedAt: now,
        })
        .where(and(
          eq(rotationalItems.riuuid, incomingExisting!.riuuid),
          eq(rotationalItems.isDeleted, false),
          eq(rotationalItems.status, incomingExisting!.status), // guarded: fails if installed elsewhere meanwhile
        ))
        .returning();
      if (!rows[0]) throw new ConflictError('Incoming rotational item changed concurrently — please retry');
      incomingAfter = rows[0];
      await logFieldChanges(TABLE, incomingAfter.riuuid, vesselId, incomingExisting!, incomingAfter, userUuid, tx);
    }

    const inRh = parseFloat(incomingAfter.currentRh || '0');

    // 3) Component: new stamp + RH baseline from the incoming item. Baseline reset —
    //    NOT validated against the 25h/day cap and NOT cascaded to INHERITED children
    //    (meter-replacement semantics). components is ONE_WAY_SHORE_TO_SHIP: no field log.
    const compUpd = await tx.update(components)
      .set({
        currentStamp: incomingAfter.stamp,
        currentCumulativeRH: inRh.toFixed(2),
        rhCurrentMaster: inRh.toFixed(2),
        rhMasterUpdatedAt: now,
        rhMasterUpdateSource: 'ROTATION',
        lastUpdated: now.toISOString(),
        updatedAt: now,
      })
      .where(eq(components.cuuid, component.cuuid))
      .returning();
    if (!compUpd[0]) throw new NotFoundError('Component disappeared during swap');

    // 4) running_hours_audit — source 'rotation' is assigned ONLY here (the public RH
    //    endpoints' zod enums do not accept it), so the cap bypass cannot be spoofed.
    const audit = await tx.insert(runningHoursAudit).values({
      vesselId,
      componentId: component.cuuid,
      previousRH: parseFloat(outgoingRh || '0').toFixed(2),
      newRH: inRh.toFixed(2),
      cumulativeRH: inRh.toFixed(2),
      dateUpdatedLocal: now.toISOString().split('T')[0],
      dateUpdatedTZ: 'UTC',
      enteredAtUTC: now,
      userId: params.userId || userUuid || 'system',
      actorLabel,
      updatedByUuid: userUuid,
      source: 'rotation',
      notes: `Rotational item replacement: ${outgoing?.stamp ?? '(none)'} out @ ${outgoingRh}, ${incomingAfter.stamp} in @ ${inRh.toFixed(2)}`,
      meterReplaced: false,
      version: 1,
      componentCode: component.componentCode ?? null,
      componentName: component.name ?? null,
    }).returning();
    await logFieldChanges('running_hours_audit', audit[0].rhauuid, vesselId, null, audit[0], userUuid, tx);

    // 5) rotation_history — immutable event log + the ship↔shore sync carrier of the swap.
    const rotation = await tx.insert(rotationHistory).values({
      vesselId,
      componentId: component.cuuid,
      componentCode: component.componentCode ?? null,
      componentName: component.name ?? null,
      outRiuuid: outgoing?.riuuid ?? null,
      outStamp: outgoing?.stamp ?? component.currentStamp ?? null,
      outRh: outgoing ? parseFloat(outgoingRh || '0').toFixed(2) : null,
      inRiuuid: incomingAfter.riuuid,
      inStamp: incomingAfter.stamp,
      inRh: inRh.toFixed(2),
      rotationDate: now,
      userId: params.userId || userUuid,
      actorLabel,
      notes: params.notes ?? null,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    }).returning();
    await logFieldChanges('rotation_history', rotation[0].rhruuid, vesselId, null, rotation[0], userUuid, tx);

    return { rotation: rotation[0], component: compUpd[0], incoming: incomingAfter, outgoing: outgoingAfter };
  });
}

// NOTE (Task #366, strict master-first): the old ensureRotationalItemForComponent
// side-effect creation is gone. Components can only SELECT existing masters; masters
// are created via the Rotation Item Master List screen or its bulk import.
