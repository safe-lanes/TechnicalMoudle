import type { Request } from 'express';
import { and, eq } from 'drizzle-orm';
import { masterUserVessels } from '@shared/schema';
import { createDefaultDevelopmentUser } from '@shared/developmentUser';
import { getDb } from '../../../db';
import { getCurrentTenantContext } from '../../../utils/asyncLocalStorage';
import { tenantConnectionManager } from '../../../utils/tenantConnectionManager';
import { findMasterUserById } from '../../assistant-api/masterUserRepository';
import { applyPartALock } from './defectPartALock';
import type { DefectFileSection } from '@shared/defectAttachments';

export type DefectFileActor = {
  userUuid: string; name: string; role: string; userType: 'Office' | 'Ship';
  rank: string; tenant: string;
};
export function fileError(message: string, statusCode = 400, code = 'DEFECT_FILE_ERROR') {
  return Object.assign(new Error(message), { statusCode, code });
}
export async function defectFileActor(req: Request): Promise<DefectFileActor> {
  const r = req as any;
  let identity = r.verifiedUser;
  let developmentRank: string | undefined;
  if (!identity && process.env.NODE_ENV === 'development' && process.env.VITE_APP_ENV === 'replit' &&
      !tenantConnectionManager.isMultiTenantEnabled && req.headers['x-defect-development'] === 'default-user') {
    const user = createDefaultDevelopmentUser();
    if (req.headers['x-user-id'] !== user.userUuid) throw fileError('Workspace identity mismatch.', 403);
    identity = { userId: user.userUuid, role: user.role, userType: user.userType };
    developmentRank = user.rank_name;
  }
  if (!identity?.userId || !identity.role || !['Office', 'Ship'].includes(identity.userType)) {
    throw fileError('A verified user session is required to access defect files.', 403, 'IDENTITY_REQUIRED');
  }
  const mapped = await findMasterUserById(identity.userId);
  if (!mapped || mapped.userType !== identity.userType) throw fileError('The user identity is not mapped in this installation.', 403);
  return {
    userUuid: identity.userId, name: (mapped as any).fullName || identity.userId,
    role: identity.role, userType: identity.userType, rank: developmentRank || r.user?.rank_name || r.user?.crewDesignation || '',
    tenant: getCurrentTenantContext()?.tuid ?? 'single-tenant',
  };
}
export async function assertDefectFileAccess(actor: DefectFileActor, vessel: string, section?: DefectFileSection, current?: any) {
  if (actor.userType === 'Ship') {
    const db = await getDb();
    const assigned = await db.select().from(masterUserVessels).where(and(
      eq(masterUserVessels.userUuid, actor.userUuid), eq(masterUserVessels.vesselId, vessel),
      eq(masterUserVessels.isActive, true),
    )).limit(1);
    if (!assigned.length) throw fileError('You do not have access to this vessel.', 403);
  }
  if (section === 'part-c1' && actor.rank.trim().toLowerCase() !== 'master') {
    throw fileError('Only the Master may add closure documents.', 403);
  }
  if (section === 'part-c1' && current) {
    const { assertDefectCloseoutAllowed } = await import('./defectsApprovalHooks');
    await assertDefectCloseoutAllowed(current, { userUuid: actor.userUuid, rankName: actor.rank });
  }
  if (section === 'part-a' && current) {
    // Pure check: does not consume or persist an unlock until the actual save.
    applyPartALock(current, { partAAttachments: [...(current.partAAttachments ?? []), { id: 'staging-permission-check' }] },
      { userUuid: actor.userUuid, name: actor.name });
  }
}
