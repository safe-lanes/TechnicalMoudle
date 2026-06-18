/**
 * Audit Actor — single source of truth for "who did this" on audit records.
 *
 * Phase 0 (identity threading): SAILERP authenticates users two ways and forwards the
 * identity into PMS (see auth middleware / activeRank interceptor). This helper turns the
 * authenticated `req.user` into the canonical actor we stamp on audit records.
 *
 * The locked rule:
 *   - Office user  → accountable identity is the PERSON  → actorLabel = full name
 *   - Ship user    → accountable identity is the RANK     → actorLabel = rank_name
 *   - actorId is always the canonical token: userUuid (fallback email/rank/'system').
 *
 * actorLabel is FROZEN into each audit row at write time (sync_field_log.changed_by_display,
 * running_hours_audit.actor_label, audit_log.payload) so it survives crew changes and is
 * never resolved live from the users table.
 */

export interface AuditActor {
  /** Canonical id stamped in the primary actor column (userUuid for real users). */
  actorId: string;
  /** Frozen human-readable label: person name (Office) or rank (Ship). */
  actorLabel: string;
  /** Email when known (Office). */
  actorEmail: string | null;
  /** 'Office' | 'Ship' | null */
  actorType: string | null;
  /** rank_name when known. */
  actorRank: string | null;
  /** Real role forwarded for audit only — NOT used for RBAC (req.user.role stays mock in Phase 0). */
  actorRole: string | null;
}

/** Actor used for machine/background writes (no authenticated request). */
export const SYSTEM_ACTOR: AuditActor = {
  actorId: 'system',
  actorLabel: 'System',
  actorEmail: null,
  actorType: null,
  actorRank: null,
  actorRole: null,
};

/**
 * Resolve the audit actor from an authenticated user object (req.user / PublicUser shape).
 * Returns SYSTEM_ACTOR when there is no user.
 */
export function resolveAuditActor(user: any): AuditActor {
  if (!user) return SYSTEM_ACTOR;

  const uuid: string | null = (user.userUuid && String(user.userUuid).trim()) || null;
  const email: string | null = (user.email && String(user.email).trim()) || null;
  const rank: string | null = (user.rank_name && String(user.rank_name).trim()) || null;
  const role: string | null = (user.forwardedRole && String(user.forwardedRole).trim())
    || (user.role && String(user.role).trim()) || null;
  const name: string | null =
    (user.fullName && String(user.fullName).trim()) ||
    [user.firstname, user.lastname].filter(Boolean).join(' ').trim() ||
    (user.username && String(user.username).trim()) ||
    null;
  const userType: string | null = (user.userType && String(user.userType).trim()) || null;

  if (userType === 'Ship') {
    // Ship: the RANK is the accountable identity.
    return {
      actorId: uuid || rank || 'system',
      actorLabel: rank || name || 'Ship User',
      actorEmail: email,
      actorType: 'Ship',
      actorRank: rank,
      actorRole: role,
    };
  }

  // Office (and any non-Ship): the PERSON is the accountable identity.
  return {
    actorId: uuid || email || 'system',
    actorLabel: name || email || 'Office User',
    actorEmail: email,
    actorType: userType || 'Office',
    actorRank: rank,
    actorRole: role,
  };
}
