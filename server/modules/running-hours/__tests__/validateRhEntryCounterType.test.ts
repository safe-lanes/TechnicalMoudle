import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateRHEntry } from '../controllers/runningHoursController';
import * as rhTimelineValidation from '../services/rhTimelineValidationService';

vi.mock('../services/rhTimelineValidationService', () => ({
  validateRHEntry: vi.fn(),
  getCurrentRH: vi.fn(),
}));

describe('RH validation counter type response', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rhTimelineValidation.validateRHEntry).mockResolvedValue({
      isValid: false,
      validationStatus: 'INVALID',
      errorMessage: 'RH outside allowed range',
      requiresJustification: true,
      validRange: null,
    } as any);
  });

  it.each([
    ['NOT_RH_DRIVEN', 'NOT_APPLICABLE', true],
    ['NOT RH DRIVEN', 'NOT_APPLICABLE', true],
    ['MASTER', 'INVALID', false],
    ['INHERITED', 'INVALID', false],
    ['UNKNOWN', 'INVALID', false],
    ['', 'INVALID', false],
  ])('returns the expected validation for %s', async (type, status, valid) => {
    vi.mocked(rhTimelineValidation.getCurrentRH).mockResolvedValue({
      rhCounterType: type,
      currentRH: 700,
      hasRealRhBaseline: true,
    } as any);
    const req = { body: { machineryId: 'comp-1', completionDate: '2026-08-01', runningHours: 700 } };
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

    await validateRHEntry(req as any, res as any);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      rhCounterType: type === 'NOT RH DRIVEN' ? 'NOT_RH_DRIVEN' : (type || 'MASTER'),
      validationStatus: status,
      isValid: valid,
    }));
    if (valid) {
      expect(res.json.mock.calls[0][0]).toMatchObject({
        errorMessage: '', requiresJustification: false,
      });
    }
  });
});