/**
 * Certificate Alert Evaluators (Step 2 MVP)
 *
 * Source: vessel_certificate_data (LIVE table) via
 *   certificateRepository.getAllVesselCertificateData()
 * Friendly names resolved from ship_certificates_master by masterId.
 *
 * Two use cases:
 *   certificate_expiration — "Certificate Expiring Soon" (tiered: 90 / 30 days)
 *   certificate_expired    — "Certificate Expired"
 *
 * READ-ONLY. Dates are mixed-format text → parsed via parseWorkOrderDate.
 * Milestone-encoded dedupe keys → each milestone fires exactly once, ever.
 */

import type { AlertPolicy } from '@shared/schema';
import { parseWorkOrderDate } from '@shared/workOrders/dateParse';

export interface PmsDateAlert {
  dedupeKey: string;
  objectType: string;
  objectId: string;
  vesselId: string;
  state: string;
  priority: string;
  payload: Record<string, any>;
}

export interface VesselCertRow {
  id: number;
  vesselId: string | null;
  vesselName?: string | null;
  masterId: string;
  expiryDate: string | null;
  isDeleted?: boolean | null;
}

function daysDiffFrom(value: string | null | undefined): number | null {
  const parsed = parseWorkOrderDate(value);
  if (!parsed) return null;
  return Math.floor((parsed.getTime() - Date.now()) / 86400000);
}

/**
 * certificate_expiration — tiered "expiring soon".
 * For each tier T in thresholds.leadDaysTiers (default [90, 30]):
 *   emit if 0 <= daysDiff(expiry) <= T.
 * priority = (T <= thresholds.highAtDays(default 30)) ? 'high' : 'medium'.
 * Skip rows already expired (d < 0 → handled by certificate_expired).
 */
export function evaluateCertificateExpiring(
  rows: VesselCertRow[],
  policy: AlertPolicy,
  existingDedupeKeys: Set<string>,
  nameByMasterId?: Map<string, string>,
): PmsDateAlert[] {
  const alerts: PmsDateAlert[] = [];
  const t = JSON.parse(policy.thresholds || '{}');
  const tiers: number[] = Array.isArray(t.leadDaysTiers) ? t.leadDaysTiers : [90, 30];
  const highAtDays: number = typeof t.highAtDays === 'number' ? t.highAtDays : 30;

  for (const row of rows) {
    if (row.isDeleted === true) continue;
    if (!row.vesselId) continue;

    const d = daysDiffFrom(row.expiryDate);
    if (d === null) {
      console.warn(`[certificate_expiration] unparseable expiry_date for cert row ${row.id}: "${row.expiryDate}" — skipping`);
      continue;
    }
    if (d < 0) continue; // expired handled separately

    const certName = nameByMasterId?.get(row.masterId) || row.masterId;

    for (const T of tiers) {
      if (d > T) continue;
      const dedupeKey = `cert_expiring:${row.id}:${T}`;
      if (existingDedupeKeys.has(dedupeKey)) continue;

      const priority = T <= highAtDays ? 'high' : 'medium';
      alerts.push({
        dedupeKey,
        objectType: 'certificate',
        objectId: String(row.id),
        vesselId: row.vesselId,
        state: 'expiring',
        priority,
        payload: {
          certName,
          masterId: row.masterId,
          vesselName: row.vesselName,
          expiryDate: row.expiryDate,
          daysToExpiry: d,
          tierDays: T,
          alertMessage: `Certificate "${certName}" expires in ${d} day(s) (on ${row.expiryDate})`,
        },
      });
    }
  }

  return alerts;
}

/**
 * certificate_expired — daysDiff(expiry) < 0 → emit, priority 'high'.
 */
export function evaluateCertificateExpired(
  rows: VesselCertRow[],
  policy: AlertPolicy,
  existingDedupeKeys: Set<string>,
  nameByMasterId?: Map<string, string>,
): PmsDateAlert[] {
  const alerts: PmsDateAlert[] = [];

  for (const row of rows) {
    if (row.isDeleted === true) continue;
    if (!row.vesselId) continue;

    const d = daysDiffFrom(row.expiryDate);
    if (d === null) {
      console.warn(`[certificate_expired] unparseable expiry_date for cert row ${row.id}: "${row.expiryDate}" — skipping`);
      continue;
    }
    if (d >= 0) continue;

    const dedupeKey = `cert_expired:${row.id}`;
    if (existingDedupeKeys.has(dedupeKey)) continue;

    const certName = nameByMasterId?.get(row.masterId) || row.masterId;
    alerts.push({
      dedupeKey,
      objectType: 'certificate',
      objectId: String(row.id),
      vesselId: row.vesselId,
      state: 'expired',
      priority: policy.priority,
      payload: {
        certName,
        masterId: row.masterId,
        vesselName: row.vesselName,
        expiryDate: row.expiryDate,
        daysOverdue: Math.abs(d),
        alertMessage: `Certificate "${certName}" expired ${Math.abs(d)} day(s) ago (on ${row.expiryDate})`,
      },
    });
  }

  return alerts;
}
