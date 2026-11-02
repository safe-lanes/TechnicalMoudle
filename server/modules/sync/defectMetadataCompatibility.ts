/** Preserve held logs; callers must use this same policy when acknowledging rows. */
export function protectDefectPushAcknowledgement(result: any, heldRows: Set<string>) {
  return { ...result,
    ...(Array.isArray(result.appliedRowUuids) ? { appliedRowUuids: result.appliedRowUuids.filter((row: string) => !heldRows.has(row)) } : {}),
    droppedRowUuids: Array.from(new Set([...(result.droppedRowUuids ?? []), ...Array.from(heldRows)])),
    ...(heldRows.size ? { defectFieldsHeld: heldRows.size } : {}) };
}
export function hasExternalDefectValue(value: unknown): boolean {
  if (typeof value === 'string') {
    try { return hasExternalDefectValue(JSON.parse(value)); } catch { return false; }
  }
  if (Array.isArray(value)) return value.some(hasExternalDefectValue);
  return Boolean(value && typeof value === 'object' &&
    ((value as any).storageVersion === 1 || Object.values(value).some(hasExternalDefectValue)));
}
export function filterDefectLogs<T extends { tableName?: string; table_name?: string; fieldName?: string; field_name?: string; newValue?: unknown; new_value?: unknown }>(logs: T[], ready: boolean): T[] {
  if (ready) return logs;
  return logs.filter(log => (log.tableName ?? log.table_name) !== 'defects' ||
    (!['partCAttachments', 'part_c_attachments'].includes(log.fieldName ?? log.field_name ?? '') &&
      !hasExternalDefectValue(log.newValue ?? log.new_value) &&
      !hasExternalDefectValue((log as any).oldValue ?? (log as any).old_value) &&
      !hasNestedC1(log.newValue ?? log.new_value)));
}
function hasNestedC1(value: any): boolean {
  if (typeof value === 'string') { try { return hasNestedC1(JSON.parse(value)); } catch { return false; } }
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value).some(k => ['partCAttachments', 'part_c_attachments'].includes(k) || hasNestedC1(value[k]));
}
export function filterDefectRows<T extends { tableName: string; rows: any[] }>(batches: T[], ready: boolean): T[] {
  if (ready) return batches;
  return batches.map(batch => batch.tableName !== 'defects' ? batch : {
    ...batch, rows: batch.rows.filter(row => !hasExternalDefectValue(row)).map(row => {
      const safe = { ...row }; delete safe.partCAttachments; delete safe.part_c_attachments; return safe;
    }),
  });
}
