import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { TEST_USERS } from '../fixtures/users';

test.describe('Smoke Tests - Environment and Basic Setup', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let screenshotHelper: ScreenshotHelper;

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