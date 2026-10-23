import { describe, expect, it } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { jobs, insertJobSchema } from '../../../../shared/schema';
import {
  officeReviewerRoleRuidsSchema, normalizeOfficeReviewerRoles, officeReviewerRolesEqual,
  requiresOfficeReview, validateOfficeReviewerRoles, normalizeApprovalOverride, approvalValuesEqual,
  jobRequiresOfficeReview,
} from '../../../../shared/officeReviewer';

describe('Office Reviewer configuration contract', () => {
  it('maps the only active configuration to a JSONB column', () => {
    const column = getTableColumns(jobs).officeReviewerRoleRuids;
    expect(column.name).toBe('office_reviewer_role_ruids');
    expect(column.getSQLType()).toBe('jsonb');
    expect(column.default).toEqual([]);
    expect(insertJobSchema.shape.officeReviewerRoleRuids.parse(undefined)).toEqual([]);
  });

  it.each([undefined, null, [], 'Office'])('does not infer legacy selection from %j', value => {
    expect(normalizeOfficeReviewerRoles(value)).toEqual([]);
    expect(requiresOfficeReview(value)).toBe(false);
  });

  it('compares role sets and uses stable serialization order', () => {
    expect(officeReviewerRolesEqual(['B', 'A'], ['A', 'B'])).toBe(true);
    expect(officeReviewerRolesEqual(['A', 'B'], ['A'])).toBe(false);
    expect(normalizeOfficeReviewerRoles(['B', 'A'])).toEqual(['A', 'B']);
    expect(requiresOfficeReview(['A'])).toBe(true);
  });

  it.each(['A,B', '["A"]', {}, [1], [''], [' A'], ['A', 'A'], null])(
    'rejects malformed arrays %j', value => {
      expect(officeReviewerRoleRuidsSchema.safeParse(value).success).toBe(false);
      expect(() => validateOfficeReviewerRoles(value, [], ['A'])).toThrow();
    },
  );

  it('validates additions, retains historical IDs and replaces rather than appends', () => {
    expect(validateOfficeReviewerRoles(['A', 'C'], ['A', 'B'], ['C'])).toEqual(['A', 'C']);
    expect(validateOfficeReviewerRoles(['A'], ['A'], [])).toEqual(['A']);
    expect(validateOfficeReviewerRoles([], ['A'], [])).toEqual([]);
    expect(() => validateOfficeReviewerRoles(['D'], ['A'], ['C'])).toThrow(/not active/);
  });

  it('keeps approval arrays typed, including empty overrides', () => {
    expect(normalizeApprovalOverride('officeReviewerRoleRuids', ['B', 'A'])).toEqual(['A', 'B']);
    expect(normalizeApprovalOverride('officeReviewerRoleRuids', [])).toEqual([]);
    expect(() => normalizeApprovalOverride('officeReviewerRoleRuids', 'A,B')).toThrow();
    expect(normalizeApprovalOverride('jobTitle', 'Text')).toBe('Text');
    expect(approvalValuesEqual('officeReviewerRoleRuids', ['A', 'B'], ['B', 'A'])).toBe(true);
    expect(approvalValuesEqual('officeReviewerRoleRuids', ['A'], [])).toBe(false);
  });
});

// Ghazi, 23-Oct-2026: roles decide; while they are empty the legacy "Reviewer Rank" keeps review on.
describe('jobRequiresOfficeReview', () => {
  it.each([
    [{ officeReviewerRoleRuids: ['A'], level2ReviewerRankId: null }, true],
    [{ officeReviewerRoleRuids: [], level2ReviewerRankId: 'Office' }, true],
    [{ officeReviewerRoleRuids: null, level2ReviewerRankId: 'Office' }, true],
    [{ officeReviewerRoleRuids: [], level2ReviewerRankId: '  ' }, false],
    [{ officeReviewerRoleRuids: [], level2ReviewerRankId: null }, false],
    [null, false],
  ])('%j → %s', (job, expected) => {
    expect(jobRequiresOfficeReview(job as any)).toBe(expected);
  });
});
