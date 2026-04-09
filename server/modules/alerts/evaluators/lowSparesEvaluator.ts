/**
 * UC2: Low Critical Spares Evaluator
 *
 * Scans spares where:
 *   - critical IN ('Critical', 'Yes')
 *   - rob < min
 *   - dataScope = 'vessel'
 *   - deleted = false
 *
 * Creates one alert_event per unique spare (dedupe by spare suuid).
 */

import type { AlertPolicy } from '@shared/schema';

export interface LowSpareAlert {
  dedupeKey: string;
  objectType: string;
  objectId: string;
  vesselId: string;
  state: string;
  priority: string;
  payload: Record<string, any>;
}

interface SpareRow {
  suuid: string;
  partCode: string;
  partName: string;
  rob: number;
  min: number;
  critical: string;
  componentCode: string | null;
  componentName: string;
  vesselId: string | null;
}

export function evaluateLowSpares(
  spares: SpareRow[],
  policy: AlertPolicy,
  existingDedupeKeys: Set<string>
): LowSpareAlert[] {
  const alerts: LowSpareAlert[] = [];

  for (const spare of spares) {
    if (!spare.vesselId) continue;

    // Check criticality
    const crit = (spare.critical || '').toLowerCase();
    if (crit !== 'critical' && crit !== 'yes') continue;

    // Check ROB < MIN
    const rob = Number(spare.rob) || 0;
    const min = Number(spare.min) || 0;
    if (min <= 0) continue; // No minimum defined — skip
    if (rob >= min) continue;

    // Dedupe key: one alert per spare per vessel
    const dedupeKey = `low_critical_spares:${spare.suuid}`;
    if (existingDedupeKeys.has(dedupeKey)) continue;

    const deficit = min - rob;
    alerts.push({
      dedupeKey,
      objectType: 'spare',
      objectId: spare.suuid,
      vesselId: spare.vesselId,
      state: rob === 0 ? 'critical' : 'low',
      priority: rob === 0 ? 'high' : policy.priority,
      payload: {
        partCode: spare.partCode,
        partName: spare.partName,
        rob,
        min,
        deficit,
        componentCode: spare.componentCode,
        componentName: spare.componentName,
        alertMessage: `Critical spare "${spare.partName}" (${spare.partCode}) stock is ${rob}/${min} (deficit: ${deficit})`,
      },
    });
  }

  return alerts;
}
