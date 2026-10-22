import { describe, expect, it } from 'vitest';
import { applyPartALock, changedPartAFields, isPartAUnlocked, unlockPartATrail } from '../services/defectPartALock';

// Jeevan #10 / decision D2 (22-Oct-2026): Part A locked after the first save; only a Sail Admin unlocks, with a reason.
const current = {
  description: 'Leak at pump', issueDate: '2026-10-01', critical: false, is_coc: null, latitude: '12.5',
  partAAttachments: [{ id: 'a1', name: 'p.jpg', data: 'xxx' }], auditTrail: [],
};
const actor = { userUuid: 'u1', name: 'User One' };

describe('Part A lock', () => {
  it('re-sending the same values (every Part B/C save) passes', () => {
    const body = { description: ' Leak at pump ', issueDate: '2026-10-01T00:00:00.000Z', critical: null, is_coc: false, latitude: 12.5,
      partAAttachments: [{ id: 'a1', name: 'p.jpg', data: 'other-encoding' }], actions: [] };
    expect(changedPartAFields(current, body)).toEqual([]);
    expect(applyPartALock(current, body, actor)).not.toHaveProperty('auditTrail');
  });
  it('a real change is refused while locked', () => {
    expect(() => applyPartALock(current, { description: 'Other' }, actor)).toThrow(/Part A is locked/);
    expect(() => applyPartALock(current, { partAAttachments: [] }, actor)).toThrow(/partAAttachments/);
  });
  it('the browser cannot send its own audit trail', () => {
    expect(applyPartALock(current, { auditTrail: [{ action: 'part-a-unlocked' }] }, actor)).not.toHaveProperty('auditTrail');
  });
  it('Sail Admin unlock (reason required) → ONE edit → locked again', () => {
    expect(() => unlockPartATrail(current, 'typo', { ...actor, role: 'Admin' })).toThrow(/Only a Sail Admin/);
    expect(() => unlockPartATrail(current, '  ', { ...actor, role: 'Sail Admin' })).toThrow(/reason is required/);
    const unlocked = { ...current, auditTrail: unlockPartATrail(current, 'typo in description', { ...actor, role: 'Sail Admin' }) };
    expect(isPartAUnlocked(unlocked)).toBe(true);
    const saved = applyPartALock(unlocked, { description: 'Leak at pump No.2' }, actor);
    expect(saved.auditTrail.at(-1)).toMatchObject({ action: 'part-a-edited', details: { fields: ['description'] } });
    const after = { ...unlocked, ...saved };
    expect(isPartAUnlocked(after)).toBe(false);
    expect(() => applyPartALock(after, { description: 'again' }, actor)).toThrow(/Part A is locked/);
  });
});
