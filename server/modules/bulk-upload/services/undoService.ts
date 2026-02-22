import { calculateRecordChecksum, sortObjectKeys } from '../../../storage';

export function createRecordSnapshot(record: any): { checksum: string; snapshot: string | null } {
  if (!record) {
    return { checksum: '', snapshot: null };
  }
  
  const sorted = sortObjectKeys(record);
  const snapshot = JSON.stringify(sorted, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'function' || typeof value === 'symbol') {
      return undefined;
    }
    return value;
  });
  const checksum = calculateRecordChecksum(sorted);
  
  return { checksum, snapshot };
}
