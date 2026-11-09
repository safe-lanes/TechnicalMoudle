import { seedDefaults } from "../repositories/formsMasterRepository";
import { tenantStorage, type TenantContext } from "../../../utils/asyncLocalStorage";
import { runWithSystemAuditContext } from "../../../middleware/requestContext";
import { getEffectiveInstanceId } from "../../sync/syncRole";

/** Runs after tracked migrations + sync identity initialization, before routes. */
export async function seedPmsFormsMasterDefaults() {
  return runWithSystemAuditContext(async () => {
    try {
      const stats = await seedDefaults();
      console.log("[FormsMaster] Deterministic defaults:", JSON.stringify(stats));
      return stats;
    } catch (error) {
      console.error("[FormsMaster] Default seed aborted; transaction rolled back. Resolve conflicting names, codes, IDs or seed keys without replacing customer records.", error);
      throw error;
    }
  });
}

/**
 * The tenant manager's existing lazy startup owns the migration callback.
 * Do not publish/cache the pool until tracked migrations AND seeding succeed.
 * This also covers tenants created after the process itself has started.
 */
export async function initializePmsFormsMasterTenant(context: TenantContext, migrate: () => Promise<void>) {
  return tenantStorage.run(context, async () => {
    await migrate();
    const instanceId = (await getEffectiveInstanceId()).trim().toUpperCase();
    if (!instanceId || ["UNKNOWN", "SHIP-VESSELNAME"].includes(instanceId))
      throw new Error("Forms Master tenant startup requires a configured sync instance identity.");
    return seedPmsFormsMasterDefaults();
  });
}
