import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  normalizeOfficeReviewerRoleRuids, sameOfficeReviewerRoles, validateOfficeReviewerRoles,
} from '../shared/officeReviewer';
import {
  OfficeReviewerRoleSelect, officeReviewerRoleLabel,
} from '../client/src/components/OfficeReviewerRoleSelect';
import { readFileSync } from 'node:fs';
import { rbacMatches } from '../server/middleware/auth';

const roles = [
  { id: 10, ruid: 'A', assignedRole: 'Reviewer', roletype: 'Office', isActive: true, sortOrder: 1 },
  { id: 99, ruid: 'B', assignedRole: 'Reviewer', roletype: 'Vessel', isActive: true, sortOrder: 2 },
  { id: 7, ruid: 'C', assignedRole: 'Superintendent', roletype: 'Office', isActive: true, sortOrder: 3 },
];

describe('Office Reviewer array and catalog contract', () => {
  it.each([null, undefined, []].map(value => ({ value })))('normalizes $value to no selection without a legacy fallback', ({ value }) => {
    expect(normalizeOfficeReviewerRoleRuids(value)).toEqual([]);
  });
  it('uses set contents, deterministic ordering and RUID identity', () => {
    expect(sameOfficeReviewerRoles(['B', 'A'], ['A', 'B'])).toBe(true);
    expect(sameOfficeReviewerRoles(['A'], ['A', 'B'])).toBe(false);
    expect(validateOfficeReviewerRoles(['B', 'A'], [], roles)).toEqual(['A', 'B']);
  });
  it.each(['Office', '["A"]', {}, null, [1], [''], [' '], [' A'], ['A', 'A'], ['unknown']].map(value => ({ value })))(
    'rejects invalid writes $value', ({ value }) => {
      expect(() => validateOfficeReviewerRoles(value, [], roles)).toThrow();
    }
  );
  it('rejects newly selected inactive/deleted roles but retains historical IDs during catalog lag', () => {
    expect(() => validateOfficeReviewerRoles(['X'], [], [{ ruid: 'X', isActive: false }])).toThrow();
    expect(() => validateOfficeReviewerRoles(['X'], [], [{ ruid: 'X', isActive: true, isDeleted: true }])).toThrow();
    expect(validateOfficeReviewerRoles(['X'], ['X'], [])).toEqual(['X']);
    expect(validateOfficeReviewerRoles([], ['X'], [])).toEqual([]);
  });
  it('disambiguates duplicate names by metadata and stable RUID, never by local ID', () => {
    expect(officeReviewerRoleLabel('A', roles)).toBe('Reviewer · Office · A');
    expect(officeReviewerRoleLabel('B', roles)).toBe('Reviewer · Vessel · B');
    expect(officeReviewerRoleLabel('C', roles)).toBe('Superintendent');
    expect(officeReviewerRoleLabel('missing', roles)).toContain('missing');
  });
  it.each([[], ['A'], ['B', 'A']].map(selection => ({ selection })))('renders read-only $selection with role labels', ({ selection }) => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['/technical/api/admin/roles'], roles);
    const markup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(OfficeReviewerRoleSelect, { value: selection, disabled: true })));
    expect(markup).toContain('Office Reviewer');
    if (selection.length === 0) expect(markup).toContain('None');
    else for (const ruid of selection) expect(markup).toContain(officeReviewerRoleLabel(ruid, roles));
    queryClient.clear();
  });
  it('preserves unavailable selected IDs and performs no write while rendering', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['/technical/api/admin/roles'], []);
    const selection = ['missing'];
    let writes = 0;
    const markup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(OfficeReviewerRoleSelect, { value: selection, onChange: () => writes++ })));
    expect(markup).toContain('Role unavailable');
    expect(selection).toEqual(['missing']);
    expect(writes).toBe(0);
    queryClient.clear();
  });
  it('keeps catalog loading, failure and empty states distinct without hardcoded Office options', () => {
    const selector = readFileSync('client/src/components/OfficeReviewerRoleSelect.tsx', 'utf8');
    expect(selector).toContain('rolesQuery.isLoading');
    expect(selector).toContain('rolesQuery.isError');
    expect(selector).toContain('No active roles');
    expect(selector).toContain('/technical/api/admin/roles');
    expect(selector).not.toContain('/available-ranks');
  });
  it('preserves configuration vs authorization: selected RUIDs do not grant or restrict review access', () => {
    const allowed = ['Office', 'PMS Admin', 'Sail Admin'];
    expect(rbacMatches({ roleName: 'Office', userType: 'Office' } as any, allowed)).toBe(true);
    expect(rbacMatches({ roleName: 'Chief Engineer', userType: 'Ship' } as any, allowed)).toBe(false);
    const routes = readFileSync('server/modules/work-orders/routes.ts', 'utf8');
    for (const action of ['reviewer-approve', 'reviewer-reopen']) {
      expect(routes).toContain(`router.post('/work-orders/:id/${action}',\n  requireRole(['Office', 'PMS Admin', 'Sail Admin'])`);
    }
    expect(routes).not.toContain('officeReviewerRoleRuids');
  });
});
