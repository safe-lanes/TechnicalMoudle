import { validateOfficeReviewerRoles } from '@shared/officeReviewer';
import { storage } from '../../../storage';
import { ValidationError } from '../../shared/errors';

export async function validateReviewerSelection(value: unknown, retained: unknown = []): Promise<string[]> {
  try {
    return validateOfficeReviewerRoles(value, retained, await storage.getActiveRoles());
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : 'Invalid Office Reviewer selection');
  }
}
