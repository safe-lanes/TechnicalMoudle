import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { TEST_USERS } from '../fixtures/users';
import { nanoid } from 'nanoid';

test.describe('Smoke Tests - Environment and Basic Setup', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let screenshotHelper: ScreenshotHelper;
  const testRunId = nanoid(6);

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);
    screenshotHelper = new ScreenshotHelper(page);
  });

  test('Application loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PMS/);
    await screenshotHelper.captureHappyPath('smoke', 'app_loads');
  });

  test('Login page is accessible', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('[data-testid="input-username"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-login"]')).toBeVisible();
    await screenshotHelper.captureHappyPath('smoke', 'login_page');
  });

  test('Can login with valid credentials', async ({ page }) => {
    await authHelper.loginAs('chiefEngineer');
    await expect(page).toHaveURL(/dashboard/);
    await screenshotHelper.captureHappyPath('smoke', 'logged_in');
  });

  test('Main navigation menu is visible after login', async ({ page }) => {
    await authHelper.loginAs('chiefEngineer');
    
    // Check main navigation items
    await expect(page.locator('[data-testid="nav-pms"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-spares"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-stores"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-modify-pms"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('smoke', 'navigation_menu');
  });

  test('Can navigate to all main modules', async ({ page }) => {
    await authHelper.loginAs('chiefEngineer');
    
    // Navigate to PMS
    await navHelper.navigateToPMS();
    await expect(page).toHaveURL(/pms/);
    
    // Navigate to Spares
    await navHelper.navigateToSpares();
    await expect(page).toHaveURL(/spares/);
    
    // Navigate to Stores
    await navHelper.navigateToStores();
    await expect(page).toHaveURL(/stores/);
    
    // Navigate to Modify PMS
    await navHelper.navigateToModifyPMS();
    await expect(page).toHaveURL(/modify-pms/);
    
    await screenshotHelper.captureHappyPath('smoke', 'all_modules');
  });

  test('Can logout successfully', async ({ page }) => {
    await authHelper.loginAs('chiefEngineer');
    await authHelper.logout();
    
    await expect(page).toHaveURL(/login/);
    await expect(page.locator('[data-testid="input-username"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('smoke', 'logged_out');
  });

  test('Database connection is working', async ({ page }) => {
    await authHelper.loginAs('chiefEngineer');
    await navHelper.navigateToWorkOrders();
    
    // Check that work orders are loaded (even if empty)
    await page.waitForLoadState('networkidle');
    const tableExists = await page.locator('[data-testid="table-main"], [data-testid="table-empty-state"]').isVisible();
    expect(tableExists).toBeTruthy();
    
    await screenshotHelper.captureHappyPath('smoke', 'database_connected');
  });

  test('API endpoints are responding', async ({ page, request }) => {
    // Test a few key API endpoints
    const response = await request.get('/api/components/V001');
    expect(response.status()).toBe(200);
    
    const workOrdersResponse = await request.get('/api/work-orders');
    expect(workOrdersResponse.status()).toBe(200);
    
    const sparesResponse = await request.get('/api/spares/V001');
    expect(sparesResponse.status()).toBe(200);
  });

  test('Error handling for invalid login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="input-username"]', 'invalid_user');
    await page.fill('[data-testid="input-password"]', 'wrong_password');
    await page.click('[data-testid="button-login"]');
    
    // Should show error message and stay on login page
    await expect(page.locator('[data-testid="toast-error"], [data-testid="error-message"]')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/login/);
    
    await screenshotHelper.captureError('invalid_login');
  });

  test('Responsive design works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authHelper.loginAs('chiefEngineer');
    
    // Check that mobile menu exists
    const mobileMenu = page.locator('[data-testid="mobile-menu-toggle"], [data-testid="nav-pms"]');
    await expect(mobileMenu).toBeVisible();
    
    await screenshotHelper.captureHappyPath('smoke', 'mobile_view');
  });
});

test.describe('Smoke Tests - Module Navigation and Functionality', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let screenshotHelper: ScreenshotHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);
    screenshotHelper = new ScreenshotHelper(page);
    await authHelper.loginAs('chiefEngineer');
  });

  test('Navigate to Components module and verify structure', async ({ page }) => {
    await navHelper.navigateToComponents();
    await page.waitForLoadState('networkidle');
    
    // Check for components tree or table
    const componentSection = page.locator('[data-testid="components-tree"], [data-testid="components-table"], [data-testid="table-main"]').first();
    await expect(componentSection).toBeVisible({ timeout: 10000 });
    
    await screenshotHelper.captureHappyPath('modules', 'components_view');
  });

  test('Navigate to Work Orders module and verify structure', async ({ page }) => {
    await navHelper.navigateToWorkOrders();
    await page.waitForLoadState('networkidle');
    
    // Check for work orders table or empty state
    const workOrdersSection = page.locator('[data-testid="table-main"], [data-testid="table-empty-state"], [data-testid="work-orders-table"]').first();
    await expect(workOrdersSection).toBeVisible({ timeout: 10000 });
    
    await screenshotHelper.captureHappyPath('modules', 'work_orders_view');
  });

  test('Navigate to Running Hours module and verify structure', async ({ page }) => {
    await navHelper.navigateToRunningHours();
    await page.waitForLoadState('networkidle');
    
    // Check for running hours interface
    const runningHoursSection = page.locator('[data-testid="running-hours-table"], [data-testid="table-main"], [data-testid="running-hours-form"]').first();
    await expect(runningHoursSection).toBeVisible({ timeout: 10000 });
    
    await screenshotHelper.captureHappyPath('modules', 'running_hours_view');
  });

  test('Navigate to Spares module and verify structure', async ({ page }) => {
    await navHelper.navigateToSpares();
    await page.waitForLoadState('networkidle');
    
    // Check for spares inventory table
    const sparesSection = page.locator('[data-testid="spares-table"], [data-testid="table-main"], [data-testid="spares-inventory"]').first();
    await expect(sparesSection).toBeVisible({ timeout: 10000 });
    
    await screenshotHelper.captureHappyPath('modules', 'spares_view');
  });

  test('Navigate to Stores module and verify structure', async ({ page }) => {
    await navHelper.navigateToStores();
    await page.waitForLoadState('networkidle');
    
    // Check for stores table
    const storesSection = page.locator('[data-testid="stores-table"], [data-testid="table-main"], [data-testid="stores-inventory"]').first();
    await expect(storesSection).toBeVisible({ timeout: 10000 });
    
    await screenshotHelper.captureHappyPath('modules', 'stores_view');
  });
});

test.describe('Smoke Tests - API Health Checks', () => {
  test('Verify all critical API endpoints are responsive', async ({ request }) => {
    const endpoints = [
      { path: '/api/components/V001', name: 'Components' },
      { path: '/api/work-orders', name: 'Work Orders' },
      { path: '/api/work-orders/V001', name: 'Work Orders by Vessel' },
      { path: '/api/spares/V001', name: 'Spares' },
      { path: '/api/stores/V001', name: 'Stores' },
      { path: '/api/running-hours/V001', name: 'Running Hours' },
      { path: '/api/change-requests/V001', name: 'Change Requests' },
    ];

    const testResults = [];
    
    for (const endpoint of endpoints) {
      try {
        const response = await request.get(endpoint.path);
        const status = response.status();
        testResults.push({
          endpoint: endpoint.name,
          path: endpoint.path,
          status,
          success: status === 200 || status === 201 || status === 204,
        });
        
        // Verify response is JSON
        if (status === 200) {
          const contentType = response.headers()['content-type'];
          expect(contentType).toContain('application/json');
        }
      } catch (error) {
        testResults.push({
          endpoint: endpoint.name,
          path: endpoint.path,
          status: 'ERROR',
          success: false,
          error: error.message,
        });
      }
    }

    // Log results for debugging
    console.log('API Health Check Results:', JSON.stringify(testResults, null, 2));
    
    // Verify all endpoints are successful
    const failedEndpoints = testResults.filter(r => !r.success);
    if (failedEndpoints.length > 0) {
      console.error('Failed endpoints:', failedEndpoints);
    }
    
    expect(failedEndpoints.length).toBe(0);
  });

  test('Database connectivity via API', async ({ request }) => {
    // Test database connectivity by fetching data
    const response = await request.get('/api/components/V001');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toBeDefined();
    
    // Check if response has expected structure (even if empty)
    expect(Array.isArray(data) || (data && typeof data === 'object')).toBeTruthy();
  });

  test('Authentication endpoints are working', async ({ request, page }) => {
    // Test login endpoint
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        username: TEST_USERS.chiefEngineer.username,
        password: TEST_USERS.chiefEngineer.password,
      },
    });
    
    // Login might return 200, 201, or 302 (redirect)
    expect([200, 201, 302]).toContain(loginResponse.status());
    
    // Test logout endpoint
    await page.goto('/');
    const authHelper = new AuthHelper(page);
    await authHelper.loginAs('chiefEngineer');
    
    const logoutResponse = await request.post('/api/auth/logout');
    expect([200, 201, 302]).toContain(logoutResponse.status());
  });
});

test.describe('Smoke Tests - Error Scenarios', () => {
  let screenshotHelper: ScreenshotHelper;

  test.beforeEach(async ({ page }) => {
    screenshotHelper = new ScreenshotHelper(page);
  });

  test('404 page handling', async ({ page }) => {
    await page.goto('/non-existent-page-' + nanoid(8));
    
    // Check if we get redirected to login or see a 404 page
    const isLoginPage = await page.locator('[data-testid="input-username"]').isVisible().catch(() => false);
    const is404Page = await page.locator('text=/404|not found/i').isVisible().catch(() => false);
    
    expect(isLoginPage || is404Page).toBeTruthy();
    
    await screenshotHelper.captureError('404_page');
  });

  test('API error handling', async ({ request }) => {
    // Test with invalid vessel ID
    const response = await request.get('/api/components/INVALID_VESSEL_ID');
    
    // Should return 404 or 400 for invalid vessel
    expect([400, 404]).toContain(response.status());
  });

  test('Form validation errors', async ({ page }) => {
    await page.goto('/login');
    
    // Try to submit empty form
    await page.click('[data-testid="button-login"]');
    
    // Should show validation errors
    const hasError = await page.locator('[data-testid="error-message"], [data-testid="field-error"], .text-destructive').isVisible().catch(() => false);
    expect(hasError).toBeTruthy();
    
    await screenshotHelper.captureError('form_validation');
  });
});