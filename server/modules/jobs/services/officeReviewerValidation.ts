import { normalizeOfficeReviewerRoles, officeReviewerRoleRuidsSchema, validateOfficeReviewerRoles } from '@shared/officeReviewer';
import * as jobRepo from '../repositories/jobRepository';
import { ValidationError } from '../../shared/errors';

export async function validateReviewerSelection(value: unknown, retained: unknown = []): Promise<string[]> {
  try {
    // 23-Oct-2026: the role catalogue is read (through the repository) only when a NEW role ID is added —
    // an empty or unchanged selection needs no lookup, so ordinary Job saves no longer hit the role table.
    const ids = officeReviewerRoleRuidsSchema.parse(value);
    const kept = new Set(normalizeOfficeReviewerRoles(retained));
    const activeRoles = ids.some((id) => !kept.has(id)) ? await jobRepo.getActiveRoles() : [];
    return validateOfficeReviewerRoles(ids, retained, activeRoles);
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : 'Invalid Office Reviewer selection');
  }
}
