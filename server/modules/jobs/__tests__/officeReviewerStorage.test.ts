import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as contract from '../../../../shared/officeReviewer';
import { ValidationError } from '../../shared/errors';

// Execute the real storage methods, not a reimplementation; no live DB/import side effects.
const sourcePath = path.resolve(process.cwd(), 'server/postgresStorage.ts');
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const ast = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true);
const names = new Set([
  'createJob', 'updateJob', 'validateJobReviewerSelection', 'validateReviewerChangeRequest',
  'applyJobChangesInTx', 'applyApprovedChangesInTx', 'finaliseApprovedCRWithStep',
]);
const storageClass = ast.statements.find(node =>
  ts.isClassDeclaration(node) && node.members.some(member =>
    ts.isMethodDeclaration(member) && member.name.getText(ast) === 'updateJob',
  ),
) as ts.ClassDeclaration;
const methods = storageClass.members.filter(member =>
  ts.isMethodDeclaration(member) && names.has(member.name.getText(ast)),
).map(member => member.getText(ast));
if (methods.length !== names.size) throw new Error('Incomplete real storage-method fixture');
const emitted = ts.transpileModule(`class StorageFixture { ${methods.join('\n')} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function fixture() {
  const jobs = { id: 'id', juuid: 'juuid', isDeleted: 'isDeleted' };
  const roles = { ruid: 'ruid', isActive: 'isActive', isDeleted: 'isDeleted' };
  const cr = { id: 'id' };
  const steps = { id: 'id' };
  const records = new Map<any, any[]>([
    [jobs, [{ id: 'local-job', juuid: 'uuid-job', vesselId: 'vessel', officeReviewerRoleRuids: ['A', 'B'],
      level2ReviewerRankId: 'Office', lastDoneRH: '1000', nextDueRH: '1100', jobNo: 'J1' }]],
    [roles, [{ ruid: 'C' }, { ruid: 'D' }]],
    [cr, [{ id: 1, status: 'submitted' }]],
    [steps, [{ id: 2, status: 'Pending' }]],
  ]);
  const writes: any[] = [];
  const db: any = {
    select: () => ({
      from: (table: any) => ({
        where: () => {
          const rows = records.get(table) || [];
          const promise: any = Promise.resolve(structuredClone(rows));
          promise.limit = () => Promise.resolve(structuredClone(rows.slice(0, 1)));
          return promise;
        },
      }),
    }),
    update: (table: any) => ({
      set: (value: any) => ({
        where: (predicate: any) => ({
          returning: async () => {
            writes.push({ table, value: structuredClone(value), predicate });
            const row = { ...records.get(table)![0], ...value };
            records.set(table, [row]);
            return [row];
          },
        }),
      }),
    }),
    insert: (table: any) => ({
      values: (value: any) => ({
        returning: async () => {
          writes.push({ table, value: structuredClone(value) });
          records.set(table, [value]);
          return [value];
        },
      }),
    }),
    transaction: async (fn: any) => {
      const snapshot = structuredClone([...records.values()]);
      const keys = [...records.keys()];
      const writeCount = writes.length;
      try { return await fn(db); } catch (error) {
        keys.forEach((key, index) => records.set(key, snapshot[index]));
        writes.splice(writeCount);
        throw error;
      }
    },
  };
  const dependencies: Record<string, any> = {
    ...contract, ValidationError, jobs, admnRoleMaster: roles,
    changeRequest: cr, changeRequestApproval: steps,
    getDb: async () => db, randomUUID: () => 'new-uuid',
    eq: (column: any, value: any) => ({ column, value }),
    and: (...conditions: any[]) => conditions, or: (...conditions: any[]) => conditions,
    isNull: (column: any) => ({ column, null: true }),
    logFieldChanges: vi.fn().mockResolvedValue(undefined),
  };
  const Constructor = new Function(...Object.keys(dependencies), `${emitted}; return StorageFixture;`)(
    ...Object.values(dependencies),
  );
  return { storage: new Constructor(), db, writes, records, jobs, roles, cr, steps };
}

function request(overrides: any = {}) {
  return { id: 1, targetType: 'job', targetId: 'uuid-job', revisionNumber: 0, revisionHistory: [],
    proposedChangesJson: [{ field: 'officeReviewerRoleRuids', oldValue: ['A', 'B'], newValue: ['A', 'C'] }],
    ...overrides };
}

describe('Actual Office Reviewer storage write paths (isolated fixtures)', () => {
  it('replaces roles, clears, preserves omitted properties and does not touch tracking/legacy values', async () => {
    const f = fixture();
    await f.storage.updateJob('local-job', { officeReviewerRoleRuids: ['C', 'A'] });
    expect(f.records.get(f.jobs)![0].officeReviewerRoleRuids).toEqual(['A', 'C']);
    await f.storage.updateJob('uuid-job', { jobPriority: 'High' });
    expect(f.records.get(f.jobs)![0].officeReviewerRoleRuids).toEqual(['A', 'C']);
    await f.storage.updateJob('uuid-job', { officeReviewerRoleRuids: [] });
    expect(f.records.get(f.jobs)![0]).toMatchObject({
      officeReviewerRoleRuids: [], level2ReviewerRankId: 'Office', lastDoneRH: '1000', nextDueRH: '1100',
    });
    expect(f.writes[0].value.updatedAt).toBeInstanceOf(Date);
  });

  it('retains historical role IDs even when missing from the active catalog', async () => {
    const f = fixture();
    f.records.set(f.roles, []);
    await f.storage.updateJob('uuid-job', { officeReviewerRoleRuids: ['A'] });
    expect(f.records.get(f.jobs)![0].officeReviewerRoleRuids).toEqual(['A']);
  });

  it.each(['A,C', ['unknown'], ['A', 'A'], null])('rejects invalid ordinary writes %j', async value => {
    const f = fixture();
    await expect(f.storage.updateJob('uuid-job', { officeReviewerRoleRuids: value })).rejects.toThrow();
    expect(f.writes).toHaveLength(0);
  });

  it('defaults new Jobs to [] and strips legacy configuration on create', async () => {
    const f = fixture();
    const result = await f.storage.createJob({ vesselId: 'vessel', level2ReviewerRankId: 'Office' });
    expect(result.officeReviewerRoleRuids).toEqual([]);
    expect(result).not.toHaveProperty('level2ReviewerRankId');
  });

  it('validates proposed changes without prematurely writing the Job', async () => {
    const f = fixture();
    await f.storage.validateReviewerChangeRequest(f.db, request());
    expect(f.writes).toHaveLength(0);
    await expect(f.storage.validateReviewerChangeRequest(f.db, request({
      proposedChangesJson: [{ field: 'officeReviewerRoleRuids', newValue: 'A,C' }],
    }))).rejects.toThrow();
    expect(f.records.get(f.jobs)![0].officeReviewerRoleRuids).toEqual(['A', 'B']);
  });

  it('applies proposed arrays and preserves the original proposal in final approval', async () => {
    const f = fixture();
    const original = request();
    const result = await f.storage.finaliseApprovedCRWithStep(1, original, null, 'reviewer', 'ok', new Date());
    expect(f.records.get(f.jobs)![0].officeReviewerRoleRuids).toEqual(['A', 'C']);
    expect(result.status).toBe('approved');
    expect(original.proposedChangesJson[0].newValue).toEqual(['A', 'C']);
    expect(result.revisionHistory[0].appliedChanges[0].newValue).toEqual(['A', 'C']);
    expect(f.writes.find(w => w.table === f.jobs).predicate).toEqual({ column: 'juuid', value: 'uuid-job' });
  });

  it('retains partial overrides as arrays and lets a final [] override win with typed audit values', async () => {
    const f = fixture();
    const original = request({ revisionHistory: [{
      type: 'partial_approval', approvedBy: 'earlier', approvedAt: new Date().toISOString(),
      overriddenFields: [{ field: 'officeReviewerRoleRuids', approverNewValue: ['D'] }],
    }] });
    const result = await f.storage.finaliseApprovedCRWithStep(1, original, null, 'final', 'clear', new Date(), [
      { field: 'officeReviewerRoleRuids', approverNewValue: [] },
    ]);
    expect(f.records.get(f.jobs)![0].officeReviewerRoleRuids).toEqual([]);
    expect(result.revisionHistory.at(-1).overriddenFields[0]).toMatchObject({
      originalNewValue: ['A', 'C'], approverNewValue: [], modifiedBy: 'final',
    });
    expect(original.proposedChangesJson[0].newValue).toEqual(['A', 'C']);
  });

  it('uses an earlier partial override when there is no final override', async () => {
    const f = fixture();
    await f.storage.finaliseApprovedCRWithStep(1, request({ revisionHistory: [{
      type: 'partial_approval',
      overriddenFields: [{ field: 'officeReviewerRoleRuids', approverNewValue: ['D'] }],
    }] }), null, 'final', 'ok', new Date());
    expect(f.records.get(f.jobs)![0].officeReviewerRoleRuids).toEqual(['D']);
  });

  it('rolls back final step and Job/CR writes if an effective selection is invalid', async () => {
    const f = fixture();
    await expect(f.storage.finaliseApprovedCRWithStep(1, request(), 2, 'final', 'bad', new Date(), [
      { field: 'officeReviewerRoleRuids', approverNewValue: ['unknown'] },
    ])).rejects.toThrow(/not active/);
    expect(f.records.get(f.jobs)![0].officeReviewerRoleRuids).toEqual(['A', 'B']);
    expect(f.records.get(f.steps)![0].status).toBe('Pending');
    expect(f.records.get(f.cr)![0].status).toBe('submitted');
    expect(f.writes).toHaveLength(0);
  });
});
