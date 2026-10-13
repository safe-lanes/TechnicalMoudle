// Compare fresh tsc logs, normalizing moved lines through the current Git diff.
// Usage: node scripts/compare-typescript-diagnostics.cjs before.txt after.txt
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');

function parse(text) {
  const diagnostics = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(.+)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
    if (match) {
      diagnostics.push({
        file: match[1], line: Number(match[2]), column: Number(match[3]),
        code: match[4], message: match[5],
      });
    } else if (line.trim() && diagnostics.length) {
      diagnostics[diagnostics.length - 1].message += `\n${line}`;
    }
  }
  return diagnostics;
}

function movedLine(file, originalLine) {
  const diff = execFileSync('git', ['diff', '--no-ext-diff', '--unified=0', '--', file], { encoding: 'utf8' });
  let offset = 0;
  for (const match of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(match[1]);
    const oldCount = match[2] === undefined ? 1 : Number(match[2]);
    const newStart = Number(match[3]);
    const newCount = match[4] === undefined ? 1 : Number(match[4]);
    if (oldCount === 0) {
      if (originalLine > start) offset += newCount;
    } else if (originalLine >= start + oldCount) {
      offset += newCount - oldCount;
    } else if (originalLine >= start) {
      // Same relative position for replaced lines. Deleted lines cannot match.
      const relative = originalLine - start;
      return relative < newCount ? newStart + relative : null;
    }
  }
  return originalLine + offset;
}

function compare(before, after, mapLine = movedLine) {
  const key = d => JSON.stringify([d.file, d.line, d.column, d.code]);
  const available = new Map();
  for (const diagnostic of after) {
    const k = key(diagnostic);
    available.set(k, [...(available.get(k) || []), diagnostic]);
  }
  const removed = [];
  const changed = [];
  const unchanged = [];
  for (const diagnostic of before) {
    const line = mapLine(diagnostic.file, diagnostic.line);
    const candidates = available.get(key({ ...diagnostic, line })) || [];
    if (!candidates.length) {
      removed.push(diagnostic);
      continue;
    }
    const sameMessage = candidates.findIndex(d => d.message === diagnostic.message);
    const candidate = candidates.splice(sameMessage < 0 ? 0 : sameMessage, 1)[0];
    if (candidate.message === diagnostic.message) unchanged.push(candidate);
    else changed.push({ before: diagnostic, after: candidate });
  }
  return { removed, added: [...available.values()].flat(), changed, unchanged };
}

function selfTest() {
  const d = { file: 'example.ts', line: 10, column: 1, code: 'TS2322', message: 'first\n  detail' };
  const other = { ...d, column: 2, message: 'second' };
  const result = compare([d, other], [
    { ...d, line: 9 }, { ...other, line: 9, message: 'changed' },
  ], (_file, line) => line - 1);
  assert.equal(result.unchanged.length, 1);
  assert.equal(result.changed.length, 1);
  assert.equal(result.added.length, 0);
  assert.equal(result.removed.length, 0);
  assert.deepEqual(parse('example.ts(10,1): error TS2322: first\n  detail\n'), [d]);
}

if (require.main === module) {
  selfTest();
  const [beforePath, afterPath] = process.argv.slice(2);
  if (!beforePath || !afterPath) throw new Error('Supply before.txt and after.txt compiler logs');
  const before = parse(fs.readFileSync(beforePath, 'utf8'));
  const after = parse(fs.readFileSync(afterPath, 'utf8'));
  const result = compare(before, after);
  const counts = {};
  for (const d of after) counts[d.file] = (counts[d.file] || 0) + 1;
  console.log(JSON.stringify({
    totals: { before: before.length, after: after.length, removed: result.removed.length,
      added: result.added.length, changed: result.changed.length, unchanged: result.unchanged.length },
    remainingByFile: counts,
    ...result,
  }, null, 2));
  if (result.added.length || result.changed.length) process.exitCode = 1;
}
module.exports = { parse, compare, movedLine };
