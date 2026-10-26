import { and, eq } from 'drizzle-orm';
import { masterLists } from '@shared/schema';
import { SPARE_CATEGORY_TYPE, mergeSpareClassification } from '@shared/spareClassification';
import { getDb } from '../../db';

export async function classificationForWrite(
  patch: Record<string, any>, saved?: Record<string, any>, required = false, connection?: any,
) {
  if (saved && !required && patch.spareCategory === undefined && patch.optimumQty === undefined) {
    return mergeSpareClassification(saved, {});
  }
  const db = connection || await getDb();
  const categories = await db.select().from(masterLists).where(and(
    eq(masterLists.listType, SPARE_CATEGORY_TYPE), eq(masterLists.isActive, true),
    eq(masterLists.isDeleted, false),
  ));
  const keys = new Set<string>(categories.map((c: any) => c.listKey));
  // An unchanged retired key may be preserved; it cannot be newly selected.
  if (saved?.spareCategory && (patch.spareCategory === undefined || patch.spareCategory === saved.spareCategory)) {
    keys.add(saved.spareCategory);
  }
  return mergeSpareClassification(saved, patch, { required, categoryKeys: keys });
}
