/**
 * Services Index
 * Central export point for all business logic services
 * 
 * Service Layer Architecture:
 * - jobService: Job CRUD, validation, next due date calculation, auto-generation
 * - workOrderService: Work order status computation, filtering, bulk operations
 * - runningHoursService: Cascade updates, automatic WO generation from RH thresholds
 * - componentService: Hierarchical component queries, tree navigation
 * - jobDueScanner: Scheduled scanner that generates work orders when jobs become due
 */

export { jobService, JobService } from './jobService';
export { workOrderService, WorkOrderService } from './workOrderService';
export { runningHoursService, RunningHoursService } from './runningHoursService';
export { componentService, ComponentService } from './componentService';
export { jobDueScanner, JobDueScannerService } from './jobDueScanner';
