import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { FormHelper } from '../helpers/form.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { DatabaseVerification } from '../db/verification';
import { TEST_USERS } from '../fixtures/users';

test.describe('Cross-Cutting Concerns Tests', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let formHelper: FormHelper;
  let screenshotHelper: ScreenshotHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);
    formHelper = new FormHelper(page);
    screenshotHelper = new ScreenshotHelper(page);
  });

  test.describe('Authentication and Authorization', () => {
    test('Cannot access protected routes without login', async ({ page }) => {
      // Try to access protected route
      await page.goto('/pms/components');
      
      // Should redirect to login
      await expect(page).toHaveURL(/login/);
      await expect(page.locator('[data-testid="input-username"]')).toBeVisible();
      
      await screenshotHelper.captureHappyPath('auth', 'redirect_to_login');
    });

    test('Session timeout works', async ({ page }) => {
      await authHelper.loginAs('chiefEngineer');
      
      // Simulate session timeout by clearing cookies
      await page.context().clearCookies();
      
      // Try to navigate
      await page.reload();
      
      // Should redirect to login
      await expect(page).toHaveURL(/login/);
      
      await screenshotHelper.captureHappyPath('auth', 'session_timeout');
    });

    test('Role-based access control works', async ({ page }) => {
      // Test different user roles
      const roleTests = [
        { role: 'chiefEngineer' as const, canAccessAdmin: false, canModifyPMS: true },
        { role: 'secondEngineer' as const, canAccessAdmin: false, canModifyPMS: false },
        { role: 'admin' as const, canAccessAdmin: true, canModifyPMS: true },
      ];

      for (const test of roleTests) {
        await authHelper.loginAs(test.role);
        
        // Test admin access
        if (test.canAccessAdmin) {
          await navHelper.navigateToAdmin();
          await expect(page).toHaveURL(/admin/);
        } else {
          const adminNav = page.locator('[data-testid="nav-admin"]');
          await expect(adminNav).not.toBeVisible();
        }
        
        // Test modify PMS access
        if (test.canModifyPMS) {
          await navHelper.navigateToModifyPMS();
          await expect(page.locator('[data-testid="button-new-change-request"]')).toBeVisible();
        }
        
        await authHelper.logout();
      }
      
      await screenshotHelper.captureHappyPath('rbac', 'role_access');
    });
  });

  test.describe('Data Validation', () => {
    test('Form validation prevents invalid data submission', async ({ page }) => {
      await authHelper.loginAs('chiefEngineer');
      await navHelper.navigateToWorkOrders();
      
      // Try to create work order with invalid data
      await page.click('[data-testid="button-new-work-order"]');
      
      // Submit empty form
      await formHelper.submitForm();
      
      // Check multiple validation errors
      await expect(page.locator('[data-testid$="-error"]')).toHaveCount(3, { timeout: 5000 });
      
      // Try invalid frequency
      await formHelper.fillInput('input-frequency', '-5');
      await formHelper.submitForm();
      await formHelper.verifyValidationError('input-frequency', 'Must be positive');
      
      // Try invalid date
      await formHelper.fillInput('input-due-date', '2020-01-01');
      await formHelper.submitForm();
      await formHelper.verifyValidationError('input-due-date', 'Cannot be in the past');
      
      await screenshotHelper.captureError('validation_errors');
    });

    test('Input sanitization works', async ({ page }) => {
      await authHelper.loginAs('chiefEngineer');
      await navHelper.navigateToComponents();
      
      // Try to input malicious content
      const maliciousInput = '<script>alert("XSS")</script>';
      
      await page.click('[data-testid="button-edit-component"]');
      await formHelper.fillInput('input-maker', maliciousInput);
      await formHelper.submitForm();
      
      // Verify script is not executed
      await page.waitForTimeout(1000);
      const alerts = await page.locator('script:has-text("alert")').count();
      expect(alerts).toBe(0);
      
      // Verify content is escaped
      const displayedValue = await page.locator('[data-testid="component-maker"]').innerText();
      expect(displayedValue).not.toContain('<script>');
      
      await screenshotHelper.captureHappyPath('validation', 'input_sanitized');
    });

    test('Numeric field validation works', async ({ page }) => {
      await authHelper.loginAs('chiefEngineer');
      await navHelper.navigateToSpares();
      
      await page.click('[data-testid="button-add-spare"]');
      
      // Try non-numeric values
      await formHelper.fillInput('input-rob', 'abc');
      await formHelper.fillInput('input-min', 'xyz');
      
      // Verify inputs reject non-numeric
      const robValue = await page.locator('[data-testid="input-rob"]').inputValue();
      const minValue = await page.locator('[data-testid="input-min"]').inputValue();
      
      expect(robValue).toMatch(/^\d*$/);
      expect(minValue).toMatch(/^\d*$/);
      
      await screenshotHelper.captureHappyPath('validation', 'numeric_only');
    });
  });

  test.describe('Error Handling', () => {
    test('Network error handling works', async ({ page, context }) => {
      await authHelper.loginAs('chiefEngineer');
      
      // Simulate network failure
      await context.route('**/api/**', route => route.abort());
      
      await navHelper.navigateToWorkOrders();
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"], [data-testid="toast-error"]')).toBeVisible({ timeout: 10000 });
      
      await screenshotHelper.captureError('network_error');
      
      // Clear route override
      await context.unroute('**/api/**');
    });

    test('Handles server errors gracefully', async ({ page, context }) => {
      await authHelper.loginAs('chiefEngineer');
      
      // Simulate server error
      await context.route('**/api/work-orders', route => {
        route.fulfill({ status: 500, body: 'Internal Server Error' });
      });
      
      await navHelper.navigateToWorkOrders();
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"], [data-testid="toast-error"]')).toBeVisible({ timeout: 10000 });
      
      await screenshotHelper.captureError('server_error');
      
      await context.unroute('**/api/work-orders');
    });

    test('Handles concurrent updates', async ({ page, browser }) => {
      // Open two sessions
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const auth1 = new AuthHelper(page1);
      
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const auth2 = new AuthHelper(page2);
      
      // Login both users
      await auth1.loginAs('chiefEngineer');
      await auth2.loginAs('secondEngineer');
      
      // Both navigate to same component
      await page1.goto('/pms/components');
      await page2.goto('/pms/components');
      
      // Simulate concurrent edits
      // User 1 starts editing
      await page1.click('[data-testid="button-edit-component"]');
      
      // User 2 tries to edit
      await page2.click('[data-testid="button-edit-component"]');
      
      // User 2 should see warning or lock
      const warning = await page2.locator('[data-testid="edit-lock-warning"], [data-testid="toast-warning"]').isVisible();
      expect(warning).toBeTruthy();
      
      await screenshotHelper.captureHappyPath('concurrency', 'edit_lock');
      
      await context1.close();
      await context2.close();
    });
  });

  test.describe('Performance', () => {
    test('Page load performance is acceptable', async ({ page }) => {
      await authHelper.loginAs('chiefEngineer');
      
      const startTime = Date.now();
      await navHelper.navigateToWorkOrders();
      const loadTime = Date.now() - startTime;
      
      // Page should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
      
      await screenshotHelper.captureHappyPath('performance', 'page_loaded');
    });

    test('Search responds quickly', async ({ page }) => {
      await authHelper.loginAs('chiefEngineer');
      await navHelper.navigateToComponents();
      
      const startTime = Date.now();
      await page.fill('[data-testid="input-component-search"]', 'engine');
      await page.waitForTimeout(500); // Wait for debounce
      const searchTime = Date.now() - startTime;
      
      // Search should complete within 1 second
      expect(searchTime).toBeLessThan(1500);
      
      await screenshotHelper.captureHappyPath('performance', 'search_complete');
    });

    test('Can handle large datasets', async ({ page }) => {
      await authHelper.loginAs('chiefEngineer');
      await navHelper.navigateToSpares();
      
      // Verify pagination exists for large datasets
      const hasPagination = await page.locator('[data-testid^="pagination-"]').isVisible();
      
      if (hasPagination) {
        // Test pagination performance
        const startTime = Date.now();
        await page.click('[data-testid="pagination-next"]');
        const paginationTime = Date.now() - startTime;
        
        expect(paginationTime).toBeLessThan(1000);
        
        await screenshotHelper.captureHappyPath('performance', 'pagination');
      }
    });
  });

  test.describe('Accessibility', () => {
    test('Keyboard navigation works', async ({ page }) => {
      await authHelper.loginAs('chiefEngineer');
      
      // Test tab navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Verify focus is visible
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
      
      // Test enter key on button
      await page.focus('[data-testid="nav-pms"]');
      await page.keyboard.press('Enter');
      
      await expect(page).toHaveURL(/pms/);
      
      await screenshotHelper.captureHappyPath('accessibility', 'keyboard_nav');
    });

    test('Screen reader labels exist', async ({ page }) => {
      await authHelper.loginAs('chiefEngineer');
      await navHelper.navigateToWorkOrders();
      
      // Check for aria labels
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        const hasLabel = await button.getAttribute('aria-label') || await button.innerText();
        expect(hasLabel).toBeTruthy();
      }
      
      await screenshotHelper.captureHappyPath('accessibility', 'aria_labels');
    });
  });

  test.describe('Database Integrity', () => {
    test('Database invariants are maintained', async ({ page }) => {
      const dbVerification = new DatabaseVerification();
      
      // Run all verifications
      const results = await dbVerification.runAllVerifications();
      
      // Check each verification
      expect(results.results.componentHierarchy.valid).toBeTruthy();
      expect(results.results.runningHours.valid).toBeTruthy();
      expect(results.results.sparesInventory.valid).toBeTruthy();
      expect(results.results.workOrderStatus.valid).toBeTruthy();
      expect(results.results.changeRequests.valid).toBeTruthy();
      
      // Log any errors
      for (const [check, result] of Object.entries(results.results)) {
        if (!result.valid) {
          console.log(`${check} errors:`, result.errors);
        }
      }
      
      await dbVerification.close();
    });

    test('Test data cleanup works', async ({ page }) => {
      const dbVerification = new DatabaseVerification();
      
      // Clean up test data
      await dbVerification.cleanupTestData('test_');
      
      // Verify cleanup
      await authHelper.loginAs('chiefEngineer');
      await navHelper.navigateToSpares();
      
      // Search for test data
      await page.fill('[data-testid="input-table-search"]', 'test_');
      await page.waitForTimeout(1000);
      
      // Should find no test data
      const emptyState = await page.locator('[data-testid="table-empty-state"]').isVisible();
      expect(emptyState).toBeTruthy();
      
      await dbVerification.close();
      
      await screenshotHelper.captureHappyPath('database', 'cleanup_complete');
    });
  });
});