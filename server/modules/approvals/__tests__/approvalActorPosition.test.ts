import { describe, expect, it, vi } from 'vitest';

// Approvals QA (Jeevan #3, 22-Oct-2026): "Jeevan Naik (Chief Engineer)" for an office user. The mock auth fills a
// default rank "Chief Engineer" when none is sent; office users have no rank. History must show an office user's
// designation (user master), then role — and a ship user's rank.
const ctx = vi.hoisted(() => ({ actor: null as any }));
const lookupUser = vi.hoisted(() => vi.fn());
vi.mock('../../../middleware/requestContext', () => ({ getRequestContext: () => ({ actor: ctx.actor }) }));
vi.mock('../approvalHistoryRepository', () => ({ lookupUser }));

import { resolveAuditActor } from '../../../middleware/auditActor';
import { currentActor } from '../approvalHistoryService';

describe('approval history actor position', () => {
  it('ignores the mock default rank for an office user', () => {
    const office = resolveAuditActor({ userUuid: '362', fullName: 'Jeevan Naik', userType: 'Office', rank_name: 'Chief Engineer', rankIsDefault: true, forwardedRole: 'Sail Admin' });
    expect(office.actorRank).toBeNull();
    const ship = resolveAuditActor({ userUuid: 's1', fullName: 'A B', userType: 'Ship', rank_name: 'Chief Engineer', rankIsDefault: false });
    expect(ship.actorRank).toBe('Chief Engineer');
  });

  it('office user → designation from the user master, then role; never a rank', async () => {
    ctx.actor = resolveAuditActor({ userUuid: '362', fullName: 'Jeevan Naik', userType: 'Office', rank_name: 'Chief Engineer', rankIsDefault: true, forwardedRole: 'Sail Admin' });
    lookupUser.mockResolvedValue({ name: 'Jeevan Naik', role: 'Sail Admin', designation: 'Technical Officer' });
    await expect(currentActor()).resolves.toEqual({ uuid: '362', name: 'Jeevan Naik', position: 'Technical Officer' });
    lookupUser.mockResolvedValue({ name: 'Jeevan Naik', role: 'Sail Admin', designation: null });
    await expect(currentActor()).resolves.toMatchObject({ position: 'Sail Admin' });
  });

  it('office user with a position the login sent explicitly → that position', async () => {
    ctx.actor = resolveAuditActor({ userUuid: '400', fullName: 'T S', userType: 'Office', rank_name: 'Technical Superintendent', rankIsDefault: false, forwardedRole: 'Admin' });
    lookupUser.mockResolvedValue({ name: 'T S', role: 'Admin', designation: 'Other' });
    await expect(currentActor()).resolves.toMatchObject({ position: 'Technical Superintendent' });
  });

  it('ship user → rank', async () => {
    ctx.actor = resolveAuditActor({ userUuid: 's1', fullName: 'Ship CE', userType: 'Ship', rank_name: 'Chief Engineer', rankIsDefault: false });
    await expect(currentActor()).resolves.toMatchObject({ name: 'Ship CE', position: 'Chief Engineer' });
  });
});
