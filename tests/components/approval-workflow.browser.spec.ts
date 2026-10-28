import { test, expect, type Page, type Route } from '@playwright/test';

const roles = ['Master', 'Superintendent', 'Manager'].map((roleLabel, i) => ({ roleId: `role-${i}`, roleLabel }));
const initialNodes = [{
  key: 'step-1', type: 'approval-step', label: 'Step 1', ordinal: 0,
  quorum: { rule: 'any' }, slots: roles.slice(0, 2),
}, { key: 'end', type: 'end', label: 'End', ordinal: 1 }];
const summary = (classification: string, version = 1) => ({
  wfuuid: `${classification}-${version}`, classification, version, status: 'active',
  label: 'Workflow', createdAt: '2026-10-28T10:00:00Z',
});

/** Mount the real shared editor through Vite, without host auth or operational writes.
 * All workflow and configured-approver requests are intercepted.
 */
async function fixture(page: Page, readOnly = false) {
  page.on('pageerror', (error) => console.error('Workflow browser error:', error.message));
  page.on('console', (message) => { if (message.type() === 'error') console.error('Workflow console:', message.text()); });
  const state = {
    workflows: [summary('normal')], nodes: initialNodes, writes: [] as any[],
    details: { 'normal-1': initialNodes } as Record<string, any[]>,
    detailRequests: 0, listRequests: 0,
    failSave: false, saveGate: null as Promise<void> | null,
    listGate: null as Promise<void> | null, detailGate: null as Promise<void> | null,
    roleGate: null as Promise<void> | null,
  };
  // Hot reload is irrelevant to this isolated fixture, and proxied WebSockets can
  // be blocked by a headless browser's local-network policy.
  await page.route('**/@vite/client', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: 'export const createHotContext = () => ({ accept() {}, dispose() {}, on() {}, invalidate() {} }); export const injectQuery = (url) => url;',
  }));
  await page.route('**/technical/api/approval-engine/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.split('/approval-engine')[1];
    if (path === '/registry') return route.fulfill({ json: { modules: ['pms', 'defects'].map((moduleId) => ({
      moduleId, label: moduleId, scopes: ['action-a', 'action-b'].map((screenId) => ({
        screenId, actionId: '', label: screenId,
        classifications: [{ id: 'normal', label: 'Normal' }, { id: 'critical', label: 'Critical' }],
      })),
    })) } });
    if (path === '/roles') {
      await state.roleGate;
      return route.fulfill({ json: roles });
    }
    if (path === '/scopes/enabled') return route.fulfill({ json: { enabled: true } });
    if (req.method() === 'POST') {
      const body = req.postDataJSON();
      state.writes.push(body);
      await state.saveGate;
      if (state.failSave) return route.fulfill({ status: 503, json: { error: 'Save unavailable. Please retry.' } });
      const saved = summary(body.classification, state.workflows.length + 1);
      state.nodes = body.nodes;
      state.details[saved.wfuuid] = body.nodes;
      state.workflows = [...state.workflows.map((v) => v.classification === saved.classification ? { ...v, status: 'superseded' } : v), saved];
      return route.fulfill({ json: { ...saved, nodes: body.nodes, edges: body.edges } });
    }
    if (path === '/workflows') {
      state.listRequests++;
      const snapshot = [...state.workflows];
      await state.listGate;
      return route.fulfill({ json: snapshot });
    }
    if (path.startsWith('/workflows/')) {
      state.detailRequests++;
      const snapshot = state.details[path.split('/').pop()!];
      await state.detailGate;
      return route.fulfill({ json: { nodes: snapshot } });
    }
    return route.fulfill({ status: 404, json: { error: `Unexpected fixture request ${path}` } });
  });
  await page.route('**/technical/api/approvals/role-approvers?*', (route) => route.fulfill({ json: {
    names: ['Assigned user', 'Unassigned user'], vesselScoped: true,
    users: [
      { id: 'assigned', name: 'Assigned user', vessels: ['Other vessel'] },
      { id: 'unassigned', name: 'Unassigned user', vessels: [] },
    ],
  } }));
  await page.route('**/__workflow-test', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@fs${process.cwd()}/node_modules/.vite/deps/react.js')).default;
      const { createRoot } = (await import('/@fs${process.cwd()}/node_modules/.vite/deps/react-dom_client.js')).default;
      const { default: Editor } = await import('/@fs${process.cwd()}/server/modules/approval-engine/client/ApprovalEngineAdmin.tsx');
      const root = createRoot(document.getElementById('root'));
      window.renderWorkflow = (moduleId = 'pms', screenId = 'action-a', readOnly = ${readOnly}) =>
        root.render(React.createElement(Editor, {
          basePath: '/technical/api/approval-engine', scope: { moduleId, screenId, actionId: '' }, readOnly
        }));
      window.renderWorkflow();
    </script>`,
  }));
  await page.goto('/__workflow-test');
  await page.getByRole('button', { name: 'Normal', exact: true }).click();
  await expect(page.getByTestId('saved-workflow-step-1')).toBeVisible();
  return state;
}
const add = (page: Page) => page.getByRole('button', { name: '+ Add step', exact: true });
const save = (page: Page) => page.getByRole('button', { name: '✓ Save workflow', exact: true });
const deferred = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
};

test('saved chain is read-only; Add Step copies once, edits existing roles, and save returns to view', async ({ page }) => {
  const state = await fixture(page);
  await expect(page.locator('select')).toHaveCount(0);
  await expect(save(page)).toHaveCount(0);
  await expect(page.getByTestId('saved-workflow-step-1')).toContainText('OR — any one approves');
  await expect(page.getByTestId('configured-approvers-view')).toContainText('Assigned user');
  await expect(page.getByTestId('configured-approvers-view')).not.toContainText('Unassigned user');
  await add(page).click();
  await add(page).click();
  await expect(page.locator('select')).toHaveCount(3);
  await page.getByRole('button', { name: 'Remove Master from step 1', exact: true }).click();
  await page.getByLabel('Step 1 approver', { exact: true }).selectOption('role-2');
  await page.getByRole('button', { name: 'AND', exact: true }).click();
  await page.getByLabel('Step 2 approver', { exact: true }).selectOption('role-0');
  await save(page).click();
  await expect(page.getByText('Saved as version 2 (active).', { exact: true })).toBeVisible();
  await expect(save(page)).toHaveCount(0);
  await expect(page.locator('select')).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].nodes.filter((n: any) => n.type === 'approval-step')).toHaveLength(2);
  expect(state.writes[0].nodes[0].quorum.rule).toBe('all');
  expect(state.writes[0].nodes[0].slots.map((s: any) => s.roleId)).toEqual(['role-1', 'role-2']);
  await expect(page.getByTestId('workflow-version-2')).toContainText('active');
  await add(page).click();
  await expect(page.locator('select')).toHaveCount(3);
  await page.reload();
  await page.getByRole('button', { name: 'Normal', exact: true }).click();
  await expect(page.getByTestId('saved-workflow-step-2')).toBeVisible();
  await expect(page.locator('select')).toHaveCount(0);
});

test('failed save preserves the entire draft and blocks repeated saves while pending', async ({ page }) => {
  const state = await fixture(page);
  await add(page).click();
  await page.getByLabel('Step 2 approver', { exact: true }).selectOption('role-2');
  const gate = deferred();
  state.failSave = true; state.saveGate = gate.promise;
  await save(page).click();
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
  await expect(add(page)).toBeDisabled();
  await expect(page.locator('select').first()).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  gate.release();
  await expect(page.getByRole('alert')).toContainText('Save unavailable. Please retry.');
  await expect(page.locator('select')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Remove Manager from step 2', exact: true })).toBeVisible();
  state.failSave = false; state.saveGate = null;
  await save(page).click();
  await expect(page.locator('select')).toHaveCount(0);
});

test('unconfigured classification starts empty and switching classifications discards drafts', async ({ page }) => {
  await fixture(page);
  await add(page).click();
  await page.getByRole('button', { name: 'Critical', exact: true }).click();
  await expect(page.getByText('No workflow saved for this classification.')).toBeVisible();
  await expect(page.locator('select')).toHaveCount(0);
  await add(page).click(); await add(page).click();
  await expect(page.locator('select')).toHaveCount(2);
  await page.getByLabel('Step 1 approver', { exact: true }).selectOption('role-2');
  await save(page).click();
  await expect(page.getByTestId('saved-workflow-step-1')).toContainText('Manager');
  await page.getByRole('button', { name: 'Normal', exact: true }).click();
  await expect(page.locator('select')).toHaveCount(0);
  await expect(save(page)).toHaveCount(0);
  await expect(page.getByTestId('saved-workflow-step-1')).toContainText('Master');
  await expect(page.getByTestId('saved-workflow-step-1')).not.toContainText('Manager');
});

test('delayed save and version refresh cannot replace or close another selection draft', async ({ page }) => {
  const state = await fixture(page);
  await add(page).click();
  const gate = deferred();
  state.saveGate = gate.promise;
  await save(page).click();
  await page.getByRole('button', { name: 'Critical', exact: true }).click();
  await expect(page.getByText('No workflow saved for this classification.')).toBeVisible();
  await add(page).click();
  await page.getByLabel('Step 1 approver', { exact: true }).selectOption('role-2');
  gate.release();
  await expect.poll(() => state.workflows.length).toBe(2);
  await expect(save(page)).toBeVisible();
  await expect(page.locator('select')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Remove Manager from step 1', exact: true })).toBeVisible();
  await expect(page.getByText('Saved as version 2 (active).', { exact: true })).toHaveCount(0);
});

test('detail and list refresh do not reopen or overwrite a new draft after saving', async ({ page }) => {
  const state = await fixture(page);
  await add(page).click();
  await page.getByLabel('Step 2 approver', { exact: true }).selectOption('role-2');
  const gate = deferred();
  state.listGate = gate.promise; state.detailGate = gate.promise;
  await save(page).click();
  await expect(page.locator('select')).toHaveCount(0);
  await expect(page.getByTestId('saved-workflow-step-2')).toContainText('Manager');
  // The submitted saved chain remains visible even while refreshed details are pending.
  await expect(add(page)).toBeEnabled();
  await add(page).click();
  await page.getByRole('button', { name: 'Remove Master from step 1', exact: true }).click();
  gate.release();
  await expect.poll(() => state.detailRequests).toBeGreaterThan(1);
  await expect(page.locator('select')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Remove Master from step 1', exact: true })).toHaveCount(0);
});

test('delayed details from a previous classification cannot populate the current blank draft', async ({ page }) => {
  const state = await fixture(page);
  await page.getByRole('button', { name: 'Critical', exact: true }).click();
  await expect(page.getByText('No workflow saved for this classification.')).toBeVisible();
  const gate = deferred();
  state.detailGate = gate.promise;
  const count = state.detailRequests;
  await page.getByRole('button', { name: 'Normal', exact: true }).click();
  await expect.poll(() => state.detailRequests).toBeGreaterThan(count);
  await page.getByRole('button', { name: 'Critical', exact: true }).click();
  await expect(add(page)).toBeEnabled();
  await add(page).click();
  await page.getByLabel('Step 1 approver', { exact: true }).selectOption('role-2');
  gate.release();
  await expect(page.locator('select')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Remove Manager from step 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Master from step 1', exact: true })).toHaveCount(0);
});

test('PMS and Defects share view-only protections and action changes start in view mode', async ({ page }) => {
  await fixture(page, true);
  await expect(add(page)).toHaveCount(0);
  await expect(save(page)).toHaveCount(0);
  await expect(page.locator('select')).toHaveCount(0);
  await page.evaluate(() => (window as any).renderWorkflow('defects', 'action-a', false));
  await page.getByRole('button', { name: 'Normal', exact: true }).click();
  await expect(add(page)).toBeEnabled();
  await add(page).click();
  await expect(page.locator('select')).toHaveCount(2);
  await page.evaluate(() => (window as any).renderWorkflow('defects', 'action-b', false));
  await page.getByRole('button', { name: 'Normal', exact: true }).click();
  await expect(page.getByTestId('saved-workflow-step-1')).toBeVisible();
  await expect(page.locator('select')).toHaveCount(0);
  await page.evaluate(() => (window as any).renderWorkflow('defects', 'action-b', true));
  await expect(add(page)).toHaveCount(0);
});
