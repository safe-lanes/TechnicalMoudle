import { describe, expect, it } from 'vitest';
import { getSoftDeleteSetClause } from '../oneWayApplier';

describe('one-way Component soft deletion', () => {
  it('marks the receiving Component deleted and inactive together', () => {
    expect(getSoftDeleteSetClause('components')).toBe(
      'is_deleted = true, is_active = false, updated_at = NOW()'
    );
  });
});