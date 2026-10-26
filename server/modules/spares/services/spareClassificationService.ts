import { getPool } from '../../../db';
import { hasClassification, mergeSpareClassification, SPARE_CATEGORY_LIST_TYPE } from '../../../../shared/spareClassification';

export async function categoryOptions() {
  const pool = await getPool();
  const result = await pool.query(
    'SELECT list_key AS "listKey", list_value AS "listValue" FROM master_lists WHERE list_type=$1 AND is_active=true AND is_deleted IS NOT TRUE',
    [SPARE_CATEGORY_LIST_TYPE],
  );
  return result.rows as Array<{ listKey: string; listValue: string }>;
}
export async function validateClassification(
  saved: Record<string, any>, patch: Record<string, any>, required = false,
) {
  try {
    const pair = mergeSpareClassification(saved, patch, required);
    if (pair.spareCategory && (required || hasClassification(patch)) &&
        pair.spareCategory !== saved.spareCategory) {
      if (!(await categoryOptions()).some(option => option.listKey === pair.spareCategory)) {
        throw new Error('Select an active Spare Category from the Spares Master List.');
      }
    }
    return pair;
  } catch (error: any) {
    throw Object.assign(error, { statusCode: 400 });
  }
}
