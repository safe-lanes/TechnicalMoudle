/**
 * Task #399 — dual-completion collision: pure-rule tests.
 *
 * Field scenario under test (user-reported): baseline RH 1,000 @ 01-Jan-2022;
 * vessel completes WO with reading 1,200 @ 21-Jan-2022; office completes the
 * SAME WO with 1,150 @ 22-Jan-2022. Interim rule: later completion DAY wins
 * (office, 22-Jan), exact-date tie → ship (same tie rule as running hours).
 * Both instances must reach the same interim in EITHER sync order.
 */
import { describe, it, expect } from 'vitest';
import {
  chooseInterimSide,
  collectIncomingWoCompletionDates,
  isWoCompletionField,
  WO_COMPLETION_FIELDS_SNAKE,
  RESOLUTION_ACTOR,
  DUAL_COMPLETION_KIND,
  findWouuidsWithOpenDualConflicts,
} from '../dualCompletionResolver';

describe('chooseInterimSide — deterministic interim winner', () => {
  const ship = (d: string | null) => ({ completionDate: d, isShip: true });
  const shore = (d: string | null) => ({ completionDate: d, isShip: false });

  it('later completion day wins (reported scenario: office 22-Jan beats ship 21-Jan)', () => {
    // Ship receiver, shore incoming (pull direction)
    expect(chooseInterimSide(ship('2022-01-21'), shore('2022-01-22'))).toBe('incoming');
    // Shore receiver, ship incoming (push direction) — SAME final side (shore's completion)
    expect(chooseInterimSide(shore('2022-01-22'), ship('2022-01-21'))).toBe('local');
  });

  it('later day wins regardless of side', () => {
    expect(chooseInterimSide(ship('2022-01-25'), shore('2022-01-22'))).toBe('local');
    expect(chooseInterimSide(shore('2022-01-22'), ship('2022-01-25'))).toBe('incoming');
  });

  it('exact-date tie → ship wins (business-confirmed, same rule as running hours)', () => {
    expect(chooseInterimSide(ship('2022-01-22'), shore('2022-01-22'))).toBe('local');
    expect(chooseInterimSide(shore('2022-01-22'), ship('2022-01-22'))).toBe('incoming');
  });

  it('a present date beats a missing date', () => {
    expect(chooseInterimSide(ship(null), shore('2022-01-22'))).toBe('incoming');
    expect(chooseInterimSide(ship('2022-01-22'), shore(null))).toBe('local');
  });

  it('both dates missing → ship wins', () => {
    expect(chooseInterimSide(ship(null), shore(null))).toBe('local');
    expect(chooseInterimSide(shore(null), ship(null))).toBe('incoming');
  });

  it('handles datetime-prefixed and unparseable values', () => {
    expect(chooseInterimSide(ship('2022-01-21 10:00:00'), shore('2022-01-22T08:30:00Z'))).toBe('incoming');
    // unparseable local counts as missing → present incoming date wins
    expect(chooseInterimSide(ship('garbage'), shore('2022-01-22'))).toBe('incoming');
  });

  it('is symmetric: swapping receiver/incoming never changes the WINNING SIDE', () => {
    const cases: Array<[string | null, string | null]> = [
      ['2022-01-21', '2022-01-22'],
      ['2022-01-22', '2022-01-22'],
      [null, '2022-01-22'],
      [null, null],
    ];
    for (const [shipDate, shoreDate] of cases) {
      const shipReceives = chooseInterimSide(ship(shipDate), shore(shoreDate));
      const shoreReceives = chooseInterimSide(shore(shoreDate), ship(shipDate));
      // winner side must be identical: if ship wins on one node it must win on the other
      const shipWinsA = shipReceives === 'local';
      const shipWinsB = shoreReceives === 'incoming';
      expect(shipWinsA).toBe(shipWinsB);
    }
  });
});

describe('collectIncomingWoCompletionDates', () => {
  it('collects date_completed per WO (camel and snake forms)', () => {
    const map = collectIncomingWoCompletionDates([
      { tableName: 'work_orders', rowUuid: 'wo-1', fieldName: 'dateCompleted', newValue: '2022-01-21' },
      { tableName: 'work_orders', rowUuid: 'wo-2', fieldName: 'date_completed', newValue: '2022-01-22' },
      { tableName: 'components', rowUuid: 'c-1', fieldName: 'date_completed', newValue: '2099-01-01' },
    ]);
    expect(map.get('wo-1')).toBe('2022-01-21');
    expect(map.get('wo-2')).toBe('2022-01-22');
    expect(map.has('c-1')).toBe(false);
  });

  it('prefers date_completed over completion_date_time', () => {
    const map = collectIncomingWoCompletionDates([
      { tableName: 'work_orders', rowUuid: 'wo-1', fieldName: 'completionDateTime', newValue: '2022-01-20 08:00' },
      { tableName: 'work_orders', rowUuid: 'wo-1', fieldName: 'dateCompleted', newValue: '2022-01-21' },
    ]);
    expect(map.get('wo-1')).toBe('2022-01-21');
  });

  it('falls back to completion_date_time when date_completed absent', () => {
    const map = collectIncomingWoCompletionDates([
      { tableName: 'work_orders', rowUuid: 'wo-1', fieldName: 'completionDateTime', newValue: '2022-01-20 08:00' },
    ]);
    expect(map.get('wo-1')).toBe('2022-01-20 08:00');
  });
});

describe('completion-field membership', () => {
  it('covers the completion payload fields', () => {
    for (const f of ['status', 'date_completed', 'completion_date_time', 'performed_by',
      'completion_remarks', 'completion_rh', 'wo_completion_rh', 'current_reading',
      'current_reading_date', 'completion_rh_validated', 'completion_rh_validation_details',
      'rh_justification', 'rh_justification_provided_by', 'rh_justification_date',
      'rh_backdated_entry', 'previous_reading']) {
      expect(isWoCompletionField(f)).toBe(true);
    }
  });
  it('excludes non-completion fields (no false conflicts on ordinary edits)', () => {
    for (const f of ['remarks', 'approval_tier', 'days_late', 'next_due_date', 'rh_synced_at', 'is_deleted']) {
      expect(isWoCompletionField(f)).toBe(false);
    }
  });
  it('constants are stable (protocol values — the other side depends on them)', () => {
    expect(RESOLUTION_ACTOR).toBe('sync-conflict-resolution');
    expect(DUAL_COMPLETION_KIND).toBe('dual_completion');
    expect(WO_COMPLETION_FIELDS_SNAKE.has('status')).toBe(true);
  });
});

describe('completion-learning conflict hold', () => {
  it('returns every Work Order that still has an open dual-completion conflict', async () => {
    const queries: Array<{ sql: string; params?: any[] }> = [];
    const client = {
      async query(sql: string, params?: any[]) {
        queries.push({ sql, params });
        return { rows: [{ row_uuid: 'wo-open-1' }, { row_uuid: 'wo-open-2' }] };
      },
    };

    const open = await findWouuidsWithOpenDualConflicts(
      client,
      ['wo-open-1', 'wo-resolved', 'wo-open-2'],
    );

    expect(Array.from(open).sort()).toEqual(['wo-open-1', 'wo-open-2']);
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain(`conflict_kind = $1`);
    expect(queries[0].sql).toContain(`is_resolved = false`);
    expect(queries[0].params).toEqual([
      DUAL_COMPLETION_KIND,
      ['wo-open-1', 'wo-resolved', 'wo-open-2'],
    ]);
  });
});
