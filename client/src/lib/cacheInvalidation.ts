import { queryClient } from "./queryClient";

/**
 * Cache Invalidation Helpers
 * 
 * These functions provide domain-specific cache invalidation to ensure
 * the UI always shows fresh data after mutations or imports.
 * 
 * Call these after any data modification (create, update, delete, import)
 * to prevent stale data from causing apparent "regressions".
 * 
 * IMPORTANT: Uses predicate matching to catch ALL query key patterns:
 * - ['/technical/api/components']
 * - ['/technical/api/components', vesselId]
 * - [`/technical/api/components/${vesselId}`]
 * - ['/technical/api/components/details/${id}']
 * - [{scope: '/technical/api/components', vesselId}] (object-based keys)
 */

// Helper to check if any part of a query key matches a prefix
function queryKeyMatchesPrefix(queryKey: readonly unknown[], prefix: string): boolean {
  return queryKey.some((segment) => {
    if (typeof segment === 'string') {
      return segment.startsWith(prefix);
    }
    // Check object-based keys (e.g., {scope: '/technical/api/components'})
    if (segment && typeof segment === 'object') {
      const obj = segment as Record<string, unknown>;
      return Object.values(obj).some(
        val => typeof val === 'string' && val.startsWith(prefix)
      );
    }
    return false;
  });
}

export function invalidateComponents(vesselId?: string) {
  // Use predicate to match all component-related queries
  queryClient.invalidateQueries({
    predicate: (query) => queryKeyMatchesPrefix(query.queryKey, '/technical/api/components')
  });
  
  // Also invalidate running hours which depend on components
  queryClient.invalidateQueries({
    predicate: (query) => queryKeyMatchesPrefix(query.queryKey, '/technical/api/running-hours')
  });
}

export function invalidateJobs(vesselId?: string) {
  // Use predicate to match all job-related queries
  queryClient.invalidateQueries({
    predicate: (query) => queryKeyMatchesPrefix(query.queryKey, '/technical/api/jobs')
  });
  
  // Jobs affect work orders
  invalidateWorkOrders(vesselId);
}

export function invalidateWorkOrders(vesselId?: string) {
  // Use predicate to match all work-order-related queries
  queryClient.invalidateQueries({
    predicate: (query) => queryKeyMatchesPrefix(query.queryKey, '/technical/api/work-orders')
  });
}

export function invalidateSpares(vesselId?: string) {
  // Use predicate to match all spare-related queries
  queryClient.invalidateQueries({
    predicate: (query) => 
      queryKeyMatchesPrefix(query.queryKey, '/technical/api/spares') || 
      queryKeyMatchesPrefix(query.queryKey, '/technical/api/spare-transactions')
  });
}

export function invalidateStores() {
  // Use predicate to match all stores-related queries
  queryClient.invalidateQueries({
    predicate: (query) => queryKeyMatchesPrefix(query.queryKey, '/technical/api/stores')
  });
}

export function invalidateVessels() {
  queryClient.invalidateQueries({ queryKey: ['/technical/api/vessels'] });
}

export function invalidateChangeRequests() {
  queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
  queryClient.invalidateQueries({ queryKey: ['/technical/api/import-change-logs'] });
}

export function invalidateAll(vesselId?: string) {
  invalidateComponents(vesselId);
  invalidateJobs(vesselId);
  invalidateWorkOrders(vesselId);
  invalidateSpares(vesselId);
  invalidateStores();
  invalidateVessels();
  invalidateChangeRequests();
}

export function invalidateAfterBulkImport(type: string, vesselId?: string) {
  switch (type) {
    case 'components':
      invalidateComponents(vesselId);
      invalidateJobs(vesselId);
      break;
    case 'jobs':
      invalidateJobs(vesselId);
      invalidateWorkOrders(vesselId);
      break;
    case 'spares':
      invalidateSpares(vesselId);
      break;
    case 'stores':
      invalidateStores();
      break;
    case 'work-orders':
      invalidateWorkOrders(vesselId);
      break;
    default:
      invalidateAll(vesselId);
  }
}
