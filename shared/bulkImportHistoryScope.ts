// These templates are managed in Fleet Data Import mode, without a vessel.
export function isGlobalBulkImportType(type?: string): boolean {
  return type === 'makers' ||
    type === 'fleet-components' ||
    type === 'fleet-jobs' ||
    type === 'fleet-spares';
}
