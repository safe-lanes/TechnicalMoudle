/**
 * Browser regressions against the actual mounted full-page component editor.
 * Every API request, including writes, is mocked. No app server or DB is used.
 * Run: node scripts/verify-component-editor.mjs [--baseline | --baseline-ref=<git-ref>]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const root = process.cwd();
const out = path.join(root, 'generated-artifacts/component-editor');
await fs.mkdir(out, { recursive: true });
const baselineRef = process.argv.find(arg => arg.startsWith('--baseline-ref='))?.slice('--baseline-ref='.length);
const baseline = process.argv.includes('--baseline') || !!baselineRef;
const mocks = {
  '@/contexts/PermissionsContext': `export const usePermissions = () => ({canCreate:()=>true,canEdit:()=>true,canDelete:()=>false});`,
  '@/contexts/UIRoleContext': `export const useUIRole = () => ({isSailAdmin:true});`,
  '@/contexts/AuthContext': `export const useAuth=()=>({isOfficeUser:true,currentUser:{fullName:'Fixture User'},canViewDocument:()=>true,canDownloadDocument:()=>true});`,
  '@/contexts/ChangeRequestContext': `export const useChangeRequest=()=>({isChangeRequestMode:false});`,
  '@/contexts/ChangeModeContext': `export const useChangeMode=()=>({isChangeMode:false,getDiffs:()=>[]});`,
  '@/hooks/useModifyMode': `export const useModifyMode=()=>({isModifyMode:false});`,
  '@/hooks/useResolvedUserName': `export const useResolvedUserName=()=>({resolvedUserName:'Fixture User'});`,
  '@/hooks/use-toast': `export const useToast = () => ({toast: value => window.events.toasts.push(value)});`,
  '@/hooks/useVessels': `export const useVessels = () => ({data:[{id:'v1',name:'Fixture Vessel',code:'VESSEL1'},{id:'v2',name:'Other Vessel',code:'VESSEL2'}]});`,
  '@/contexts/VesselContext': `import {createContext,useContext} from 'react'; export const VesselContext=createContext(null); export const useVessel=()=>useContext(VesselContext);`,
  '@/hooks/useDepartments': `const items=[{listKey:'6',listValue:'Machinery',isActive:true}]; export const useMasterListOptions=()=>({options:[{label:'Machinery',value:'Machinery'}],items}); export const useDepartmentOptions=()=>({options:[{label:'Engine',value:'Engine'}]});`,
  '@/components/StampSelect': `export default function Stamp(){return null;}`,
  '@/lib/queryClient': `import {QueryClient} from '@tanstack/react-query';
    export const apiRequest=async(method,url,data)=>{const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});if(!res.ok)throw Error(res.status+': '+await res.text());return res;};
    export const queryClient=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false,queryFn:async({queryKey})=>(await apiRequest('GET',queryKey[0])).json()}}});
    export const invalidateByUrlPrefix=()=>{};`,
};
// Keep unrelated dialogs/grids out of this isolated editor bundle.
for (const [name, named] of [
  ['Marker', true], ['RoleGuard', 'AdminOnly'], ['ComponentRegisterForm', false],
  ['ComponentRegisterFormCR', false], ['AddEditComponentForm', false], ['WOAgGridTable', false],
  ['ReviewChangesDrawer', true], ['ReplaceRotationalItemDialog', true], ['WorkOrderViewerSheet', true],
  ['modify/ModifyFieldWrapper', 'ModifyFieldWrapper'], ['modify/ModifyStickyFooter', 'ModifyStickyFooter'],
]) {
  const exportName = named === true ? name : named;
  mocks[`@/components/${name}`] = exportName
    ? `export function ${exportName}({children}){return children || null;}`
    : 'export default function Unrelated(){return null;}';
}
await build({
  entryPoints: ['tests/components/editor-harness.tsx'], bundle: true,
  outfile: path.join(out, 'harness.js'), platform: 'browser', format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': JSON.stringify({ DEV: true, VITE_APP_ENV: 'test' }) },
  plugins: [{
    name: 'component-fixtures',
    setup(b) {
      b.onResolve({ filter: /^@\// }, args => {
        if (mocks[args.path]) return { path: args.path, namespace: 'mock' };
      });
      b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({
        contents: mocks[args.path], loader: 'tsx', resolveDir: root,
      }));
      b.onLoad({ filter: /ComponentRegisterAddEdit\.tsx$/ }, async () => {
        const source = baseline
          ? execFileSync('git', ['show', `${baselineRef || 'HEAD'}:client/src/components/ComponentRegisterAddEdit.tsx`], { encoding: 'utf8' })
          : await fs.readFile('client/src/components/ComponentRegisterAddEdit.tsx', 'utf8');
        // Spares are mapped but not rendered by the existing editor. Observe that
        // existing local state only in the isolated bundle; do not add a prod hook.
        const marker = '  return (\n    <div className="h-full flex flex-col bg-gray-50">';
        assert.ok(source.includes(marker));
        return {
          contents: source.replace(marker, '  window.editorSnapshot = {componentData, spares, workOrders, selectedComponentId, originalIsActive: originalIsActiveRef.current};\n' + marker),
          loader: 'tsx', resolveDir: path.join(root, 'client/src/components'),
        };
      });
    },
  }],
});
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', req.url === '/harness.js' ? 'application/javascript' : 'text/html');
  res.end(req.url === '/harness.js' ? await fs.readFile(path.join(out, 'harness.js')) :
    '<div id="root"></div><script src="/harness.js"></script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/repl/tools/bin/chromium', args: ['--no-sandbox'] });
const results = [];
const pauses = new Map();
async function run(name, fn, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.setDefaultTimeout(8000);
  const writes = [];
  const rows = [
    { id: 'a', cuuid: 'a', vesselId: 'v1', vesselCode: 'VESSEL1', componentCode: '601', name: 'Fixture 601', parentId: '6', componentCategory: 'Machinery', model: '', isActive: true, eqptSystemDept: 'Engine', runningHours: 1234, critical: true, conditionBased: true, rotationalItem: true, currentStamp: 'STAMP', classItem: true, isParent: false, rhCounterType: 'INHERITED', rhCounterSource: 'MASTER', rhMasterComponentId: 'master', lastUpdated: '2026-10-01' },
  ];
  rows.push({ ...rows[0], id: 'b', cuuid: 'b', componentCode: '602', name: 'Fixture 602', model: 'SECOND' });
  if (options.inactive) rows[0].isActive = false;
  if (options.nested) {
    rows[0].parentId = '60';
    rows.push({ ...rows[1], id: 'parent', componentCode: '60', parentId: '6', name: 'Parent Fixture' });
  }
  if (options.nullValues) Object.assign(rows[0], {
    runningHours: null, currentCumulativeRH: 0, lastUpdated: null, rhLastUpdated: null,
    critical: null, conditionBased: false, rotationalItem: false, currentStamp: null,
    classItem: null, isParent: null, rhCounterType: null, rhCounterSource: null, rhMasterComponentId: null,
  });
  let failSave = options.failSave;
  await page.route('**/technical/api/**', async route => {
    const req = route.request(), url = new URL(req.url());
    const p = url.pathname;
    if (req.method() !== 'GET') {
      const multipart = req.headers()['content-type']?.includes('multipart/form-data');
      const data = multipart
        ? Object.fromEntries(Array.from(req.postData()?.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)/g) || [], m => [m[1], m[2]]))
        : req.postDataJSON();
      writes.push({ method: req.method(), path: p, data });
      if (failSave || (options.failInactivate && p.endsWith('/inactivate'))) return route.fulfill({ status: 503, body: 'Fixture write failed' });
      if (p.endsWith('/components/a/inactivate')) rows[0].isActive = false;
      if (req.method() === 'PATCH') Object.assign(rows.find(r => r.id === p.split('/').pop()), data);
      return route.fulfill({ json: { ...data, id: 'created', cuuid: 'created' } });
    }
    const key = p.includes('/details/') ? 'details' : p === '/technical/api/spares' ? 'spares' :
      p === '/technical/api/jobs' ? 'jobs' : /^\/technical\/api\/components\/v/.test(p) ? 'components' : '';
    if (options.delay === key) {
      options.delay = null;
      await new Promise(resolve => pauses.set(page, resolve));
    }
    if (options.fail === key) return route.fulfill({ status: 503, body: 'Fixture unavailable' });
    let data = [];
    if (key === 'details') data = rows.find(r => r.id === p.split('/').pop());
    if (key === 'components') data = rows;
    if (p.includes('/master-components/')) data = [{ id: 'master', componentCode: '600', name: 'Master' }];
    if (p.includes('/running-hours')) data = {};
    return route.fulfill({ json: data });
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}${options.fullPage ? '/?full-page' : ''}`);
    if (options.fullPage) {
      await page.waitForLoadState('networkidle');
      await page.getByText('6 Machinery Main Components', { exact: true }).click();
      await page.getByText('Fixture 601', { exact: false }).first().click();
      await page.getByTestId('B7.2').click();
    } else await page.getByRole('button', { name: options.add ? 'Initial Add' : 'Edit Component', exact: true }).click();
    await fn({ page, writes, rows, retry: () => { failSave = false; }, release: () => { pauses.get(page)?.(); pauses.delete(page); } });
    assert.deepEqual(errors, [], 'No browser runtime errors');
    results.push({ name, status: 'passed' });
    console.log('PASS', name);
  } catch (e) {
    results.push({ name, status: 'failed', error: String(e) });
    console.error('FAIL', name, String(e), errors);
    if (options.fullPage) console.error((await page.locator('body').innerText()).slice(0, 2500));
    await page.screenshot({ path: path.join(out, `${results.length}-failure.png`) });
  } finally { pauses.get(page)?.(); pauses.delete(page); await page.close(); }
}
const model = page => page.getByTestId('input-model');
async function loaded(page, value = '') {
  await page.getByTestId('input-component-name').waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="input-component-name"]')?.value === 'Fixture 601');
  assert.equal(await model(page).inputValue(), value);
}
async function type(page) {
  const input = model(page);
  await input.click();
  await input.pressSequentially('AUTOTEST123', { delay: 40 });
  assert.equal(await input.inputValue(), 'AUTOTEST123');
  assert.equal(await input.evaluate(el => document.activeElement === el), true);
  await input.press('Backspace');
  await input.press('Home'); await input.press('ArrowRight'); await input.pressSequentially('MID');
  assert.equal(await input.inputValue(), 'AMIDUTOTEST12');
  assert.equal(await input.evaluate(el => el.selectionStart), 4);
}
try {
  await run('503 Spares continuous typing, backspace, insertion and visible error', async ({ page }) => {
    await loaded(page); await type(page);
    assert.match(await page.getByRole('alert').innerText(), /Spares Load Failed.*Fixture unavailable.*not an empty result/s);
    await page.screenshot({ path: path.join(out, baseline ? 'baseline.png' : 'fixed.png') });
  }, { fail: 'spares', fullPage: true });
  await run('pre-existing tree display/selection versus Save target mismatch (isolated writes only)', async ({ page, writes }) => {
    await loaded(page);
    await page.getByTestId('tree-node-602').click();
    assert.equal(await model(page).inputValue(), 'SECOND');
    assert.equal(await page.evaluate(() => window.editorSnapshot.selectedComponentId), '602');
    await page.getByTestId('button-save').click();
    await page.waitForFunction(() => window.events.backs === 1);
    assert.equal(writes[0].path, '/technical/api/components/a');
    assert.equal(writes[0].data.componentCode, '602');
  });
  if (!baseline) {
    for (const key of ['jobs', 'components']) {
      await run(`503 ${key} does not reset typing`, async ({ page }) => {
        await loaded(page); await type(page);
        assert.match(await page.getByRole('alert').innerText(), /Load Failed.*not an empty result/s);
      }, { fail: key });
    }
    for (const key of ['jobs', 'spares', 'components']) {
      await run(`pending then successful ${key} preserves typing and draft`, async ({ page, release }) => {
        await loaded(page); await type(page); release();
        await page.waitForLoadState('networkidle');
        assert.equal(await model(page).inputValue(), 'AMIDUTOTEST12');
        assert.equal(await model(page).evaluate(el => el.selectionStart), 4);
        assert.equal(await model(page).evaluate(el => document.activeElement === el), true);
      }, { delay: key });
    }
    await run('late tables and repeated background updates preserve draft, baseline and collapsed tree', async ({ page, rows }) => {
      await loaded(page); await type(page);
      await page.getByTestId('select-is-active').selectOption('No');
      const rootNode = page.getByTestId('tree-node-6');
      await rootNode.getByRole('button').click();
      assert.equal(await page.getByTestId('tree-node-601').count(), 0);
      for (let i = 0; i < 3; i++) {
        await page.evaluate(({ rows, i }) => {
          window.cache('/technical/api/jobs?vesselId=v1', [{ id: `job${i}`, componentCode: '601', jobTitle: `Late Job ${i}` }]);
          window.cache('/technical/api/spares', [{ id: `spare${i}`, componentId: 'a', name: 'Late Spare' }]);
          window.cache('/technical/api/components/v1', rows.map(r => ({ ...r, model: `SERVER${i}` })));
          window.cache('/technical/api/components/details/a', { ...rows[0], model: `DETAIL${i}` });
        }, { rows, i });
        await page.getByText(`Late Job ${i}`, { exact: true }).waitFor();
        await page.waitForFunction(i => window.editorSnapshot.spares[0]?.id === `spare${i}`, i);
        assert.equal(await model(page).inputValue(), 'AMIDUTOTEST12');
        assert.equal(await page.getByTestId('select-is-active').inputValue(), 'No');
        assert.equal(await page.evaluate(() => window.editorSnapshot.originalIsActive), 'Yes');
        assert.equal(await page.getByTestId('tree-node-601').count(), 0);
      }
      assert.deepEqual(await page.evaluate(() => window.editorSnapshot.spares[0]), {
        id: 'spare2', partCode: 'spare2', partName: 'Late Spare', min: 1, critical: 'No', location: '', location2: '',
      });
      assert.deepEqual(await page.evaluate(() => window.editorSnapshot.workOrders[0]), {
        id: 'job2', woNo: 'job2', jobTitle: 'Late Job 2', assignedTo: 'Chief Engineer', dueDate: '', status: 'Due', isActive: undefined,
      });
    });
    await run('editing Component Code cannot display or deactivate another record’s jobs', async ({ page, writes }) => {
      await loaded(page);
      const jobs = [
        { id: 'job-a', componentCode: '601', jobTitle: 'Job belonging to A', isActive: true },
        { id: 'job-b', componentCode: '602', jobTitle: 'Job belonging to B', isActive: true },
      ];
      await page.evaluate(jobs => window.cache('/technical/api/jobs?vesselId=v1', jobs), jobs);
      await page.getByText('Job belonging to A', { exact: true }).waitFor();
      await page.getByTestId('input-component-code').fill('602');
      // Let a related query update after the draft code has been edited too.
      await page.evaluate(jobs => window.cache('/technical/api/jobs?vesselId=v1', jobs.map(j => ({ ...j, status: 'Due' }))), jobs);
      await page.waitForTimeout(100);
      assert.equal(await page.getByText('Job belonging to B', { exact: true }).count(), 0);
      assert.equal(await page.getByTestId('button-delete-wo-job-b').count(), 0);
      await page.getByTestId('button-delete-wo-job-a').click();
      await page.getByTestId('btn-deactivate-job-confirm').click();
      await page.waitForFunction(() => window.events.toasts.some(t => t.title === 'Job deactivated successfully'));
      assert.deepEqual(writes.map(w => [w.method, w.path]), [['POST', '/technical/api/jobs/job-a/inactivate']]);
      assert.equal(writes[0].data.vesselId, 'v1');
      // An intentional tree selection must still switch the related record.
      await page.getByTestId('tree-node-602').click();
      await page.getByText('Job belonging to B', { exact: true }).waitFor();
      assert.equal(await page.getByText('Job belonging to A', { exact: true }).count(), 0);
      assert.equal(await page.getByTestId('button-delete-wo-job-b').count(), 1);
      assert.equal(writes.length, 1);
    });
    await run('prop transition rejects delayed old details and saves the new record', async ({ page, release, writes }) => {
      await page.waitForFunction(() => window.selectProp !== undefined);
      await page.evaluate(() => window.selectProp('b'));
      await page.waitForFunction(() => document.querySelector('[data-testid="input-model"]')?.value === 'SECOND');
      release(); await page.waitForLoadState('networkidle');
      assert.equal(await model(page).inputValue(), 'SECOND');
      await model(page).click(); await model(page).press('End'); await model(page).pressSequentially('NEW');
      await page.getByTestId('button-save').click();
      await page.waitForFunction(() => window.events.backs === 1);
      assert.equal(writes[0].path, '/technical/api/components/b');
      assert.equal(writes[0].data.model, 'SECONDNEW');
    }, { delay: 'details' });
    await run('same-instance tree selection rejects old details; documents existing Save identity mismatch', async ({ page, release, writes }) => {
      await page.getByTestId('tree-node-6').getByRole('button').click();
      await page.getByTestId('tree-node-602').click();
      await page.waitForFunction(() => document.querySelector('[data-testid="input-model"]')?.value === 'SECOND');
      await model(page).click(); await model(page).press('End'); await model(page).pressSequentially('DRAFT');
      release(); await page.waitForLoadState('networkidle');
      assert.equal(await model(page).inputValue(), 'SECONDDRAFT');
      assert.equal(await page.evaluate(() => window.editorSnapshot.selectedComponentId), '602');
      await page.getByTestId('button-save').click();
      await page.waitForFunction(() => window.events.backs === 1);
      // This is an existing defect, deliberately NOT a new selection/save contract.
      assert.equal(writes[0].path, '/technical/api/components/a');
      assert.equal(writes[0].data.componentCode, '602');
    }, { delay: 'details' });
    await run('edit-to-add rejects delayed details, clears tables and creates rather than patches', async ({ page, release, writes }) => {
      await page.getByTestId('button-add-edit-component').click();
      await page.getByTestId('input-component-name').fill('New Fixture');
      await model(page).pressSequentially('NEW');
      release(); await page.waitForLoadState('networkidle');
      assert.equal(await model(page).inputValue(), 'NEW');
      assert.equal(await page.getByTestId('input-component-name').inputValue(), 'New Fixture');
      assert.equal(await page.getByTestId('input-component-code').inputValue(), '601.001');
      assert.deepEqual(await page.evaluate(() => [window.editorSnapshot.workOrders, window.editorSnapshot.spares]), [[], []]);
      await page.getByTestId('select-eqpt-system-dept').selectOption('Engine');
      await page.getByTestId('button-save').click();
      await page.waitForFunction(() => window.events.backs === 1);
      assert.deepEqual(writes.map(w => [w.method, w.path]), [['POST', '/technical/api/components']]);
    }, { delay: 'details' });
    await run('initial Add generates parent code after delayed list without replacing draft', async ({ page, release, writes }) => {
      await page.getByTestId('input-component-name').fill('Initial Fixture');
      await model(page).pressSequentially('DRAFT');
      assert.equal(await page.getByTestId('input-component-code').inputValue(), '');
      release(); await page.waitForLoadState('networkidle');
      assert.equal(await page.getByTestId('input-component-code').inputValue(), '603');
      assert.equal(await model(page).inputValue(), 'DRAFT');
      await page.getByTestId('select-eqpt-system-dept').selectOption('Engine');
      await page.getByTestId('button-save').click();
      await page.waitForFunction(() => window.events.backs === 1);
      assert.equal(writes[0].method, 'POST');
      assert.equal(writes[0].data.parentId, '6');
      assert.equal(writes[0].data.componentCode, '603');
    }, { add: true, delay: 'components' });
    await run('late component list expands ancestors once without replacing the draft', async ({ page, rows, release }) => {
      await loaded(page); await type(page); release();
      await page.getByTestId('tree-node-601').waitFor();
      assert.equal(await model(page).inputValue(), 'AMIDUTOTEST12');
      await page.getByTestId('tree-node-60').getByRole('button').click();
      await page.evaluate(rows => window.cache('/technical/api/components/v1', rows.map(r => ({ ...r, notes: 'Refreshed' }))), rows);
      await page.waitForTimeout(100);
      assert.equal(await page.getByTestId('tree-node-601').count(), 0);
      assert.equal(await model(page).inputValue(), 'AMIDUTOTEST12');
    }, { delay: 'components', nested: true });
    await run('discard and reopen starts a clean draft', async ({ page, writes }) => {
      await loaded(page); await type(page);
      await page.getByTestId('button-back').click();
      await page.getByRole('button', { name: 'Edit Component', exact: true }).click();
      await loaded(page);
      assert.equal(writes.length, 0);
    });
    for (const pending of [false, true]) {
      await run(`vessel transition clears ${pending ? 'pending' : 'loaded'} old record and prevents cross-vessel save`, async ({ page, release, writes }) => {
        if (!pending) { await loaded(page); await type(page); }
        await page.evaluate(() => window.changeVessel('v2'));
        release(); await page.waitForLoadState('networkidle');
        assert.equal(await model(page).inputValue(), '');
        assert.equal(await page.getByTestId('input-component-name').inputValue(), '');
        await page.getByTestId('button-save').click();
        assert.equal(writes.length, 0);
        assert.match(await page.evaluate(() => window.events.toasts.at(-1).description), /not available for this vessel/);
      }, pending ? { delay: 'details' } : {});
    }
    for (const activeCase of ['unchanged', 'deactivate', 'inactive', 'deactivation failure']) {
      await run(`active status: ${activeCase}, request sequencing and protected text-only payload`, async ({ page, writes }) => {
        await loaded(page); await type(page);
        if (activeCase.includes('deactivat')) await page.getByTestId('select-is-active').selectOption('No');
        await page.getByTestId('button-save').click();
        if (activeCase === 'deactivation failure') {
          await page.waitForFunction(() => window.events.toasts.some(t => t.title === 'Component Deactivation Failed'));
          assert.deepEqual(writes.map(w => w.method), ['POST']);
          assert.equal(await model(page).inputValue(), 'AMIDUTOTEST12');
          return;
        }
        await page.waitForFunction(() => window.events.backs === 1);
        assert.deepEqual(writes.map(w => [w.method, w.path]), activeCase === 'deactivate'
          ? [['POST', '/technical/api/components/a/inactivate'], ['PATCH', '/technical/api/components/a']]
          : [['PATCH', '/technical/api/components/a']]);
        const payload = writes.at(-1).data;
        for (const [key, value] of Object.entries({
          model: 'AMIDUTOTEST12', runningHours: 1234, lastUpdated: '2026-10-01',
          critical: true, conditionBased: true, rotationalItem: true, currentStamp: 'STAMP',
          classItem: true, isParent: false, rhCounterType: 'INHERITED', rhMasterComponentId: 'master', vesselId: 'v1',
        })) assert.equal(payload[key], value, key);
        assert.equal('rhCounterSource' in payload, false, 'Existing Save contract does not submit rhCounterSource');
        assert.equal('classificationSociety' in payload, false, 'Classification persistence remains unchanged');
        assert.equal(payload.isActive, activeCase === 'deactivate' ? undefined : activeCase !== 'inactive');
        await page.getByRole('button', { name: 'Edit Component', exact: true }).click();
        await loaded(page, 'AMIDUTOTEST12');
        assert.equal(await page.getByTestId('select-is-active').inputValue(), activeCase === 'unchanged' ? 'Yes' : 'No');
      }, { inactive: activeCase === 'inactive', failInactivate: activeCase === 'deactivation failure' });
    }
    await run('failed Save retains draft; retry succeeds and reopen shows saved value', async ({ page, writes, retry }) => {
      await loaded(page); await type(page);
      await page.getByTestId('button-save').click();
      await page.waitForFunction(() => window.events.toasts.some(t => t.title === 'Component Save Failed'));
      assert.equal(await model(page).inputValue(), 'AMIDUTOTEST12');
      await page.evaluate(() => window.refresh('/technical/api/components/details/a'));
      await page.waitForLoadState('networkidle');
      assert.equal(await model(page).inputValue(), 'AMIDUTOTEST12');
      retry();
      await page.getByTestId('button-save').click();
      await page.waitForFunction(() => window.events.backs === 1);
      assert.equal(writes.length, 2);
      await page.getByRole('button', { name: 'Edit Component', exact: true }).click();
      await loaded(page, 'AMIDUTOTEST12');
    }, { failSave: true });
    await run('null and false protected values retain existing hydration and Save defaults', async ({ page, writes }) => {
      await loaded(page); await type(page);
      await page.getByTestId('button-save').click();
      await page.waitForFunction(() => window.events.backs === 1);
      for (const [key, value] of Object.entries({
        runningHours: 0, lastUpdated: null, critical: false, conditionBased: false,
        rotationalItem: false, currentStamp: null, classItem: false, isParent: false,
        rhCounterType: 'NOT_RH_DRIVEN', rhMasterComponentId: null,
      })) assert.equal(writes[0].data[key], value, key);
    }, { nullValues: true });
    await run('document upload keeps its existing target and cannot replace the draft', async ({ page, writes }) => {
      await loaded(page); await type(page);
      await page.locator('input[type=file]').first().setInputFiles({
        name: 'fixture.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nfixture\n'),
      });
      await page.waitForFunction(() => window.events.toasts.some(t => t.title === 'Document Uploaded'));
      assert.equal(writes.length, 1);
      assert.equal(writes[0].path, '/technical/api/component-documents');
      assert.equal(writes[0].data.componentId, 'a');
      assert.equal(writes[0].data.componentCode, '601');
      assert.equal(writes[0].data.vesselCode, 'VESSEL1');
      assert.equal(await model(page).inputValue(), 'AMIDUTOTEST12');
    }, { fail: 'spares' });
    await run('existing component Job action navigates without saving the component', async ({ page, writes }) => {
      await loaded(page); await type(page);
      await page.getByTestId('button-add-job').click();
      await page.waitForURL('**/pms/work-order/new/**');
      assert.equal(new URL(page.url()).pathname, '/pms/work-order/new/601');
      assert.equal(writes.length, 0);
    });
    await run('actual Components parent closes the editor on a vessel transition', async ({ page, release, writes }) => {
      await page.evaluate(() => window.changeVessel('v2'));
      release(); await page.waitForLoadState('networkidle');
      await page.getByTestId('B1').waitFor();
      assert.equal(await model(page).count(), 0);
      assert.equal(writes.length, 0);
    }, { fullPage: true, delay: 'details' });
    await run('create then new Job navigates with new component identity', async ({ page, writes }) => {
      await page.waitForFunction(() => document.querySelector('[data-testid="input-component-code"]')?.value === '603');
      await page.getByTestId('input-component-name').fill('New Job Fixture');
      await page.getByTestId('select-eqpt-system-dept').selectOption('Engine');
      await page.getByTestId('button-add-job').click();
      await page.waitForURL('**/pms/work-order/new/**');
      assert.equal(writes.length, 1);
      assert.equal(writes[0].method, 'POST');
      assert.equal(new URL(page.url()).searchParams.get('componentCuuid'), 'created');
      assert.equal(new URL(page.url()).searchParams.get('componentName'), 'New Job Fixture');
      assert.equal(await page.evaluate(() => window.events.backs), 0);
    }, { add: true });
  }
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
  await fs.writeFile(path.join(out, baseline ? 'baseline.json' : 'results.json'), JSON.stringify(results, null, 2));
}
if (results.some(r => r.status === 'failed')) process.exitCode = 1;
