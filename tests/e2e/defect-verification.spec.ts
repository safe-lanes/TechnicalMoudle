/**
 * Defect Verification Permission Tests
 *
 * Verifies that canVerify and canAutoFill correctly gate defect verification
 * for each role:
 *   Allowed  — Office, PMS Admin, Sail Admin, Client Admin, Superintendent
 *   Blocked  — Ship (and any other unlisted role)
 *
 * Strategy
 * --------
 * • page.addInitScript() injects a localStorage user profile BEFORE the React
 *   app hydrates, so AuthContext picks up the injected role without a real
 *   login flow.
 * • page.route() intercepts /technical/api/defects* so the test is fully
 *   deterministic and does not depend on database state.
 * • Other API calls (vessels, fleets, etc.) are short-circuited to empty
 *   arrays so the page renders without errors.
 *
 * Code changes bundled with these tests
 * --------------------------------------
 * DefectFormWizard.tsx now derives `canVerify` (same allowed-roles list as
 * DefectsLogWithTabs.tsx) and passes it to the verified checkbox:
 *   disabled={isViewMode || !canVerify}
 * This ensures the checkbox is disabled for Ship, not just auto-fill skipped.
 */

import { test, expect, Page } from '@playwright/test';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['Office', 'PMS Admin', 'Sail Admin', 'Client Admin', 'Superintendent'] as const;

const MOCK_DEFECT_ID = 'DEF-E2E-001';

const MOCK_DEFECT = {
  id: MOCK_DEFECT_ID,
  defectId: MOCK_DEFECT_ID,
  title: 'E2E Test Defect',
  description: 'Verification permission test defect',
  status: 'Open',
  category: 'Mechanical',
  priority: 'Medium',
  verified: false,
  dateVerified: null,
  verifiedByName: null,
  verifiedByOfficePosition: null,
  vesselId: 'V001',
  vessel: 'Test Vessel',
  is_coc: false,
  closedDate: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  actions: [],
  actionTakenRequested: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Inject user profile into localStorage BEFORE the app hydrates.
 * Must be called BEFORE page.goto().
 */
async function setUserRole(
  page: Page,
  role: string,
  fullName = `Test ${role} User`,
  crewDesignation = role === 'Ship' ? 'Chief Engineer' : 'Fleet Manager',
) {
  await page.addInitScript(
    ({ role, fullName, crewDesignation }) => {
      const userProfile = {
        id: 9999,
        username: 'e2e_test_user',
        fullName,
        email: 'e2e@test.example.com',
        role,
        vesselId: 'V001',
        crewDesignation,
        department: null,
        userId: 'e2e-uuid-0000',
      };
      localStorage.setItem('userProfile', JSON.stringify(userProfile));
      localStorage.setItem('userType', role === 'Ship' ? 'Ship' : 'Office');
    },
    { role, fullName, crewDesignation },
  );
}

/**
 * Intercept the defects API so tests are fully deterministic.
 * Also short-circuits unrelated API calls that would otherwise fail.
 */
async function interceptAPIs(page: Page, defects = [MOCK_DEFECT]) {
  await page.route('/technical/api/defects*', async (route) => {
    const url = route.request().url();
    const isSingleFetch =
      url.includes(`/defects/${MOCK_DEFECT_ID}`) ||
      (!url.includes('?') && url.endsWith(MOCK_DEFECT_ID));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isSingleFetch ? MOCK_DEFECT : defects),
    });
  });

  await page.route('/technical/api/vessels*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('/api/vessels*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('/technical/api/fleets*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('/technical/api/defect-categories*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('/technical/api/defect-types*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('/technical/api/pms-vessel-settings*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ vesselId: 'V001' }) });
  });
}

// ─── Suite 1: Active Defect List — Verify Button State ───────────────────────

test.describe('Defect Verification — Active List Verify Button', () => {
  /**
   * Each allowed role must see an enabled verify button in the defects grid.
   */
  for (const role of ALLOWED_ROLES) {
    test(`${role}: verify button is ENABLED in defect list`, async ({ page }) => {
      await setUserRole(page, role, `${role} Tester`);
      await interceptAPIs(page);

      await page.goto('/defects/active', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const verifyBtn = page.locator(`[data-testid="button-verified-${MOCK_DEFECT_ID}"]`).first();
      await expect(verifyBtn).toBeVisible({ timeout: 10000 });
      await expect(verifyBtn).not.toBeDisabled();

      // Tooltip must not show the no-permission message
      await verifyBtn.hover();
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).not.toContainText('No Permission', { timeout: 3000 });
    });
  }

  /**
   * Ship role must see a disabled verify button (disabled attribute present).
   * Tooltip must say "No Permission".
   */
  test('Ship: verify button is DISABLED in defect list', async ({ page }) => {
    await setUserRole(page, 'Ship', 'Ship Tester', 'Chief Engineer');
    await interceptAPIs(page);

    await page.goto('/defects/active', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const verifyBtn = page.locator(`[data-testid="button-verified-${MOCK_DEFECT_ID}"]`).first();
    await expect(verifyBtn).toBeVisible({ timeout: 10000 });
    await expect(verifyBtn).toBeDisabled();

    await verifyBtn.hover();
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toContainText('No Permission', { timeout: 3000 });
  });
});

// ─── Suite 2: Form Wizard — Verified Checkbox State & Auto-fill ──────────────

test.describe('Defect Verification — Form Wizard Checkbox & Auto-fill', () => {
  /**
   * Helper that navigates to the edit form and advances to the Part C tab
   * where the verified checkbox lives.
   */
  async function openPartCTab(page: Page, defectId: string) {
    await page.goto(`/defects/edit/${defectId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Part C tab may be labelled "Part C", "C", or use a data-testid
    const partCTab = page
      .locator('[data-testid="tab-partC"], [data-testid="tab-close"], button:has-text("Part C")')
      .first();
    if (await partCTab.count() > 0) {
      await partCTab.click();
      await page.waitForTimeout(500);
    }
  }

  /**
   * Ship role: verified checkbox must be DISABLED in edit mode.
   * This is the primary "checkbox blocked" acceptance criterion.
   */
  test('Ship: verified checkbox is DISABLED (cannot be clicked)', async ({ page }) => {
    await setUserRole(page, 'Ship', 'Ship Tester', 'Chief Engineer');
    await interceptAPIs(page);

    await openPartCTab(page, MOCK_DEFECT_ID);

    const checkbox = page.locator('[data-testid="checkbox-verified"]');
    await expect(checkbox).toBeVisible({ timeout: 10000 });
    await expect(checkbox).toBeDisabled();
  });

  /**
   * Client Admin: verified checkbox must be ENABLED; checking it auto-fills
   * dateVerified, verifiedByName, and verifiedByOfficePosition.
   */
  test('Client Admin: verified checkbox enabled + auto-fill fires', async ({ page }) => {
    const fullName = 'Alice Client Admin';
    const designation = 'Client Representative';

    await setUserRole(page, 'Client Admin', fullName, designation);
    await interceptAPIs(page);

    await openPartCTab(page, MOCK_DEFECT_ID);

    const checkbox = page.locator('[data-testid="checkbox-verified"]');
    await expect(checkbox).toBeVisible({ timeout: 10000 });
    await expect(checkbox).not.toBeDisabled();

    await checkbox.click();
    await page.waitForTimeout(500);

    const today = new Date().toISOString().split('T')[0];
    await expect(page.locator('[data-testid="input-date-verified"]')).toHaveValue(today);
    await expect(page.locator('[data-testid="input-verified-by-name"]')).toHaveValue(fullName);
    await expect(page.locator('[data-testid="input-verified-by-office-position"]')).toHaveValue(designation);
  });

  /**
   * Superintendent: verified checkbox enabled + auto-fill fires.
   */
  test('Superintendent: verified checkbox enabled + auto-fill fires', async ({ page }) => {
    const fullName = 'Bob Superintendent';
    const designation = 'Marine Superintendent';

    await setUserRole(page, 'Superintendent', fullName, designation);
    await interceptAPIs(page);

    await openPartCTab(page, MOCK_DEFECT_ID);

    const checkbox = page.locator('[data-testid="checkbox-verified"]');
    await expect(checkbox).toBeVisible({ timeout: 10000 });
    await expect(checkbox).not.toBeDisabled();

    await checkbox.click();
    await page.waitForTimeout(500);

    const today = new Date().toISOString().split('T')[0];
    await expect(page.locator('[data-testid="input-date-verified"]')).toHaveValue(today);
    await expect(page.locator('[data-testid="input-verified-by-name"]')).toHaveValue(fullName);
    await expect(page.locator('[data-testid="input-verified-by-office-position"]')).toHaveValue(designation);
  });

  /**
   * Office regression guard: checkbox enabled + auto-fill fires (existing role).
   */
  test('Office: verified checkbox enabled + auto-fill fires (regression guard)', async ({ page }) => {
    const fullName = 'Diana Office Manager';
    const designation = 'Operations Manager';

    await setUserRole(page, 'Office', fullName, designation);
    await interceptAPIs(page);

    await openPartCTab(page, MOCK_DEFECT_ID);

    const checkbox = page.locator('[data-testid="checkbox-verified"]');
    await expect(checkbox).toBeVisible({ timeout: 10000 });
    await expect(checkbox).not.toBeDisabled();

    await checkbox.click();
    await page.waitForTimeout(500);

    const today = new Date().toISOString().split('T')[0];
    await expect(page.locator('[data-testid="input-date-verified"]')).toHaveValue(today);
    await expect(page.locator('[data-testid="input-verified-by-name"]')).toHaveValue(fullName);
  });

  /**
   * PMS Admin regression guard: checkbox enabled + auto-fill fires.
   */
  test('PMS Admin: verified checkbox enabled + auto-fill fires (regression guard)', async ({ page }) => {
    const fullName = 'Eve PMS Admin';
    const designation = 'PMS Administrator';

    await setUserRole(page, 'PMS Admin', fullName, designation);
    await interceptAPIs(page);

    await openPartCTab(page, MOCK_DEFECT_ID);

    const checkbox = page.locator('[data-testid="checkbox-verified"]');
    await expect(checkbox).toBeVisible({ timeout: 10000 });
    await expect(checkbox).not.toBeDisabled();

    await checkbox.click();
    await page.waitForTimeout(500);

    const today = new Date().toISOString().split('T')[0];
    await expect(page.locator('[data-testid="input-date-verified"]')).toHaveValue(today);
    await expect(page.locator('[data-testid="input-verified-by-name"]')).toHaveValue(fullName);
  });
});

// ─── Suite 3: End-to-end Verify Action (Happy Path) ──────────────────────────

test.describe('Defect Verification — End-to-end Verify Action', () => {
  /**
   * Office role can click the verify button in the active defect list and
   * the PATCH request is made (i.e., verification state changes).
   * This confirms the action flows through, not just that the button is enabled.
   */
  test('Office: clicking verify button fires PATCH request with verified=true', async ({ page }) => {
    await setUserRole(page, 'Office', 'Diana Office Manager', 'Operations Manager');

    let patchBody: Record<string, unknown> | null = null;

    // Intercept defects list
    await page.route('/technical/api/defects*', async (route) => {
      const req = route.request();
      const url = req.url();

      if (req.method() === 'PATCH') {
        const body = req.postDataJSON() as Record<string, unknown>;
        patchBody = body;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...MOCK_DEFECT, ...body }) });
        return;
      }

      const isSingle = url.includes(`/defects/${MOCK_DEFECT_ID}`) && !url.includes('?');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isSingle ? MOCK_DEFECT : [MOCK_DEFECT]),
      });
    });

    await page.route('/technical/api/vessels*', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('/api/vessels*', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('/technical/api/fleets*', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('/technical/api/defect-categories*', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('/technical/api/defect-types*', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('/technical/api/pms-vessel-settings*', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ vesselId: 'V001' }) }));

    await page.goto('/defects/active', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const verifyBtn = page.locator(`[data-testid="button-verified-${MOCK_DEFECT_ID}"]`).first();
    await expect(verifyBtn).toBeVisible({ timeout: 10000 });
    await expect(verifyBtn).not.toBeDisabled();

    await verifyBtn.click();
    await page.waitForTimeout(1000);

    // The PATCH must have been called with verified: true
    expect(patchBody).not.toBeNull();
    expect(patchBody?.verified).toBe(true);
  });

  /**
   * Ship role: clicking the disabled verify button must NOT fire a PATCH
   * request. This confirms the UI block prevents the API call entirely.
   */
  test('Ship: clicking disabled verify button does NOT fire PATCH request', async ({ page }) => {
    await setUserRole(page, 'Ship', 'Ship Tester', 'Chief Engineer');

    let patchFired = false;

    await page.route('/technical/api/defects*', async (route) => {
      if (route.request().method() === 'PATCH') {
        patchFired = true;
        await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Forbidden' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_DEFECT]) });
    });

    await page.route('/technical/api/vessels*', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('/api/vessels*', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('/technical/api/fleets*', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('/technical/api/defect-categories*', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('/technical/api/defect-types*', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('/technical/api/pms-vessel-settings*', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ vesselId: 'V001' }) }));

    await page.goto('/defects/active', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const verifyBtn = page.locator(`[data-testid="button-verified-${MOCK_DEFECT_ID}"]`).first();
    await expect(verifyBtn).toBeVisible({ timeout: 10000 });
    await expect(verifyBtn).toBeDisabled();

    // Force-click to attempt bypass; the handler should still guard
    await verifyBtn.click({ force: true });
    await page.waitForTimeout(1000);

    expect(patchFired).toBe(false);
  });
});
