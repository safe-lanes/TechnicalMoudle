import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../db';
import { auditLog, defectClosureHistory, defects, vessels } from '@shared/schema';
import { reopenDefectAfterVerificationReturnTx } from '../../../postgresStorage';

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase('defect verification return transaction', () => {
  it('preserves two attempts, replays idempotently, rolls back failures, and enforces immutability', async () => {
    const db = await getDb();
    const rollback = new Error('ROLLBACK_TEST_DATA');

    await expect(db.transaction(async (tx) => {
      const suffix = randomUUID();
      const vesselUuid = `test-vessel-${suffix}`;
      const defectUuid = `test-defect-${suffix}`;
      await tx.insert(vessels).values({
        id: `TV-${suffix}`,
        vuuid: vesselUuid,
        name: 'Closure History Test Vessel',
        code: `TV-${suffix}`,
      });
      await tx.insert(defects).values({
        id: `TD-${suffix}`,
        duuid: defectUuid,
        vesselId: vesselUuid,
        vesselName: 'Closure History Test Vessel',
        issueDate: '2026-09-01',
        category: 'Defect',
        description: 'Transient closure history integration test',
        reportedBy: 'Test',
        status: 'Closed',
        confirmCompleted: true,
        dateCompleted: '2026-09-10',
        closedOutByName: 'Master One',
        closedOutByRank: 'Master',
        closedByName: 'Master One',
        closedByRank: 'Master',
        closureComment: 'First closeout',
        closedBy: 'master-1',
        closedOn: '2026-09-10T10:00:00Z',
        closureFiles: ['https://example.test/first.pdf'],
        verified: true,
        dateVerified: '2026-09-11',
        verifiedDate: '2026-09-11',
        verifiedByName: 'Verifier One',
        verifiedByOfficePosition: 'Technical Superintendent',
        isDeferred: true,
        targetCloseDate: '2026-10-31',
      });

      const firstInput = {
        defectDuuid: defectUuid,
        approvalRequestUuid: `request-1-${suffix}`,
        rejectedByUserUuid: 'manager-1',
        rejectedByName: 'Technical Manager',
        rejectedByPosition: 'Technical Manager',
        rejectionReason: 'First evidence set rejected',
      };
      const first = await reopenDefectAfterVerificationReturnTx(tx, firstInput);
      expect(first.alreadyApplied).toBe(false);
      expect(first.history).toMatchObject({
        attemptNumber: 1,
        vesselId: vesselUuid,
        closedByName: 'Master One',
        closureComment: 'First closeout',
        rejectionReason: 'First evidence set rejected',
      });
      expect(first.defect).toMatchObject({
        status: 'Open',
        confirmCompleted: false,
        verified: false,
        isDeferred: true,
        targetCloseDate: '2026-10-31',
      });
      expect(first.defect.dateCompleted).toBeNull();
      expect(first.defect.closedByName).toBeNull();
      expect(first.defect.closureComment).toBeNull();
      expect(first.defect.dateVerified).toBeNull();
      expect(first.defect.verifiedByName).toBeNull();

      const replay = await reopenDefectAfterVerificationReturnTx(tx, firstInput);
      expect(replay.alreadyApplied).toBe(true);
      expect(replay.history.dchuuid).toBe(first.history.dchuuid);

      await tx.update(defects).set({
        status: 'Closed',
        confirmCompleted: true,
        dateCompleted: '2026-09-14',
        closedOutByName: 'Master Two',
        closedOutByRank: 'Master',
        closedByName: 'Master Two',
        closedByRank: 'Master',
        closureComment: 'Second closeout',
        closedBy: 'master-2',
        closedOn: '2026-09-14T10:00:00Z',
        closureFiles: ['https://example.test/second.pdf'],
        verified: true,
        dateVerified: '2026-09-15',
        verifiedDate: '2026-09-15',
        verifiedByName: 'Verifier Two',
        verifiedByOfficePosition: 'Fleet Manager',
      }).where(eq(defects.duuid, defectUuid));

      const second = await reopenDefectAfterVerificationReturnTx(tx, {
        ...firstInput,
        approvalRequestUuid: `request-2-${suffix}`,
        rejectionReason: 'Second evidence set rejected',
      });
      expect(second.history).toMatchObject({
        attemptNumber: 2,
        closedByName: 'Master Two',
        closureComment: 'Second closeout',
      });
      const historyRows = await tx.select().from(defectClosureHistory)
        .where(eq(defectClosureHistory.defectDuuid, defectUuid))
        .orderBy(defectClosureHistory.attemptNumber);
      expect(historyRows.map((row) => row.attemptNumber)).toEqual([1, 2]);

      await tx.update(defects).set({
        status: 'Closed',
        confirmCompleted: true,
        dateCompleted: '2026-09-16',
        closedByName: 'Master Three',
        closureComment: 'Must survive failed snapshot',
        verified: true,
        dateVerified: '2026-09-16',
        verifiedDate: '2026-09-16',
        verifiedByName: 'Verifier Three',
      }).where(eq(defects.duuid, defectUuid));
      const beforeFailure = (await tx.select().from(defects)
        .where(eq(defects.duuid, defectUuid)).limit(1))[0];

      await expect(tx.transaction((savepoint) =>
        reopenDefectAfterVerificationReturnTx(savepoint, {
          ...firstInput,
          approvalRequestUuid: `request-fail-${suffix}`,
          rejectedByName: null as any,
        }),
      )).rejects.toThrow();
      const afterFailure = (await tx.select().from(defects)
        .where(eq(defects.duuid, defectUuid)).limit(1))[0];
      expect(afterFailure).toMatchObject({
        status: beforeFailure.status,
        confirmCompleted: beforeFailure.confirmCompleted,
        dateCompleted: beforeFailure.dateCompleted,
        closedByName: beforeFailure.closedByName,
        closureComment: beforeFailure.closureComment,
        verified: beforeFailure.verified,
        dateVerified: beforeFailure.dateVerified,
        verifiedByName: beforeFailure.verifiedByName,
      });
      expect(await tx.select().from(defectClosureHistory)
        .where(eq(defectClosureHistory.approvalRequestUuid, `request-fail-${suffix}`)))
        .toEqual([]);

      await expect(tx.transaction((savepoint) => savepoint.update(defectClosureHistory)
        .set({ rejectionReason: 'tampered' })
        .where(eq(defectClosureHistory.dchuuid, first.history.dchuuid))))
        .rejects.toThrow(/immutable/);
      await expect(tx.transaction((savepoint) => savepoint.delete(defectClosureHistory)
        .where(eq(defectClosureHistory.dchuuid, first.history.dchuuid))))
        .rejects.toThrow(/immutable/);

      const audits = await tx.select().from(auditLog).where(eq(auditLog.entityId, defectUuid));
      expect(audits.filter((row) => row.entityType === 'defect_closure_history')).toHaveLength(2);

      throw rollback;
    })).rejects.toBe(rollback);
  }, 30_000);
});