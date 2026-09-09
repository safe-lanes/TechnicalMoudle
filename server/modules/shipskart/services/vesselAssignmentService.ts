/**
 * CAPTURE-AT-LOGIN — user↔vessel assignments from SAILERP.
 *
 * WHY THE FRONTEND HAS TO HAND THESE OVER: the assignments live in SAILERP's ENCRYPTED
 * `userProfile.myVessels`, which is decrypted in the browser only (secureStorage /
 * AuthContext). The server never sees the profile — it only receives the forwarded
 * identity headers (x-user-id / x-user-name / …). So the browser posts the array once per
 * login and this service is the whole server-side write path.
 *
 * Confirmed contract (verified against dev data 2026-07-30): each entry is
 * `{ vesselId, vessel?, imoNumber? }` and `vesselId` is our `vessels.vuuid` — e.g.
 * 743ef9d1-…(WK Frontier Pilot / IMO 9239927). Unknown ids are REPORTED, never silently
 * dropped, so a SAILERP vessel missing from this module is visible instead of becoming a
 * quiet gap in Purchasing access.
 *
 * IDENTITY COMES FROM THE HEADER, NEVER THE BODY (the controller passes
 * req.user.userUuid) — a caller must not be able to write someone else's assignments.
 */
import { inArray } from 'drizzle-orm';
import { getDb } from '../../../db';
import { vessels } from '@shared/schema';
import * as b2bRepo from '../repositories/shipskartB2bRepository';

export interface IncomingAssignment { vesselId?: unknown; vessel?: unknown; imoNumber?: unknown }

export interface CaptureResult {
  activated: number;
  deactivated: number;
  unknownVesselIds: string[];
  received: number;
}

/**
 * Tolerant extraction of vessel ids. AuthContext already normalises `myVessels` into
 * objects, but the external login has historically delivered bare id strings, a
 * JSON-encoded string, or a CSV list (see normalizeMyVessels) — accept all of it rather
 * than trusting one shape.
 */
export function extractVesselIds(payload: unknown): string[] {
  let raw: unknown = payload;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    raw = obj.myVessels ?? obj.my_vessels ?? obj.assignments ?? obj.vesselIds ?? [];
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try { raw = JSON.parse(trimmed); } catch { raw = trimmed.split(/[,;]/); }
    } else {
      raw = trimmed.split(/[,;]/);
    }
  }
  if (!Array.isArray(raw)) return [];
  const ids = raw.map((entry) => {
    if (typeof entry === 'string') return entry.trim();
    if (entry && typeof entry === 'object') {
      const e = entry as Record<string, unknown>;
      const v = e.vesselId ?? e.vessel_id ?? e.vuuid ?? e.id;
      return typeof v === 'string' ? v.trim() : '';
    }
    return '';
  }).filter(Boolean);
  return Array.from(new Set(ids));
}

/**
 * Persist one login's assignment set (replace-set) after validating every id against
 * `vessels.vuuid`.
 *
 * TWO SAFETY RULES, both found by test (2026-07-30) and both about the same failure mode —
 * "I could not read the profile" must NEVER be recorded as "this user has no vessels":
 *
 *  1. AN EMPTY SET IS A NO-OP unless the caller passes `allowEmpty`. An unreadable or
 *     absent encrypted userProfile yields `myVessels: []` on the client, which would
 *     otherwise revoke every vessel the user has. A genuine full revoke is an explicit
 *     admin action, not something inferred from an empty payload.
 *  2. IDS SENT BUT NONE RESOLVE → nothing is deactivated and the unknown ids are
 *     returned, so a vessel-id format change cannot strip a whole fleet's access.
 */
export async function captureAssignments(
  userUuid: string,
  payload: unknown,
  opts: { allowEmpty?: boolean } = {},
): Promise<CaptureResult> {
  const incoming = extractVesselIds(payload);
  const db = await getDb();

  if (incoming.length === 0 && !opts.allowEmpty) {
    console.warn(
      `[VesselAssignments] user ${userUuid}: empty assignment set received — treating as a NO-OP ` +
      `(an unreadable userProfile must not revoke access). Pass allowEmpty to revoke deliberately.`,
    );
    return { activated: 0, deactivated: 0, unknownVesselIds: [], received: 0 };
  }

  const known = incoming.length
    ? (await db.select({ v: vessels.vuuid }).from(vessels).where(inArray(vessels.vuuid, incoming))).map((r) => r.v)
    : [];
  const knownSet = new Set(known);
  const unknownVesselIds = incoming.filter((id) => !knownSet.has(id));

  if (incoming.length > 0 && known.length === 0) {
    console.warn(
      `[VesselAssignments] user ${userUuid}: ${incoming.length} vessel id(s) sent, NONE matched vessels.vuuid — ` +
      `refusing to deactivate existing assignments (possible id-format change). Unknown: ${unknownVesselIds.slice(0, 5).join(', ')}`,
    );
    return { activated: 0, deactivated: 0, unknownVesselIds, received: incoming.length };
  }

  const { activated, deactivated } = await b2bRepo.replaceAssignmentsForUser(userUuid, known);
  if (unknownVesselIds.length) {
    console.warn(`[VesselAssignments] user ${userUuid}: ignored ${unknownVesselIds.length} unknown vessel id(s): ${unknownVesselIds.slice(0, 5).join(', ')}`);
  }
  console.log(`[VesselAssignments] user ${userUuid}: ${activated} active, ${deactivated} revoked, ${unknownVesselIds.length} unknown`);
  return { activated, deactivated, unknownVesselIds, received: incoming.length };
}
