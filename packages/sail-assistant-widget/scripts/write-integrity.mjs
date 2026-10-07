// After `vite build`: write dist/<version>/SHA384SUMS + integrity.json (Subresource Integrity values for <script integrity>).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const dir = new URL(`../dist/${version}/`, import.meta.url);
const files = readdirSync(dir).filter((f) => /\.(m?js)$/.test(f)).sort();
const out = {};
const sums = [];
for (const f of files) {
  const buf = readFileSync(new URL(f, dir));
  out[f] = `sha384-${createHash('sha384').update(buf).digest('base64')}`;
  sums.push(`${createHash('sha384').update(buf).digest('hex')}  ${f}`);
}
writeFileSync(new URL('integrity.json', dir), JSON.stringify({ version, files: out }, null, 2) + '\n');
writeFileSync(new URL('SHA384SUMS', dir), sums.join('\n') + '\n');
console.log(`integrity written for ${files.length} files in ${join('dist', version)}`);
