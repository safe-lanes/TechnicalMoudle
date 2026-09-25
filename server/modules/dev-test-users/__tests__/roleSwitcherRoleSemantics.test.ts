import { describe, expect, it } from 'vitest';
import {
  compareExactRoleStrings,
  exactUserRole,
  userMatchesResolverRole,
} from '../../../../client/src/components/testIdentityRoleSemantics';

describe('RoleSwitcher resolver role semantics', () => {
  it('preserves the exact stored role string without trimming', () => {
    expect(exactUserRole({ role: 'Admin ' })).toBe('Admin ');
    expect(exactUserRole({ role: 'Admin' })).toBe('Admin');
  });

  it('keeps visually similar but resolver-distinct roles separate', () => {
    expect(userMatchesResolverRole({ role: 'Admin' }, 'Admin')).toBe(true);
    expect(userMatchesResolverRole({ role: 'Admin ' }, 'Admin')).toBe(false);
    expect(userMatchesResolverRole({ role: 'admin' }, 'Admin')).toBe(false);
  });

  it('sorts resolver-distinct strings into separate role blocks before names', () => {
    const users = [
      { role: 'admin', name: 'Aaron' },
      { role: 'Admin', name: 'Zoe' },
      { role: 'Admin ', name: 'Bob' },
      { role: 'Admin', name: 'Amy' },
    ];
    users.sort((left, right) =>
      compareExactRoleStrings(left.role, right.role) ||
      left.name.localeCompare(right.name),
    );

    expect(users.map((user) => `${user.role}|${user.name}`)).toEqual([
      'Admin|Amy',
      'Admin|Zoe',
      'admin|Aaron',
      'Admin |Bob',
    ]);
  });
});