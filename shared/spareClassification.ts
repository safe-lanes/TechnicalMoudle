/** Stable keys, not editable Master List labels, determine quantity semantics. */
export const SPARE_CATEGORY_LIST_TYPE = 'spareCategory';
export const MAX_OPTIMUM_QTY = 2147483647;
export const SPARE_CATEGORY_LABELS: Record<string, string> = {
  essential: 'Essential', optimum: 'Optimum', general: 'General',
};
export const classificationFields = ['spareCategory', 'optimumQty'] as const;
export const classificationColumns = ['spare_category', 'optimum_qty'] as const;
export type SpareClassification = { spareCategory: string | null; optimumQty: number | null };
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
export function hasClassification(value: Record<string, any>): boolean {
  return [...classificationFields, ...classificationColumns].some(key => own(value, key));
}
export function normalizeClassificationPatch(value: Record<string, any>): Record<string, any> {
  const patch: Record<string, any> = {};
  for (let i = 0; i < classificationFields.length; i++) {
    const key = classificationFields[i], column = classificationColumns[i];
    if (own(value, key)) patch[key] = value[key];
    else if (own(value, column)) patch[key] = value[column];
  }
  return patch;
}
export function mergeSpareClassification(
  saved: Record<string, any> = {}, incoming: Record<string, any> = {}, required = false,
): SpareClassification {
  const current = normalizeClassificationPatch(saved);
  const patch = normalizeClassificationPatch(incoming);
  const merged = { ...current, ...patch };
  const rawCategory = merged.spareCategory;
  const spareCategory = rawCategory == null || rawCategory === '' ? null : String(rawCategory).trim();
  const rawQty = merged.optimumQty;
  let optimumQty: number | null = null;
  if (rawQty !== null && rawQty !== undefined && rawQty !== '') {
    if ((typeof rawQty !== 'number' && typeof rawQty !== 'string') ||
        (typeof rawQty === 'string' && !/^\d+$/.test(rawQty.trim()))) {
      throw new Error('Optimum Qty must be a positive whole number.');
    }
    optimumQty = Number(rawQty);
    if (!Number.isInteger(optimumQty) || optimumQty <= 0 || optimumQty > MAX_OPTIMUM_QTY) {
      throw new Error(`Optimum Qty must be a positive whole number no greater than ${MAX_OPTIMUM_QTY}.`);
    }
  }
  if (required && !spareCategory) throw new Error('Spare Category is required.');
  if (spareCategory === 'optimum' && optimumQty === null) {
    throw new Error('Optimum Qty is required for the Optimum category.');
  }
  if (spareCategory !== 'optimum' && optimumQty !== null) {
    throw new Error('Optimum Qty must be blank unless Spare Category is Optimum.');
  }
  return { spareCategory, optimumQty };
}
export function importSpareClassification(
  row: Record<string, any>, options: Array<{ listKey: string; listValue: string }>,
): Partial<SpareClassification> {
  const hasCategory = own(row, 'Spare Category');
  const hasQty = own(row, 'Optimum Qty');
  if (!hasCategory && !hasQty) return {}; // structural legacy exception; never default
  if (hasCategory !== hasQty) throw new Error('Template must include both Spare Category and Optimum Qty columns.');
  const value = String(row['Spare Category'] ?? '').trim().toLowerCase();
  const matches = options.filter(option =>
    option.listKey.toLowerCase() === value || option.listValue.trim().toLowerCase() === value);
  if (!value || matches.length !== 1) throw new Error('Select a valid Spare Category from the Spares Master List.');
  return mergeSpareClassification({}, {
    spareCategory: matches[0].listKey, optimumQty: row['Optimum Qty'],
  }, true);
}
