/** Stable policy keys, independent of editable Master List labels. */
export const SPARE_CATEGORY_TYPE = 'spareCategory';
export const OPTIMUM_CATEGORY = 'optimum';
export const MAX_OPTIMUM_QTY = 2147483647;
// Compatibility names used by the existing Master List/import consumers.
export const SPARE_CATEGORY_LIST_TYPE = SPARE_CATEGORY_TYPE;
export const SPARE_CATEGORY_LABELS: Record<string, string> = {
  essential: 'Essential', optimum: 'Optimum', general: 'General',
};
export const classificationFields = ['spareCategory', 'optimumQty'] as const;
export const classificationColumns = ['spare_category', 'optimum_qty'] as const;
export function hasClassification(value: Record<string, any>): boolean {
  return [...classificationFields, ...classificationColumns].some(key =>
    Object.prototype.hasOwnProperty.call(value, key));
}
export function normalizeClassificationPatch(value: Record<string, any> = {}): Record<string, any> {
  const patch: Record<string, any> = {};
  classificationFields.forEach((key, index) => {
    const column = classificationColumns[index];
    if (Object.prototype.hasOwnProperty.call(value, key)) patch[key] = value[key];
    else if (Object.prototype.hasOwnProperty.call(value, column)) patch[key] = value[column];
  });
  return patch;
}
export interface SpareClassification {
  spareCategory: string | null;
  optimumQty: number | null;
}

export function validateSpareClassification(
  value: { spareCategory?: unknown; optimumQty?: unknown },
  options: { required?: boolean; categoryKeys?: ReadonlySet<string> } = {},
): SpareClassification {
  const fail = (message: string): never => {
    throw Object.assign(new Error(message), { statusCode: 400 });
  };
  const category = value.spareCategory == null || value.spareCategory === ''
    ? null : typeof value.spareCategory === 'string' ? value.spareCategory.trim() || null
    : fail('Spare Category must be a valid Master List key.');
  if (!category && options.required) fail('Spare Category is required.');
  if (category && options.categoryKeys && !options.categoryKeys.has(category)) {
    fail(`Unknown Spare Category '${category}'. Select a category from Master List > Spares.`);
  }
  const raw = value.optimumQty;
  const blank = raw == null || raw === '';
  if (category !== OPTIMUM_CATEGORY) {
    if (!blank) fail('Optimum Qty must be blank unless Spare Category is Optimum.');
    return { spareCategory: category, optimumQty: null };
  }
  if (blank || (typeof raw !== 'number' && typeof raw !== 'string') ||
      (typeof raw === 'string' && !/^\d+$/.test(raw.trim()))) {
    fail('Optimum Qty must be a positive whole number between 1 and 2147483647.');
  }
  const qty = Number(raw);
  if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_OPTIMUM_QTY) {
    fail('Optimum Qty must be a positive whole number between 1 and 2147483647.');
  }
  return { spareCategory: category, optimumQty: qty };
}

/** Omitted fields are not nulls. Never repair a partial update by clearing its other half. */
export function mergeSpareClassification(
  saved: Record<string, any> | undefined,
  patch: Record<string, any>,
  options: { required?: boolean; categoryKeys?: ReadonlySet<string> } | boolean = {},
): SpareClassification {
  saved = normalizeClassificationPatch(saved);
  patch = normalizeClassificationPatch(patch);
  return validateSpareClassification({
    spareCategory: patch.spareCategory !== undefined ? patch.spareCategory : saved?.spareCategory,
    optimumQty: patch.optimumQty !== undefined ? patch.optimumQty : saved?.optimumQty,
  }, typeof options === 'boolean' ? { required: options } : options);
}

/** Structure, never cell contents, distinguishes an old template from a new one. */
export function spareClassificationTemplateMode(headers: string[]): 'legacy' | 'classified' {
  const normalized = headers.map(h => String(h).trim().toLowerCase().replace(/[\s_-]+/g, ''));
  const category = normalized.includes('sparecategory');
  const quantity = normalized.includes('optimumqty') || normalized.includes('optimumquantity');
  if (category !== quantity) throw Object.assign(new Error(
    'Incomplete spare field mapping: Spare Category and Optimum Qty must both be mapped, or both absent for a legacy template.',
  ), { statusCode: 400 });
  return category ? 'classified' : 'legacy';
}

/** Preserve the original import API, with key precedence over editable labels. */
export function importSpareClassification(
  row: Record<string, any>, categories: Array<{ listKey: string; listValue: string }>,
): Partial<SpareClassification> {
  if (spareClassificationTemplateMode(Object.keys(row)) === 'legacy') return {};
  const raw = String(row['Spare Category'] ?? '').trim();
  const exact = categories.find(category => category.listKey === raw);
  const matches = exact ? [exact] : categories.filter(category => category.listValue.trim().toLowerCase() === raw.toLowerCase());
  if (!raw || matches.length !== 1) throw Object.assign(new Error('Select a valid Spare Category from the Spares Master List.'), { statusCode: 400 });
  return validateSpareClassification({ spareCategory: matches[0].listKey, optimumQty: row['Optimum Qty'] }, { required: true });
}
