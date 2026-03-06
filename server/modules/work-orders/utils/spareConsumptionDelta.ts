export interface ConsumedSpareEntry {
  partNo: string;
  partCode?: string;
  description?: string;
  quantityConsumed: number | string;
  locationId?: number | null;
  location?: string;
  locationName?: string;
  comments?: string;
  _deductedQty?: number;
}

export interface SpareToProcess {
  spare: ConsumedSpareEntry;
  qty: number;
  reverseQty: number;
  locationName: string;
  partKey: string;
  lineIndex: number;
}

export function makeCompositeKey(partKey: string, locName: string): string {
  return `${partKey}::${(locName || '').toLowerCase().trim()}`;
}

export function computeSpareConsumptionDelta(
  currentConsumed: ConsumedSpareEntry[],
  previousConsumed: ConsumedSpareEntry[]
): SpareToProcess[] {
  const previousDeductionMap = new Map<string, number>();
  for (const prev of previousConsumed) {
    const prevPartKey = prev.partCode || prev.partNo;
    if (!prevPartKey) continue;
    const prevLoc = (prev.location || prev.locationName || '').trim();
    if (!prevLoc) continue;
    const prevDeducted = prev._deductedQty || 0;
    if (prevDeducted > 0) {
      const compositeKey = makeCompositeKey(prevPartKey, prevLoc);
      previousDeductionMap.set(compositeKey, (previousDeductionMap.get(compositeKey) || 0) + prevDeducted);
    }
  }

  const sparesToProcess: SpareToProcess[] = [];
  const currentCompositeKeys = new Set<string>();

  for (let i = 0; i < currentConsumed.length; i++) {
    const consumed = currentConsumed[i];
    const qtyConsumed = typeof consumed.quantityConsumed === 'string'
      ? parseFloat(consumed.quantityConsumed) : consumed.quantityConsumed;

    const partKey = consumed.partCode || consumed.partNo;
    if (!partKey) continue;

    const locationName = (consumed.location || consumed.locationName || '').trim();
    if (!locationName) continue;

    const compositeKey = makeCompositeKey(partKey, locationName);
    currentCompositeKeys.add(compositeKey);

    const storedDeducted = previousDeductionMap.get(compositeKey) || 0;
    const effectiveQty = (qtyConsumed && qtyConsumed > 0) ? qtyConsumed : 0;
    const delta = effectiveQty - storedDeducted;

    if (delta > 0) {
      sparesToProcess.push({ spare: consumed, qty: delta, reverseQty: 0, locationName, partKey, lineIndex: i });
    } else if (delta < 0) {
      sparesToProcess.push({ spare: consumed, qty: 0, reverseQty: Math.abs(delta), locationName, partKey, lineIndex: i });
    }
  }

  for (const [compositeKey, prevDeducted] of previousDeductionMap.entries()) {
    if (!currentCompositeKeys.has(compositeKey) && prevDeducted > 0) {
      const [partKey, locName] = compositeKey.split('::');
      const prevEntry = previousConsumed.find(p => {
        const pk = p.partCode || p.partNo;
        const pl = (p.location || p.locationName || '').toLowerCase().trim();
        return pk === partKey && pl === locName;
      });
      if (prevEntry) {
        sparesToProcess.push({ spare: prevEntry, qty: 0, reverseQty: prevDeducted, locationName: prevEntry.location || prevEntry.locationName || '', partKey, lineIndex: -1 });
      }
    }
  }

  return sparesToProcess;
}
