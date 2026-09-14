import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../../../db';
import {
  admnRoleMaster,
  masterUserVessels,
  masterUsers,
  vessels,
} from '@shared/schema';

export interface DevTestUserRow {
  id: string;
  name: string;
  fullName: string;
  email: string | null;
  role: string | null;
  userType: string | null;
  rank: string | null;
}

export interface DevTestVesselRow {
  vuuid: string;
  name: string;
}

export interface DevTestAssignmentRow {
  userId: string;
  vuuid: string;
  vesselName: string;
}

export interface DevTestRoleRow {
  roleId: string;
  roleName: string;
  roleType: string;
}

export async function getActiveUsers(): Promise<DevTestUserRow[]> {
  const db = await getDb();
  return db.select({
    id: masterUsers.id,
    name: masterUsers.fullName,
    fullName: masterUsers.fullName,
    email: masterUsers.email,
    role: masterUsers.role,
    userType: masterUsers.userType,
    rank: masterUsers.designation,
  }).from(masterUsers)
    .where(eq(masterUsers.isDeleted, false))
    .orderBy(asc(masterUsers.fullName), asc(masterUsers.id));
}

export async function getActiveUser(userId: string): Promise<DevTestUserRow | undefined> {
  const db = await getDb();
  const rows = await db.select({
    id: masterUsers.id,
    name: masterUsers.fullName,
    fullName: masterUsers.fullName,
    email: masterUsers.email,
    role: masterUsers.role,
    userType: masterUsers.userType,
    rank: masterUsers.designation,
  }).from(masterUsers)
    .where(and(eq(masterUsers.id, userId), eq(masterUsers.isDeleted, false)))
    .limit(1);
  return rows[0];
}

export async function getActiveVessels(): Promise<DevTestVesselRow[]> {
  const db = await getDb();
  return db.select({
    vuuid: vessels.vuuid,
    name: vessels.name,
  }).from(vessels)
    .where(and(eq(vessels.isActive, true), eq(vessels.isDeleted, false)))
    .orderBy(asc(vessels.name), asc(vessels.vuuid));
}

export async function getActiveAssignments(): Promise<DevTestAssignmentRow[]> {
  const db = await getDb();
  return db.select({
    userId: masterUserVessels.userUuid,
    vuuid: vessels.vuuid,
    vesselName: vessels.name,
  }).from(masterUserVessels)
    .innerJoin(masterUsers, eq(masterUsers.id, masterUserVessels.userUuid))
    .innerJoin(vessels, eq(vessels.vuuid, masterUserVessels.vesselId))
    .where(and(
      eq(masterUserVessels.isActive, true),
      eq(masterUsers.isDeleted, false),
      eq(vessels.isDeleted, false),
    ))
    .orderBy(asc(masterUserVessels.userUuid), asc(vessels.name), asc(vessels.vuuid));
}

export async function getActiveApprovalRoles(): Promise<DevTestRoleRow[]> {
  const db = await getDb();
  return db.select({
    roleId: admnRoleMaster.ruid,
    roleName: admnRoleMaster.assignedRole,
    roleType: admnRoleMaster.roletype,
  }).from(admnRoleMaster)
    .where(and(
      eq(admnRoleMaster.isActive, true),
      eq(admnRoleMaster.isDeleted, false),
    ))
    .orderBy(asc(admnRoleMaster.sortOrder), asc(admnRoleMaster.assignedRole), asc(admnRoleMaster.ruid));
}

export async function getActiveApprovalRolesForName(roleName: string): Promise<DevTestRoleRow[]> {
  const db = await getDb();
  return db.select({
    roleId: admnRoleMaster.ruid,
    roleName: admnRoleMaster.assignedRole,
    roleType: admnRoleMaster.roletype,
  }).from(admnRoleMaster)
    .where(and(
      eq(admnRoleMaster.assignedRole, roleName),
      eq(admnRoleMaster.isActive, true),
      eq(admnRoleMaster.isDeleted, false),
    ))
    .orderBy(asc(admnRoleMaster.sortOrder), asc(admnRoleMaster.ruid));
}

export async function hasActiveUser(userId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select({ id: masterUsers.id }).from(masterUsers)
    .where(and(eq(masterUsers.id, userId), eq(masterUsers.isDeleted, false)))
    .limit(1);
  return rows.length > 0;
}

export async function getActiveVessel(vuuid: string): Promise<DevTestVesselRow | undefined> {
  const db = await getDb();
  const rows = await db.select({
    vuuid: vessels.vuuid,
    name: vessels.name,
  }).from(vessels)
    .where(and(
      eq(vessels.vuuid, vuuid),
      eq(vessels.isActive, true),
      eq(vessels.isDeleted, false),
    ))
    .limit(1);
  return rows[0];
}

/**
 * This deliberately mirrors the production assignment writer. In particular, a
 * reactivation is fresh pending work and resets the Shipskart retry ladder.
 */
export async function upsertActiveAssignment(userId: string, vuuid: string): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const existing = (await db.select({
    shipskartMappingId: masterUserVessels.shipskartMappingId,
    isActive: masterUserVessels.isActive,
  }).from(masterUserVessels).where(and(
    eq(masterUserVessels.userUuid, userId),
    eq(masterUserVessels.vesselId, vuuid),
  )).limit(1))[0];
  const resetMapping = !(existing?.shipskartMappingId && existing.isActive);
  await db.insert(masterUserVessels)
    .values({
      userUuid: userId,
      vesselId: vuuid,
      isActive: true,
      shipskartMappingId: null,
      mapStatus: 'pending',
      lastError: null,
      mapAttempts: 0,
      lastAttemptAt: null,
      mappedAt: null,
    })
    .onConflictDoUpdate({
      target: [masterUserVessels.userUuid, masterUserVessels.vesselId],
      set: {
        isActive: true,
        ...(resetMapping ? {
          mapStatus: 'pending',
          mapAttempts: 0,
          lastAttemptAt: null,
        } : {}),
        lastError: null,
        updatedAt: now,
      },
    });
}

/** Production revoke shape: retain the row and mapping id, but queue a revoke. */
export async function deactivateAssignment(userId: string, vuuid: string): Promise<boolean> {
  const db = await getDb();
  const updated = await db.update(masterUserVessels)
    .set({
      isActive: false,
      mapStatus: 'revoked',
      mapAttempts: 0,
      lastAttemptAt: null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(masterUserVessels.userUuid, userId),
      eq(masterUserVessels.vesselId, vuuid),
      eq(masterUserVessels.isActive, true),
    ))
    .returning({ id: masterUserVessels.id });
  return updated.length > 0;
}