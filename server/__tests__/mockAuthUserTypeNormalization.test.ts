/**
 * Execute the real middleware source in an import-denying VM, not the server.
 * The baseline reverses only the approved userType assignment.
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAuditActor } from '../middleware/auditActor';

const current = readFileSync('server/middleware/auth.ts', 'utf8');
const assignment = 'userType: fwdType === "Office" || fwdType === "Ship" ? fwdType : "Office",';
const baseline = current.replace(assignment, 'userType: fwdType || "Office",');
const fixedTime = '2026-11-03T09:00:00.000Z';
class FixedDate extends Date {
  constructor() { super(fixedTime); }
  static now() { return Date.parse(fixedTime); }
}
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

function load(text: string) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true,
  });
  expect(compiled.diagnostics).toEqual([]);
  runInNewContext(compiled.outputText, {
    module, exports: module.exports, Date: FixedDate,
    // Only this non-secret test-process flag is exposed to the VM.
    process: { env: { PMS_AUTH_MOCK_RBAC: process.env.PMS_AUTH_MOCK_RBAC } },
    require(id: string) { throw new Error(`Blocked middleware import: ${id}`); },
  }, { timeout: 5000 });
  return module.exports;
}

function call(text: string, header: string | undefined, forwarded: boolean) {
  const headers: Record<string, string> = {};
  if (header !== undefined) headers['x-user-type'] = header;
  if (forwarded) {
    Object.assign(headers, {
      'x-user-id': 'test-person', 'x-user-name': 'Test%20Person',
      'x-user-email': 'test%40example.invalid', 'x-user-role': 'Vessel%20User',
      'x-rank': 'Second Engineer',
    });
  }
  const req: {
    headers: Record<string, string>;
    body: Record<string, unknown>;
    user?: Record<string, unknown>;
    rbac?: unknown;
  } = { headers, body: {} };
  const next = vi.fn();
  const subject = load(`${text}\nmodule.exports = mockAuthMiddleware;`);
  subject(req, {}, next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(req.user).toBeDefined();
  return req;
}

// Vitest restores the original value, including absence, even when assertions fail.
afterEach(() => vi.unstubAllEnvs());

describe('forwarded userType normalisation without identity/RBAC changes', () => {
  it('reverses exactly one approved assignment to obtain the real baseline', () => {
    expect(current.split(assignment)).toHaveLength(2);
    expect(baseline).not.toBe(current);
    expect(baseline.replace('userType: fwdType || "Office",', assignment)).toBe(current);
  });

  for (const mockEnabled of [false, true]) {
    for (const forwarded of [false, true]) {
      it.each([
        ['Ship', 'Ship'], ['Office', 'Office'], [undefined, 'Office'],
        ['   ', 'Office'], ['Unexpected', 'Office'],
      ])('header %s, mock=' + mockEnabled + ', forwarded=' + forwarded, (header, expected) => {
        vi.stubEnv('PMS_AUTH_MOCK_RBAC', mockEnabled ? '1' : '0');
        const before = call(baseline, header, forwarded);
        const after = call(current, header, forwarded);
        const { userType: oldType, ...oldFields } = before.user ?? {};
        const { userType: newType, ...newFields } = after.user ?? {};
        expect(newType).toBe(expected);
        expect(plain(newFields)).toEqual(plain(oldFields));
        expect(after.user?.role).toBe('Sail Admin');
        expect(after.user?.forwardedRole).toBe(forwarded ? 'Vessel User' : undefined);
        expect(after.rbac).toEqual(before.rbac);
        if (mockEnabled) {
          expect(after.rbac).toEqual({ role: 'Sail Admin', userType: 'Office', source: 'mock' });
        } else {
          const supported = header === 'Office' || header === 'Ship';
          expect(after.rbac).toEqual({
            role: forwarded ? 'Vessel User' : null,
            userType: supported ? header : null,
            source: forwarded || (header !== undefined && header.trim()) ? 'forwarded' : 'none',
          });
        }
        if (header !== 'Unexpected') {
          expect(newType).toBe(oldType);
          const actor = resolveAuditActor(after.user);
          expect(actor).toEqual(resolveAuditActor(before.user));
          expect(actor.actorType).toBe(expected);
          expect(actor.actorRole).toBe(forwarded ? 'Vessel User' : 'Sail Admin');
          if (forwarded) {
            expect(actor.actorId).toBe('test-person');
            expect(actor.actorLabel).toBe(expected === 'Ship' ? 'Second Engineer' : 'Test Person');
          }
        }
      });
    }
  }
});
