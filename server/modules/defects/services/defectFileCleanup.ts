import { sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import { getCurrentTenantContext } from '../../../utils/asyncLocalStorage';
import { defectFileStore } from './defectFileStorage';
import { stagingNamespace, type StagedDefectFile } from './defectFileStaging';

/** Call within each installation/tenant's maintenance context; never cross tenants. */
export async function cleanupExpiredDefectStages(now = Date.now()) {
  const tenant = getCurrentTenantContext()?.tuid ?? 'single-tenant';
  const namespace = stagingNamespace({ tenant } as any);
  const db = await getDb();
  const backend = defectFileStore.backend();
  let removed = 0;
  for (const key of await defectFileStore.manifests(backend)) {
    if (!key.startsWith(`${namespace}/`)) continue;
    const manifest: StagedDefectFile = JSON.parse((await defectFileStore.read(key, backend, true)).toString());
    if (manifest.tenant !== tenant || manifest.expiresAt > now) continue;
    await db.transaction(async tx => {
      // Same lock as finalization, then recheck DB references while holding it.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${manifest.token}))`);
      const search = `%${manifest.attachment.fileKey}%`;
      const idSearch = `%${manifest.attachment.id}%`;
      const refs = await tx.execute(sql`
        SELECT 1 FROM defects d WHERE to_jsonb(d)::text LIKE ${search}
        UNION ALL SELECT 1 FROM defect_closure_history h WHERE to_jsonb(h)::text LIKE ${search} OR to_jsonb(h)::text LIKE ${idSearch}
        UNION ALL SELECT 1 FROM defect_attachments a WHERE to_jsonb(a)::text LIKE ${search} OR to_jsonb(a)::text LIKE ${idSearch}
        UNION ALL SELECT 1 FROM defect_actions a WHERE to_jsonb(a)::text LIKE ${search} OR to_jsonb(a)::text LIKE ${idSearch}
        UNION ALL SELECT 1 FROM sync_file_queue q WHERE q.file_key = ${manifest.attachment.fileKey}
        LIMIT 1`);
      // Only delete promoted orphan bytes when no business/history/queue
      // reference exists. Committed files have no expiry.
      if (!refs.rows.length) await defectFileStore.remove(manifest.attachment.fileKey, manifest.attachment.backend);
      await defectFileStore.remove(key.replace(/\.json$/, '.bin'), backend, true);
      await defectFileStore.remove(key, backend, true);
      removed++;
    });
  }
  return removed;
}
