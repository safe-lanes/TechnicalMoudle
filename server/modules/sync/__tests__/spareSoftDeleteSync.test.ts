import { describe, expect, it } from 'vitest';
import { getSoftDeleteSetClause } from '../oneWayApplier';

describe('Spare retained deletion sync', () => {
  it('marks the receiving Spare deleted and inactive together', () => {
    expect(getSoftDeleteSetClause('spares')).toBe(
      'is_deleted = true, is_active = false, updated_at = NOW()'
    );
  });
});