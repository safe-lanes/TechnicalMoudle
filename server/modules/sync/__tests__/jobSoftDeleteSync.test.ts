import { describe, expect, it } from 'vitest';
import { getSoftDeleteSetClause } from '../oneWayApplier';

describe('one-way Job soft deletion', () => {
  it('marks the receiving Job deleted and inactive together', () => {
    expect(getSoftDeleteSetClause('jobs')).toBe(
      'is_deleted = true, is_active = false, updated_at = NOW()'
    );
  });

});