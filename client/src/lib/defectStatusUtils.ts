import type { Defect } from "@shared/schema";
import { 
  COMPUTED_STATUS, 
  COMPUTED_ACTIVE_STATUSES as SHARED_COMPUTED_ACTIVE_STATUSES,
  COMPUTED_RESOLVED_STATUSES as SHARED_COMPUTED_RESOLVED_STATUSES,
  type ComputedDefectStatus,
  computeDefectStatus,
  parseDefectDate,
} from "@shared/defectStatus";

export interface ComputedStatus {
  label: ComputedDefectStatus;
  color: string;
}

/** Label from the ONE shared policy (shared/defectStatus.ts computeDefectStatus); colour here. */
export const getComputedStatus = (defect: Partial<Defect>): ComputedStatus => {
  const label = computeDefectStatus(defect);
  switch (label) {
    case COMPUTED_STATUS.VERIFIED: return { label, color: 'text-[#00AF7B]' };
    case COMPUTED_STATUS.CLOSED: {
      const done = parseDefectDate(defect.dateCompleted);
      const target = parseDefectDate(defect.targetCloseDate);
      return { label, color: done && target && done > target ? 'text-orange-500' : 'text-[#5dc86f]' };
    }
    case COMPUTED_STATUS.OVERDUE: return { label, color: 'text-red-600' };
    case COMPUTED_STATUS.EXTENDED: return { label, color: 'text-blue-600' };
    case COMPUTED_STATUS.IN_PROGRESS: return { label, color: 'text-blue-600' };
    default: return { label, color: 'text-gray-600' };
  }
};

export { COMPUTED_STATUS };
export const COMPUTED_ACTIVE_STATUSES = SHARED_COMPUTED_ACTIVE_STATUSES;
export const COMPUTED_RESOLVED_STATUSES = SHARED_COMPUTED_RESOLVED_STATUSES;

export const isActiveComputedStatus = (status: string): boolean => {
  return (COMPUTED_ACTIVE_STATUSES as readonly string[]).includes(status);
};

export const isResolvedComputedStatus = (status: string): boolean => {
  return (COMPUTED_RESOLVED_STATUSES as readonly string[]).includes(status);
};
