import { classificationForWrite } from '../../spares/classification';
import { spareClassificationTemplateMode, SPARE_CATEGORY_TYPE } from '@shared/spareClassification';
import { storage } from '../../../storage';

export async function spareClassificationImport(row: Record<string, any>, headers = Object.keys(row)) {
  const mode = spareClassificationTemplateMode(headers);
  if (mode === 'legacy') return {};
  const categories = await storage.getMasterLists(SPARE_CATEGORY_TYPE);
  const input = String(row['Spare Category'] ?? '').trim();
  const active = categories.filter((c: any) => c.isActive && !c.isDeleted);
  const exactKey = active.find((c: any) => c.listKey === input);
  const matches = exactKey ? [exactKey] : active.filter((c: any) => c.listValue.toLowerCase() === input.toLowerCase());
  if (matches.length !== 1) throw new Error(
    `Spare Category '${input}' is ${input ? 'invalid or ambiguous' : 'blank'}. Use a unique Master List category key or current label.`,
  );
  return classificationForWrite({
    spareCategory: matches[0].listKey,
    optimumQty: row['Optimum Qty'] ?? row['Optimum Quantity'] ?? null,
  }, undefined, true);
}
