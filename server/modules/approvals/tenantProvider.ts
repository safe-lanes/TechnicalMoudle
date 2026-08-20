/**
 * Phase 2 / W1 — TenantRepositoryProvider over the EXISTING tenant machinery (design v3 §A7
 * "reuse by injection"). Inside a tenant request the ALS context carries the tenant's pool
 * (tenantMiddleware resolved it); single-tenant / pilot has no context and uses the app's
 * base pool. The engine's tenantId therefore mirrors the ALS tuid ('default' otherwise) —
 * resolveTenantId in mount.ts and this provider read the SAME source, so they cannot diverge.
 */
import { DrizzleApprovalRepository, type TenantRepositoryProvider } from '../approval-engine';
import { getCurrentTenantContext } from '../../utils/asyncLocalStorage';
import { getPostgresClient } from '../../postgresClient';

export function currentEngineTenantId(): string {
  return getCurrentTenantContext()?.tuid ?? 'default';
}

export class AlsTenantRepositoryProvider implements TenantRepositoryProvider {
  private repos = new Map<string, DrizzleApprovalRepository>();

  forTenant(tenantId: string): DrizzleApprovalRepository {
    const ctx = getCurrentTenantContext();
    const ctxTenant = ctx?.tuid ?? 'default';
    if (tenantId !== ctxTenant) {
      // The engine is always invoked from within the request/job that owns the tenant
      // context; a mismatch means a caller forged the tenant id — refuse.
      throw new Error(`[approvals] tenant mismatch: engine ctx '${tenantId}' vs ALS '${ctxTenant}'`);
    }
    let repo = this.repos.get(tenantId);
    if (!repo) {
      const pool = ctx?.pool ?? getPostgresClient().pool;
      repo = new DrizzleApprovalRepository(pool as any);
      this.repos.set(tenantId, repo);
    }
    return repo;
  }
}
