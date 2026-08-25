import { describe, expect, it } from 'vitest';
import { getSoftDeleteSetClause } from '../oneWayApplier';

describe('one-way Job soft deletion', () => {
  it('marks the receiving Job deleted and inactive together', () => {
    expect(getSoftDeleteSetClause('jobs')).toBe(
      'is_deleted = true, is_active = false, updated_at = NOW()'
    );
  });

  it('keeps the standard deletion behavior for other synced tables', () => {
    expect(getSoftDeleteSetClause('components')).toBe(
      'is_deleted = true, updated_at = NOW()'
    );
  });
});