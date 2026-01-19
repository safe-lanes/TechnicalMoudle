import type { Defect } from "@shared/schema";
import { 
  COMPUTED_STATUS, 
  COMPUTED_ACTIVE_STATUSES as SHARED_COMPUTED_ACTIVE_STATUSES,
  COMPUTED_RESOLVED_STATUSES as SHARED_COMPUTED_RESOLVED_STATUSES,
  type ComputedDefectStatus 
} from "@shared/defectStatus";

export interface ComputedStatus {
  label: ComputedDefectStatus;
  color: string;
}

export const getComputedStatus = (defect: Partial<Defect>): ComputedStatus => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      date.setHours(0, 0, 0, 0);
      return date;
    }
    const ddMmYyyyMatch = String(dateStr).match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (ddMmYyyyMatch) {
      const [, day, month, year] = ddMmYyyyMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      date.setHours(0, 0, 0, 0);
      return date;
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  };
  
  const dateCompleted = parseDate(defect.dateCompleted);
  const targetCloseDate = parseDate(defect.targetCloseDate);
  const hasActions = defect.actions && Array.isArray(defect.actions) && defect.actions.length > 0;
  const isExtended = defect.isDeferred === true;
  
  if (defect.verified === true) {
    return { label: COMPUTED_STATUS.VERIFIED, color: 'text-[#00AF7B]' };
  }
  
  if (dateCompleted && targetCloseDate && dateCompleted <= targetCloseDate) {
    return { label: COMPUTED_STATUS.CLOSED, color: 'text-[#5dc86f]' };
  }
  
  if (dateCompleted && targetCloseDate && dateCompleted > targetCloseDate) {
    return { label: COMPUTED_STATUS.CLOSED, color: 'text-orange-500' };
  }
  
  if (dateCompleted) {
    return { label: COMPUTED_STATUS.CLOSED, color: 'text-[#5dc86f]' };
  }
  
  if (!dateCompleted && targetCloseDate && today > targetCloseDate && !isExtended) {
    return { label: COMPUTED_STATUS.OVERDUE, color: 'text-red-600' };
  }
  
  if (isExtended) {
    return { label: COMPUTED_STATUS.EXTENDED, color: 'text-blue-600' };
  }
  
  if (hasActions) {
    return { label: COMPUTED_STATUS.IN_PROGRESS, color: 'text-blue-600' };
  }
  
  return { label: COMPUTED_STATUS.REPORTED, color: 'text-gray-600' };
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
