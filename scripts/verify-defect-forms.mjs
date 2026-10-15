/**
 * Isolated mounted regression/parity checks. No application server or DB is loaded.
 * Run: node scripts/verify-defect-forms.mjs [--baseline-ref=HEAD]
 * With no ref, reconstruct just the two removed defaults for repeatable parity.
 * Every browser request is intercepted; unknown requests abort, including writes.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import http from 'node:http';
import { build } from 'esbuild';
import ts from 'typescript';
import { chromium } from '@playwright/test';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import loadTailwindConfig from 'tailwindcss/loadConfig.js';

const require = createRequire(import.meta.url);
const root = process.cwd();
const out = path.join(root, 'generated-artifacts/defect-form-verification');
await fs.mkdir(out, { recursive: true });
const exactPath = 'client/src/pages/defects/DefectFormExact.tsx';
const current = await fs.readFile(exactPath, 'utf8');
const ref = process.argv.find(x => x.startsWith('--baseline-ref='))?.split('=')[1];
const baseline = ref ? execFileSync('git', ['show', `${ref}:${exactPath}`], { encoding: 'utf8' }) :
  current.replace('defaultValues: defect ? {', 'defaultValues: defect ? {\n      id: defect.id,')
    .replace('} : {\n      vesselId:', '} : {\n      id: defectRef,\n      vesselId:');
assert.equal(baseline.replace('      id: defect.id,\n', '').replace('      id: defectRef,\n', ''), current,
  'Production form must differ ONLY by the two identity defaults');

function instrument(source) {
  const ast = ts.createSourceFile(exactPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let defaults;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useForm') {
      defaults = node.arguments[0].properties.find(p => p.name?.getText(ast) === 'defaultValues').initializer.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(defaults, 'Extract actual complete default expression');
  return `${source}\nexport const paritySchema = defectFormSchema;
    export const parityDefaults = (defect, defectRef) => (${defaults});`;
}

await build({
  entryPoints: ['tests/defects/isolated-harness.tsx'], bundle: true,
  outfile: path.join(out, 'harness.js'), platform: 'browser', format: 'iife',
  jsx: 'automatic', loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.csv': 'text' },
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.hot': 'undefined', 'import.meta.env': JSON.stringify({ DEV: true, VITE_APP_ENV: 'test' }) },
  plugins: [{
    name: 'isolated-defect-fixtures',
    setup(b) {
      b.onResolve({ filter: /^(before|after)-exact$/ }, args => ({ path: args.path, namespace: 'exact' }));
      b.onLoad({ filter: /.*/, namespace: 'exact' }, args => ({
        contents: instrument(args.path === 'before-exact' ? baseline : current),
        loader: 'tsx', resolveDir: path.join(root, 'client/src/pages/defects'),
      }));
      const mocks = {
        '@/contexts/AuthContext': `const currentUser = {id: 1, userUuid: 'fixture-user', fullName: 'Fixture Reviewer', userType: 'Office', role: 'Technical Superintendent', vesselId: 'FIXTURE-VESSEL'}; export const useAuth = () => ({currentUser});`,
        '@/hooks/use-toast': `export const useToast = () => ({toast: (value) => window.events.toasts.push(value)});`,
        '@/lib/authToken': `export const getAccessToken = () => 'fixture-not-a-real-token'; export const peekAccessToken = getAccessToken;`,
        'react-hook-form': `export * from ${JSON.stringify(require.resolve('react-hook-form'))};
          import {useForm as realUseForm} from ${JSON.stringify(require.resolve('react-hook-form'))};
          export function useForm(...args) { const form = realUseForm(...args); window.fixtureForm = form; return form; }`,
      };
      b.onResolve({ filter: /authToken$/ }, () => ({ path: '@/lib/authToken', namespace: 'fixture' }));
      b.onResolve({ filter: /^(react-hook-form|@\/)/ }, args => {
        if (mocks[args.path]) return { path: args.path, namespace: 'fixture' };
        if (args.path.startsWith('@/')) return { path: path.join(root, 'client/src', args.path.slice(2)) + resolveExtension(args.path) };
      });
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: root }));
    },
  }],
});
// Include the real layout rules; omit remote font downloads in this isolated fixture.
const appCss = (await fs.readFile('client/src/index.css', 'utf8'))
  .replace(/@import url\([^;]+\);/g, '');
const styled = await postcss([tailwindcss(loadTailwindConfig(path.join(root, 'tailwind.config.ts')))])
  .process(appCss, { from: 'client/src/index.css' });
await fs.appendFile(path.join(out, 'harness.css'), styled.css);
function resolveExtension(alias) {
  // esbuild onResolve requires an existing filename for manually resolved aliases.
  const absolute = path.join(root, 'client/src', alias.slice(2));
  for (const ext of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
    try { if (require('node:fs').statSync(absolute + ext).isFile()) return ext; } catch {}
  }
  throw new Error(`Cannot resolve fixture dependency ${alias}`);
}

// This static server serves only the fixture document/bundle. It has no API routes.
const server = http.createServer(async (req, res) => {
  // Screenshot-only mode uses the same fake data boundary without Playwright.
  // No method can ever reach an application API or database through this server.
  if (req.method !== 'GET') { res.writeHead(405); res.end('Fixture server is read-only'); return; }
  if (req.url.startsWith('/technical/api/')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url.includes('vessels') ?
      [{ id: 'V001', vessel: 'MV SEAFARER' }] : []));
    return;
  }
  const name = req.url === '/harness.js' ? 'harness.js' : req.url === '/harness.css' ? 'harness.css' : null;
  res.setHeader('Content-Type', name?.endsWith('.js') ? 'text/javascript' : name ? 'text/css' : 'text/html');
  res.end(name ? await fs.readFile(path.join(out, name)) :
    '<!doctype html><html><head><link rel="stylesheet" href="/harness.css"></head><body><div id="root"></div><script src="/harness.js"></script></body></html>');
});
await new Promise(resolve => server.listen(process.argv.includes('--preview-only') ? 5001 : 0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
if (process.argv.includes('--preview-only')) {
  console.log(`Isolated fixture preview: ${origin}`);
  await new Promise(() => {});
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/repl/tools/bin/chromium', args: ['--no-sandbox'] });
const results = [];
const unexpected = [];
const browserErrors = [];
let parityEvidence;

async function open(query = '') {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const writes = [];
  let failSave = false;
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() !== 'GET') {
      if (url.origin === origin && /^\/technical\/api\/defects(?:\/FIXTURE-ORIGINAL-ID)?$/.test(url.pathname) &&
        ['POST', 'PATCH'].includes(req.method())) {
        writes.push({ method: req.method(), url: url.pathname, body: req.postDataJSON() });
        return route.fulfill({ status: failSave ? 500 : 200, contentType: 'application/json',
          body: JSON.stringify(failSave ? { message: 'fixture failure' } : { id: 'FIXTURE-ORIGINAL-ID' }) });
      }
      unexpected.push(`${req.method()} ${url.pathname}`);
      return route.abort('blockedbyclient');
    }
    if (url.origin === origin && ['/', '/harness.js', '/harness.css'].includes(url.pathname)) return route.continue();
    let data;
    if (url.pathname.includes('role-view-mappings/resolve')) data = { mode: 'Tech_Superintendent', reason: null };
    else if (url.pathname.startsWith('/technical/api/defects')) {
      const fixture = {
      id: 'FIXTURE-ORIGINAL-ID', vesselId: 'FIXTURE-VESSEL', vesselName: 'Fixture Vessel',
      category: 'Defect', description: 'Fixture description', issueDate: '2026-10-15', componentId: 'FIXTURE-COMPONENT', status: 'Open',
      };
      data = url.pathname === '/technical/api/defects/FIXTURE-ORIGINAL-ID' ? fixture : [fixture];
    }
    else if (url.pathname.includes('vessels')) data = [{ id: 'FIXTURE-VESSEL', vuuid: 'FIXTURE-VESSEL', vessel: 'Fixture Vessel', vesselName: 'Fixture Vessel' }, { id: 'V001', vessel: 'MV SEAFARER' }];
    else if (/\/technical\/api\/|\/api\/master-data\//.test(url.pathname)) data = [];
    else if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204 });
    else {
      unexpected.push(`GET ${url.origin}${url.pathname}`);
      return route.abort('blockedbyclient');
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  const page = await context.newPage();
  page.on('console', msg => { if (msg.type() === 'error') console.error('Browser console:', msg.text()); });
  page.on('pageerror', e => { browserErrors.push(e.message); console.error('Browser error:', e.message); });
  await page.goto(`${origin}/?${query}`);
  try {
    await page.waitForFunction(() => window.parity &&
      (new URLSearchParams(location.search).get('screen') === 'log' || window.fixtureForm),
      null, { timeout: 10000 });
  } catch (error) {
    console.error('Fixture state:', await page.evaluate(() => ({ body: document.body.innerText.slice(0, 1200), form: !!window.fixtureForm, parity: !!window.parity, url: location.href })));
    throw error;
  }
  return { context, page, writes, fail: () => { failSave = true; } };
}
async function check(name, fn) {
  await fn();
  results.push(name);
  console.log(`PASS ${name}`);
}
async function settled(page, predicate) { await page.waitForFunction(predicate); }

try {
  await check('Installed schema and resolver: before/after parsed payloads and complete validation errors', async () => {
    const { context, page } = await open();
    parityEvidence = await page.evaluate(async () => {
      const fixture = window.fixture;
      const rich = {
        description: 'Rich fixture', descriptionHtml: '<p><strong>Rich fixture</strong></p>',
        descriptionText: 'Rich fixture',
        immediateCause: { unsafeAct: ['Fixture act'], unsafeCondition: ['Fixture condition'] },
        rootCause: { individualFactor: ['Fixture factor'], systemFactor: ['Fixture system'] },
      };
      const probes = [
        ['new initial', undefined, {}],
        ['new valid', undefined, { description: 'Valid new' }],
        ['edit valid', fixture, {}],
        ['required failures', fixture, { vesselId: '', description: '' }],
        ['missing required types', fixture, { vesselId: undefined, description: undefined }],
        ['rich text and structured causes', fixture, rich],
        ['nullable false zero', { ...fixture, severity: 0, critical: false, deferApprovalRequired: false }, { severity: 0, critical: false, is_coc: false, equipmentMake: null }],
        ['date reporting CoC defer', fixture, { issueDate: '2026-10-14', targetCloseDate: '2026-10-20', dateCompleted: '2026-10-16', verifiedDate: '2026-10-17', is_coc: true, isDeferred: true, deferReason: 'Fixture reason', deferNewTargetDate: '2026-11-01', deferApprovalRequired: false, reportToThirdParty: true, classReport: true, flagReport: false, portReport: true, reportReferenceNo: 'FIXTURE-REPORT', reportDate: '2026-10-15' }],
        ['identity metadata stripped', fixture, { id: 'ATTACK-ID', duuid: 'ATTACK-UUID', createdAt: new Date(), updatedAt: new Date(), description: 'Valid' }],
      ];
      return Promise.all(probes.map(async ([name, record, patch]) => ({ name, pair: await window.parity(record, patch) })));
    });
    for (const { name, pair } of parityEvidence) {
      assert.deepEqual(pair[0], pair[1], name);
      for (const result of pair) if (result.parsed.success) {
        for (const key of ['id', 'duuid', 'createdAt', 'updatedAt']) assert.ok(!(key in result.resolved.values), `${name}: ${key} stripped`);
      }
    }
    assert.equal(parityEvidence[0].pair[0].parsed.success, false);
    assert.equal(parityEvidence[1].pair[0].parsed.success, true);
    assert.equal(parityEvidence[3].pair[0].parsed.success, false);
    const errors = parityEvidence[3].pair[0].resolved.errors;
    assert.equal(errors.vesselId.message, 'Vessel is required');
    assert.equal(errors.description.message, 'Description is required');
    await context.close();
  });

  const observations = {};
  for (const version of ['before', 'after']) {
    for (const mode of ['new', 'edit', 'view']) {
      await check(`${version}: mounted ${mode}, reference stability, method/URL/payload and callbacks`, async () => {
        const { context, page, writes } = await open(`version=${version}&mode=${mode}`);
        const reference = await page.locator('span').filter({ hasText: mode === 'new' ? /^DN\// : /^FIXTURE-ORIGINAL-ID$/ }).first().textContent();
        assert.ok(reference);
        if (mode === 'view') {
          assert.equal(await page.getByTestId('button-save-header').isDisabled(), true);
          assert.equal(await page.getByTestId('button-submit').isDisabled(), true);
          await page.getByTestId('button-back').click();
          await settled(page, () => window.events.closed === 1);
          assert.equal(writes.length, 0);
        } else {
          // Actual editor/control interaction and structured cause field values.
          await page.locator('.ql-editor[contenteditable=true]').fill('Mounted fixture rich text');
          await page.getByTestId('input-issue-date').fill('2026-10-15');
          await page.evaluate(() => {
            window.fixtureForm.setValue('immediateCause', { unsafeAct: ['Fixture act'], unsafeCondition: ['Fixture condition'] });
            window.fixtureForm.setValue('rootCause', { individualFactor: ['Fixture factor'], systemFactor: ['Fixture system'] });
          });
          assert.equal(await page.locator('span').filter({ hasText: reference }).first().textContent(), reference);
          const expected = await page.evaluate(() => window.parsedDefaults(
            new URLSearchParams(location.search).get('mode') === 'edit' ? window.fixture : undefined,
            window.fixtureForm.getValues(),
          ));
          await page.getByTestId('button-save-header').click();
          await settled(page, () => window.events.closed === 1);
          assert.equal(writes.length, 1);
          assert.equal(writes[0].method, mode === 'edit' ? 'PATCH' : 'POST');
          assert.equal(writes[0].url, `/technical/api/defects${mode === 'edit' ? '/FIXTURE-ORIGINAL-ID' : ''}`);
          assert.deepEqual(writes[0].body, JSON.parse(JSON.stringify(expected)));
          assert.equal(writes[0].body.vesselId, mode === 'edit' ? 'FIXTURE-VESSEL' : 'V001');
          assert.match(writes[0].body.descriptionHtml, /<p>Mounted fixture rich text<\/p>/);
          assert.equal(writes[0].body.descriptionText.trim(), 'Mounted fixture rich text');
          for (const key of ['id', 'duuid', 'createdAt', 'updatedAt']) assert.ok(!(key in writes[0].body));
          const events = await page.evaluate(() => window.events);
          assert.deepEqual(events.invalidations, [[true, true, true, false]]);
          assert.equal(events.toasts.at(-1).title, 'Success');
          observations[`${version}-${mode}`] = { writes, events };
        }
        await context.close();
      });
    }
    await check(`${version}: required validation blocks requests`, async () => {
      const { context, page, writes } = await open(`version=${version}`);
      await page.getByTestId('button-save-header').click();
      await settled(page, () => !!window.fixtureForm.formState.errors.description);
      assert.equal(writes.length, 0);
      assert.equal(await page.evaluate(() => window.events.closed), 0);
      await context.close();
    });
    await check(`${version}: critical warnings are nonblocking; failure keeps form open; Back closes`, async () => {
      const { context, page, writes, fail } = await open(`version=${version}&mode=edit`);
      await page.getByTestId('checkbox-critical').click();
      fail();
      await page.getByTestId('button-save-header').click();
      await settled(page, () => window.events.toasts.some(x => x.title === 'Error'));
      assert.equal(writes.length, 1);
      const events = await page.evaluate(() => window.events);
      assert.deepEqual(events.toasts.map(x => x.title), ['Missing Immediate Cause', 'Missing Root Cause', 'Error']);
      assert.match(events.toasts.at(-1).description, /fixture failure/);
      assert.equal(events.closed, 0);
      assert.deepEqual(events.invalidations, []);
      await page.getByTestId('button-back').click();
      await settled(page, () => window.events.closed === 1);
      await context.close();
    });
  }
  for (const mode of ['new', 'edit']) assert.deepEqual(observations[`before-${mode}`], observations[`after-${mode}`], `Mounted ${mode} parity`);

  await check('Current log opens actual wizard/modal with fixture-resolved normal office role', async () => {
    const { context, page, writes } = await open('screen=log');
    await page.getByTestId('button-edit-FIXTURE-ORIGINAL-ID').waitFor();
    assert.equal(await page.getByTestId('button-edit-FIXTURE-ORIGINAL-ID').isEnabled(), true);
    await page.getByTestId('button-edit-FIXTURE-ORIGINAL-ID').click();
    await page.getByTestId('text-report-id').waitFor();
    await page.getByTestId('button-close').click();
    await page.getByTestId('button-view-FIXTURE-ORIGINAL-ID').click();
    await page.getByTestId('text-report-id').waitFor();
    await page.getByTestId('button-close').click();
    await page.getByTestId('button-new-defect').click();
    await page.getByTestId('input-date-observed').waitFor();
    await page.getByTestId('select-vessel').waitFor();
    await page.getByTestId('button-close').click();
    assert.equal(writes.length, 0);
    await context.close();
  });
  for (const mode of ['edit', 'view']) await check(`Current modal fetches fixture and opens wizard ${mode} without unintended save`, async () => {
    const { context, page, writes } = await open(`screen=modal&mode=${mode}`);
    await page.getByTestId('text-report-id').waitFor();
    await page.getByTestId('button-close').click();
    await settled(page, () => window.events.closed === 1);
    assert.equal(writes.length, 0);
    await context.close();
  });
  assert.deepEqual(unexpected, [], 'No unexpected network request can escape interception');
  assert.deepEqual(browserErrors, [], 'No uncaught mounted UI errors');
  await fs.writeFile(path.join(out, 'behavior.json'), JSON.stringify({ results, parityEvidence, observations, unexpected, browserErrors }, null, 2));
  console.log(`PASS ${results.length} scoped checks; zero forwarded API requests or DB connections`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
