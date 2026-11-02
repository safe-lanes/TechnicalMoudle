import { describe, expect, it } from 'vitest';
import { filterDefectLogs, filterDefectRows, protectDefectPushAcknowledgement } from '../defectMetadataCompatibility';

describe('mixed-version defect delivery', () => {
  const logs = [
    { logUuid: 'base', tableName: 'defects', rowUuid: 'd', fieldName: 'description', newValue: 'repair' },
    { logUuid: 'empty-c1', tableName: 'defects', rowUuid: 'd', fieldName: 'part_c_attachments', newValue: '[]' },
    { logUuid: 'external-a', tableName: 'defects', rowUuid: 'd', fieldName: 'partAAttachments', newValue: '[{"storageVersion":1}]' },
    { logUuid: 'legacy-b', tableName: 'defects', rowUuid: 'd', fieldName: 'closureFiles', newValue: '["old-b"]' },
    { logUuid: 'other', tableName: 'jobs', rowUuid: 'j', fieldName: 'description', newValue: 'normal' },
  ];
  it('holds C1 including explicit empty defaults and external metadata, but preserves legacy evidence and unrelated tables', () => {
    expect(filterDefectLogs(logs, false).map(l => l.logUuid)).toEqual(['base', 'legacy-b', 'other']);
    expect(filterDefectLogs(logs, true)).toEqual(logs);
    expect(logs).toHaveLength(5);
  });
  it('does not acknowledge held fields when the base row is acknowledged', () => {
    const deliveredIds = new Set(filterDefectLogs(logs, false).map(l => l.logUuid));
    expect(logs.filter(l => deliveredIds.has(l.logUuid)).map(l => l.logUuid)).not.toContain('empty-c1');
  });
  it('strips C1 from full-row insertion/recovery without clearing source data, and holds rows containing external files', () => {
    const batches = [{ tableName: 'defects', rows: [
      { duuid: 'inline', part_c_attachments: [], attachments: [{ id: 'legacy', data: 'data:' }] },
      { duuid: 'external', part_c_attachments: [], attachments: [{ storageVersion: 1 }] },
    ] }];
    const safe = filterDefectRows(batches, false);
    expect(safe[0].rows).toEqual([{ duuid: 'inline', attachments: [{ id: 'legacy', data: 'data:' }] }]);
    expect(batches[0].rows[0]).toHaveProperty('part_c_attachments');
    expect(filterDefectRows(batches, true)).toEqual(batches);
  });
  it('holds full-row encoded C1 and external removals for peers unable to understand them', () => {
    expect(filterDefectLogs([
      { tableName: 'defects', fieldName: '__fullRow', newValue: '{"partCAttachments":[]}' },
      { tableName: 'defects', fieldName: 'attachments', oldValue: '[{"storageVersion":1}]', newValue: '[]' },
    ], false)).toEqual([]);
  });
  it('vetoes positive full-row acknowledgements for a row with held C1 fields, not just negative acknowledgements', () => {
    expect(protectDefectPushAcknowledgement({ appliedRowUuids: ['held', 'other'], droppedRowUuids: [] }, new Set(['held'])))
      .toMatchObject({ appliedRowUuids: ['other'], droppedRowUuids: ['held'] });
  });
  it('does not invent the positive-confirmation capability for an older metadata response', () => {
    expect(protectDefectPushAcknowledgement({ received: 1 }, new Set(['held']))).not.toHaveProperty('appliedRowUuids');
  });
});
