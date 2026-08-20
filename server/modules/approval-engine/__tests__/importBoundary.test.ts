/**
 * §A10 — import boundary: server/modules/approval-engine/** imports NOTHING outside itself
 * except node_modules and node builtins. The repo has no ESLint infrastructure, so the
 * mechanical enforcement lives here (vitest fails the suite on any violation) — documented
 * as the accepted §A10 variant in PHASE1-REPORT.md.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ENGINE_ROOT = path.resolve(__dirname, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import\s[^'"]*?from\s*|import\s*\(\s*|export\s[^'"]*?from\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

function specifiers(file: string): string[] {
  const src = fs.readFileSync(file, 'utf8');
  const specs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = IMPORT_RE.exec(src))) specs.push(m[1]);
  return specs;
}

describe('approval-engine import boundary (§A10)', () => {
  const files = walk(ENGINE_ROOT);
  it('finds engine source files', () => { expect(files.length).toBeGreaterThan(5); });

  it('no file imports anything outside the engine folder (+ node_modules / node builtins)', () => {
    const violations: string[] = [];
    for (const file of files) {
      for (const spec of specifiers(file)) {
        if (spec.startsWith('node:')) continue;                        // node builtin
        if (!spec.startsWith('.') && !spec.startsWith('@shared') && !spec.startsWith('@/')) continue; // bare = node_modules
        if (spec.startsWith('@shared') || spec.startsWith('@/')) {
          violations.push(`${path.relative(ENGINE_ROOT, file)} → ${spec} (app alias)`);
          continue;
        }
        const resolved = path.resolve(path.dirname(file), spec);
        if (!resolved.startsWith(ENGINE_ROOT)) {
          violations.push(`${path.relative(ENGINE_ROOT, file)} → ${spec} (escapes the engine folder)`);
        }
      }
    }
    expect(violations, `boundary violations:\n${violations.join('\n')}`).toEqual([]);
  });

  it('the engine never imports Technical modules or the shared schema by any spelling', () => {
    const banned = [/server\/(storage|postgresStorage|routes)/, /shared\/(schema|syncConfig)/, /middleware\/(auth|permissions)/];
    for (const file of files) {
      for (const spec of specifiers(file)) {
        for (const re of banned) {
          expect(re.test(spec), `${path.relative(ENGINE_ROOT, file)} imports ${spec}`).toBe(false);
        }
      }
    }
  });
});
