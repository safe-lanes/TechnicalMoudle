/**
 * Stage 5 masking proof — unit + captured-payload leak scan.
 * Unit part runs anywhere (no service). The leak scan runs when a capture file
 * from a real run is provided (see the Stage 5 report / parity harness usage).
 *
 *   node masking-suite.mjs                       # unit tests only
 *   node masking-suite.mjs <captured.jsonl>      # + leak scan of real payloads
 */
import { createMasker } from './masking.mjs';
import { readFileSync } from 'node:fs';

let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };

console.log('── Masker unit behaviour ──');
{
  const m = createMasker();
  m.register('Gas Mia', 'VESSEL');
  m.register('Rahul Singh', 'PERSON');
  const out = m.maskText('The gas valve on Gas Mia was checked by Rahul Singh; IMO 9290294, id 743feb08-841a-11ed-aa7c-7003bca91a86.');
  check('vessel + person + IMO + uuid all masked', !/Gas Mia|Rahul Singh|9290294|743feb08/.test(out), out);
  check('common word "gas" (lowercase, standalone) preserved', /gas valve/.test(out));
  check('round-trip restores every value', m.unmaskText(out).includes('Gas Mia') && m.unmaskText(out).includes('Rahul Singh') && m.unmaskText(out).includes('9290294'));
  const repeated = m.maskText('Gas Mia again, and Gas Mia once more');
  check('repeated name → same stable token, restores correctly', (repeated.match(/\[VESSEL_1\]/g) || []).length === 2 && m.unmaskText(repeated) === 'Gas Mia again, and Gas Mia once more');
  check('name mid-sentence restores naturally', m.unmaskText(m.maskText('Before Gas Mia after')) === 'Before Gas Mia after');
  check('unknown token stays VISIBLE (never a guess/leak)', m.unmaskText('see [VESSEL_9]') === 'see [VESSEL_9]' && m.warnings.length > 0);
}
{
  // fleet-overview shape: bare `name` with vessel signals → masked; manual excerpt title → NOT masked
  const m = createMasker();
  m.learnFromJson({ vessels: [{ id: 'v1', name: 'Gas Mia', code: 'GM', imoNumber: '9290294' }, { id: 'v2', name: 'ATLANTIC PRIDE', imoNumber: null }] });
  m.learnFromJson({ excerpts: [{ manual: 'X', section: 'Save as Draft', title: 'Save as Draft on Work-Order Completion' }] });
  const masked = m.maskText(JSON.stringify({ vessels: ['Gas Mia', 'ATLANTIC PRIDE'], note: 'Save as Draft is a feature, not a vessel' }));
  check('bare `name` w/ vessel siblings → masked', !/Gas Mia|ATLANTIC PRIDE/.test(masked), masked);
  check('lookalike title w/o vessel signal → NOT masked', /Save as Draft is a feature/.test(masked));
}
{
  const m = createMasker();
  check('masking self-test seam throws (fail-closed proof)', (() => { try { m.maskText('__MASK_FAIL_TEST__ x'); return false; } catch { return true; } })());
}

// ── Optional: leak scan of a real captured-outbound file ──
const capFile = process.argv[2];
if (capFile) {
  console.log(`\n── Captured-payload leak scan (${capFile}) ──`);
  const raw = readFileSync(capFile, 'utf8');
  const secrets = process.env.LEAK_TERMS
    ? process.env.LEAK_TERMS.split(',')
    : ['Gas Mia', 'ATLANTIC PRIDE', 'XT FORTUNE', 'WATER TIGER', 'Rahul Singh'];
  let leaks = 0;
  for (const t of secrets) {
    const n = raw.split(t).length - 1;
    if (n > 0) leaks += n;
    console.log(`  ${t.padEnd(16)} ${n === 0 ? 'clean' : `LEAK x${n}`}`);
  }
  check('NO real identifier in any outbound payload', leaks === 0, `total leaks=${leaks}`);
  const tokens = (raw.match(/\[(VESSEL|PERSON|IMO|ID)_\d+\]/g) || []).length;
  check('masked tokens ARE present in outbound (masking active)', tokens > 0, `${tokens} tokens`);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
