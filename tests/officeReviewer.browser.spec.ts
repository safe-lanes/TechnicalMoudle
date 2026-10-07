import { test, expect } from '@playwright/test';

const roles = [
  { id: 1, ruid: 'A', assignedRole: 'Reviewer', roletype: 'Office', isActive: true, sortOrder: 1 },
  { id: 900, ruid: 'B', assignedRole: 'Reviewer', roletype: 'Vessel', isActive: true, sortOrder: 2 },
];

/** All API requests are intercepted; no test saves or reads operational records. */
async function fixtures(page: any, selected: string[] | null = [], catalog: 'ok' | 'empty' | 'error' = 'ok') {
  const writes: Array<{ path: string; data: any }> = [];
  const template = {
    jobNo: 'FIXTURE', jobTitle: 'Fixture inspection', assignedTo: 'Chief Engineer',
    approver: 'Master', level2ReviewerRankId: 'Office', officeReviewerRoleRuids: selected,
    maintenanceBasis: 'Calendar', frequencyValue: '1', frequencyUnit: 'Months',
    jobPriority: 'Medium', classRelated: 'No', criticality: 'No', isActive: 'Yes',
    department: 'Engine', componentCode: '000.TEST', componentName: 'Fixture component',
    requiredSpareParts: [], requiredTools: [], safetyRequirements: {},
  };
  const context = {
    job: { ...template, juuid: 'fixture', id: 'fixture', vesselId: 'fixture-vessel' },
    component: { cuuid: 'fixture-component', name: 'Fixture component', componentCode: '000.TEST' },
    templateData: template, documents: [], workHistory: [], requiredSpareParts: [],
    workOrder: { id: 'fixture-wo', wouuid: 'fixture-wo', status: 'Pending Office Review',
      workOrderNo: 'FIXTURE-WO', jobId: 'fixture', vesselId: 'fixture-vessel',
      assignedTo: 'Chief Engineer', jobTitle: 'Fixture inspection', department: 'Engine' },
    executionData: {},
  };
  await page.route('**/technical/api/**', async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!['GET', 'HEAD'].includes(request.method())) {
      const data = request.postDataJSON();
      writes.push({ path, data });
      if (path === '/technical/api/jobs/fixture') {
        Object.assign(template, data);
        if (data.officeReviewerRoleRuids) context.job.officeReviewerRoleRuids = data.officeReviewerRoleRuids;
      }
      return route.fulfill({ json: { ...context.job, id: 1, ...data } });
    }
    if (path.endsWith('/admin/roles')) {
      return route.fulfill(catalog === 'error'
        ? { status: 503, json: { message: 'Fixture role catalog error' } }
        : { json: catalog === 'empty' ? [] : roles });
    }
    if (path.endsWith('/context')) return route.fulfill({ json: context });
    if (path.endsWith('/admin/available-ranks')) return route.fulfill({ json: [
      { name: 'Chief Engineer' }, { name: 'Master' }, { name: 'Third Engineer' },
    ] });
    if (path.endsWith('/vessels')) return route.fulfill({ json: [{ vuuid: 'fixture-vessel', id: 'fixture-vessel', name: 'Fixture vessel' }] });
    if (path.includes('/sync/instance')) return route.fulfill({ json: { instanceType: 'shore', isShip: false, isShore: true } });
    return route.fulfill({ json: [] });
  });
  return writes;
}

test('Job read-only ignores Office legacy, multi-select edits save RUID arrays and cancel makes no write', async ({ page }) => {
  const writes = await fixtures(page);
  await page.goto('/pms/job/fixture');
  const selector = page.getByTestId('jobs-office-reviewer-select');
  await expect(selector).toContainText('Office Reviewer');
  await expect(selector).toContainText('None');
  await expect(page.getByText('Level 2 Reviewer (Rank)', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByTestId('jobs-office-reviewer-select-trigger').click();
  await page.getByTestId('office-reviewer-option-A').click();
  await page.getByTestId('office-reviewer-option-B').click();
  await page.keyboard.press('Escape');
  await expect(selector).toContainText('Reviewer · Office · A');
  await expect(selector).toContainText('Reviewer · Vessel · B');
  await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
  expect(writes).toEqual([]);
  await expect(selector).toContainText('None');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByTestId('jobs-office-reviewer-select-trigger').click();
  await page.getByTestId('office-reviewer-option-A').click();
  await page.getByTestId('office-reviewer-option-B').click();
  await page.keyboard.press('Escape');
  await page.getByTestId('button-save-job').click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].data.officeReviewerRoleRuids).toEqual(['A', 'B']);
  expect(writes[0].data).not.toHaveProperty('level2ReviewerRankId');
  await page.reload();
  await expect(selector).toContainText('Reviewer · Office · A');
  await expect(selector).toContainText('Reviewer · Vessel · B');
  await page.getByTestId('button-edit-job').click();
  await page.getByRole('button', { name: 'Remove Reviewer · Office · A', exact: true }).click();
  await page.getByTestId('button-save-job').click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].data.officeReviewerRoleRuids).toEqual(['B']);
  await page.reload();
  await page.getByTestId('button-edit-job').click();
  await page.getByRole('button', { name: 'Remove Reviewer · Vessel · B', exact: true }).click();
  await page.getByTestId('button-save-job').click();
  await expect.poll(() => writes.length).toBe(3);
  expect(writes[2].data.officeReviewerRoleRuids).toEqual([]);
});

test('empty catalog retains unavailable saved selections without writes on cancel', async ({ page }) => {
  const writes = await fixtures(page, ['unavailable'], 'empty');
  await page.goto('/pms/job/fixture');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByTestId('jobs-office-reviewer-select')).toContainText('unavailable');
  await page.getByTestId('jobs-office-reviewer-select-trigger').click();
  await expect(page.getByText('No active roles are available.')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
  expect(writes).toEqual([]);
});

test('Work Order shows configured roles read-only without configuration writes', async ({ page }) => {
  const writes = await fixtures(page, ['A', 'B']);
  await page.goto('/pms/work-order/fixture-wo');
  const selector = page.getByTestId('work-order-office-reviewer-select');
  await expect(selector).toContainText('Office Reviewer');
  await expect(selector).toContainText('Reviewer · Office · A');
  await expect(selector).toContainText('Reviewer · Vessel · B');
  await expect(page.getByTestId('work-order-office-reviewer-select-trigger')).toHaveCount(0);
  expect(writes).toEqual([]);
});

test('failed catalog is explicit and does not clear persisted IDs', async ({ page }) => {
  const writes = await fixtures(page, ['unavailable'], 'error');
  await page.goto('/pms/job/fixture');
  await page.getByTestId('button-edit-job').click();
  await page.getByTestId('jobs-office-reviewer-select-trigger').click();
  await expect(page.getByText('Roles could not be loaded. Your current selection is preserved.')).toBeVisible();
  await expect(page.getByTestId('jobs-office-reviewer-select')).toContainText('unavailable');
  await page.keyboard.press('Escape');
  await page.getByTestId('button-cancel-edit').click();
  expect(writes).toEqual([]);
});

test('Modify PMS submits typed old/new arrays and restoring original selection creates no spurious change', async ({ page }) => {
  const writes = await fixtures(page);
  await page.goto('/pms/job/fixture?modify=1');
  await page.getByTestId('jobs-office-reviewer-select-trigger').click();
  await page.getByTestId('office-reviewer-option-A').click();
  await page.getByTestId('office-reviewer-option-A').click();
  await page.keyboard.press('Escape');
  await page.getByTestId('button-save-for-approval').click();
  await expect(page.getByText('No changes detected', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  await page.getByTestId('jobs-office-reviewer-select-trigger').click();
  await page.getByTestId('office-reviewer-option-B').click();
  await page.getByTestId('office-reviewer-option-A').click();
  await page.keyboard.press('Escape');
  await page.getByTestId('button-save-for-approval').click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].path).toBe('/technical/api/change-requests');
  expect(writes[0].data.proposedChangesJson).toEqual([
    { field: 'officeReviewerRoleRuids', oldValue: [], newValue: ['A', 'B'] },
  ]);
});

test('empty new selection leaves already-pending office review controls accessible by status', async ({ page }) => {
  const writes = await fixtures(page, []);
  await page.goto('/pms/work-order/fixture-wo');
  await expect(page.getByTestId('nav-step-part-c').first()).toBeVisible();
  await page.getByTestId('nav-step-part-c').first().click();
  await expect(page.getByTestId('button-reviewer-approve')).toBeVisible();
  await expect(page.getByTestId('button-reviewer-reopen')).toBeVisible();
  expect(writes).toEqual([]);
});

test('loading catalog is distinct and does not replace existing saved selections', async ({ page }) => {
  const writes = await fixtures(page, ['A']);
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/technical/api/admin/roles', async route => {
    await wait;
    await route.fulfill({ json: roles });
  });
  await page.goto('/pms/job/fixture');
  await page.getByTestId('button-edit-job').click();
  await page.getByTestId('jobs-office-reviewer-select-trigger').click();
  await expect(page.getByText('Loading roles…', { exact: true })).toBeVisible();
  await expect(page.getByTestId('jobs-office-reviewer-select')).toContainText('A');
  expect(writes).toEqual([]);
  release();
  await expect(page.getByTestId('office-reviewer-option-A')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('jobs-office-reviewer-select')).toContainText('Reviewer · Office · A');
  expect(writes).toEqual([]);
});
