/**
 * Most mixed-version unknown columns retain the legacy skip-and-ack behavior
 * because their values are recovered by their table's full-row sync path.
 *
 * vessel_certificate_data is field-log driven, so certificate_number has no
 * equivalent full-row guarantee. Keep its row unacknowledged until the older
 * receiver applies migration 175, then normal field-log retry delivers it.
 */
export function shouldRetryUnknownSyncColumn(tableName: string, columnName: string): boolean {
  return tableName === 'vessel_certificate_data' && columnName === 'certificate_number';
}