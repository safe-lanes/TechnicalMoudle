import { describe, expect, it } from 'vitest';
import { trimDefectIdentityFields } from '../services/defectsService';

// Sahil D1 (25-Sep-2026): closure / verification identity must be stored trimmed.
describe('trimDefectIdentityFields', () => {
  it('trims every closure and verification identity field', () => {
    const out = trimDefectIdentityFields({
      closedByName: 'Peter ', closedByRank: ' Master', closedOutByName: '  A B  ', closedOutByRank: 'Master\t',
      verifiedByName: ' Supt ', verifiedByOfficePosition: 'Tech Supt ', description: ' keep me ',
    });
    expect(out).toMatchObject({
      closedByName: 'Peter', closedByRank: 'Master', closedOutByName: 'A B', closedOutByRank: 'Master',
      verifiedByName: 'Supt', verifiedByOfficePosition: 'Tech Supt',
    });
    expect(out.description).toBe(' keep me '); // other fields untouched
  });
  it('returns the same object when nothing needs trimming, and ignores non-strings', () => {
    const body = { closedByName: 'Peter', confirmCompleted: true, closedByRank: null };
    expect(trimDefectIdentityFields(body)).toBe(body);
  });
});

// Sahil E11 / Q12 (25-Sep-2026): the older closure fields are no longer written.
import { dropRetiredClosureFields } from '../services/defectsService';
describe('dropRetiredClosureFields', () => {
  it('drops closedOutByName/Rank and closedBy/closedOn, keeps the authoritative pair', () => {
    const out = dropRetiredClosureFields({ closedByName: 'Peter', closedByRank: 'Master', closedOutByName: 'x', closedOutByRank: 'y', closedBy: 'z', closedOn: '2026-01-01', status: 'Open' });
    expect(out).toEqual({ closedByName: 'Peter', closedByRank: 'Master', status: 'Open' });
  });
  it('returns the same object when none are present', () => {
    const body = { closedByName: 'Peter' };
    expect(dropRetiredClosureFields(body)).toBe(body);
  });
});
