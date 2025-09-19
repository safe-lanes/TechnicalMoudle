import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { FormHelper } from '../helpers/form.helper';
import { TableHelper } from '../helpers/table.helper';
import { ModalHelper } from '../helpers/modal.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { TEST_USERS } from '../fixtures/users';

test.describe('Admin Module Tests', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let formHelper: FormHelper;
  let tableHelper: TableHelper;
  let modalHelper: ModalHelper;
  let screenshotHelper: ScreenshotHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);
    formHelper = new FormHelper(page);
    tableHelper = new TableHelper(page);
    modalHelper = new ModalHelper(page);
    screenshotHelper = new ScreenshotHelper(page);
    
    await authHelper.loginAs('admin');
    await navHelper.navigateToAdmin();
  });

  test('Admin dashboard loads correctly', async ({ page }) => {
    // Verify admin sections are visible
    await expect(page.locator('[data-testid="admin-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-forms"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-alerts"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-import"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('admin', 'dashboard');
  });

  test('Can manage users', async ({ page }) => {
    // Navigate to users section
    await page.click('[data-testid="admin-users"]');
    
    // Verify user list loads
    await expect(page.locator('[data-testid="table-users"]')).toBeVisible();
    
    // Add new user
    await page.click('[data-testid="button-add-user"]');
    await modalHelper.waitForModal('modal-add-user');
    
    await formHelper.fillInput('input-username', 'test_user_admin');
    await formHelper.fillInput('input-password', 'TestPass123!');
    await formHelper.selectDropdown('select-role', 'chief_engineer');
    await formHelper.fillInput('input-display-name', 'Test Chief Engineer');
    
    await screenshotHelper.captureHappyPath('admin', 'add_user_form');
    
    await formHelper.submitForm();
    
    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('admin', 'user_added');
  });

  test('Can manage form definitions', async ({ page }) => {
    // Navigate to forms section
    await page.click('[data-testid="admin-forms"]');
    
    // Verify forms list loads
    await expect(page.locator('[data-testid="table-forms"]')).toBeVisible();
    
    // Create new form
    await page.click('[data-testid="button-add-form"]');
    await modalHelper.waitForModal('modal-form-editor');
    
    await formHelper.fillInput('input-form-name', 'Test Maintenance Form');
    await formHelper.selectDropdown('select-form-type', 'maintenance');
    
    // Add a section
    await page.click('[data-testid="button-add-section"]');
    await formHelper.fillInput('input-section-name', 'Test Section');
    
    // Add a field
    await page.click('[data-testid="button-add-field"]');
    await formHelper.fillInput('input-field-name', 'test_field');
    await formHelper.fillInput('input-field-label', 'Test Field');
    await formHelper.selectDropdown('select-field-type', 'text');
    
    await screenshotHelper.captureHappyPath('admin', 'form_editor');
    
    // Save form
    await page.click('[data-testid="button-save-form"]');
    
    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('Can configure alert policies', async ({ page }) => {
    // Navigate to alerts section
    await page.click('[data-testid="admin-alerts"]');
    
    // Verify alert policies load
    await expect(page.locator('[data-testid="table-alert-policies"]')).toBeVisible();
    
    // Create new alert policy
    await page.click('[data-testid="button-add-alert-policy"]');
    await modalHelper.waitForModal('modal-alert-policy');
    
    await formHelper.fillInput('input-policy-name', 'Critical Spare Low Stock');
    await formHelper.selectDropdown('select-alert-type', 'spare_stock_low');
    await formHelper.fillInput('input-threshold', '2');
    await formHelper.selectDropdown('select-severity', 'critical');
    
    // Configure recipients
    await page.click('[data-testid="checkbox-notify-chief-engineer"]');
    await page.click('[data-testid="checkbox-notify-master"]');
    
    await screenshotHelper.captureHappyPath('admin', 'alert_policy_form');
    
    await formHelper.submitForm();
    
    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('Can perform bulk data import', async ({ page }) => {
    // Navigate to import section
    await page.click('[data-testid="admin-import"]');
    
    // Select import type
    await formHelper.selectDropdown('select-import-type', 'components');
    
    // Upload file
    const fileInput = page.locator('[data-testid="input-import-file"]');
    await fileInput.setInputFiles({
      name: 'test_components.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('id,name,category\n1,Test Component,machinery')
    });
    
    // Verify preview
    await page.click('[data-testid="button-preview-import"]');
    await expect(page.locator('[data-testid="import-preview"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('admin', 'import_preview');
    
    // Validate import
    await page.click('[data-testid="button-validate-import"]');
    await expect(page.locator('[data-testid="validation-success"]')).toBeVisible();
    
    // Execute import
    await page.click('[data-testid="button-execute-import"]');
    
    // Verify success
    await expect(page.locator('[data-testid="import-results"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('admin', 'import_complete');
  });

  test('Can view system settings', async ({ page }) => {
    // Navigate to settings
    await page.click('[data-testid="admin-settings"]');
    
    // Verify settings sections
    await expect(page.locator('[data-testid="settings-general"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-maintenance"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-notifications"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('admin', 'system_settings');
  });

  test('Can manage vessel information', async ({ page }) => {
    // Navigate to vessel management
    await page.click('[data-testid="admin-vessels"]');
    
    // Edit vessel details
    await page.click('[data-testid="button-edit-vessel"]');
    await modalHelper.waitForModal('modal-edit-vessel');
    
    await formHelper.fillInput('input-vessel-name', 'Test Vessel');
    await formHelper.fillInput('input-imo-number', '1234567');
    await formHelper.fillInput('input-vessel-type', 'Container Ship');
    
    await screenshotHelper.captureHappyPath('admin', 'vessel_management');
    
    await formHelper.submitForm();
    
    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('Can view audit logs', async ({ page }) => {
    // Navigate to audit logs
    await page.click('[data-testid="admin-audit-logs"]');
    
    // Verify audit log table
    await expect(page.locator('[data-testid="table-audit-logs"]')).toBeVisible();
    
    // Apply filters
    await formHelper.selectDropdown('select-log-type', 'user_actions');
    await formHelper.fillInput('input-date-from', '2025-01-01');
    await formHelper.fillInput('input-date-to', '2025-01-31');
    
    await page.click('[data-testid="button-apply-filters"]');
    
    await page.waitForLoadState('networkidle');
    
    await screenshotHelper.captureHappyPath('admin', 'audit_logs');
  });

  test('Can manage permissions', async ({ page }) => {
    // Navigate to permissions
    await page.click('[data-testid="admin-permissions"]');
    
    // Verify permission matrix
    await expect(page.locator('[data-testid="permission-matrix"]')).toBeVisible();
    
    // Edit permissions for a role
    await page.click('[data-testid="edit-permissions-chief-engineer"]');
    
    // Toggle permissions
    await page.click('[data-testid="permission-modify-components"]');
    await page.click('[data-testid="permission-approve-changes"]');
    
    await screenshotHelper.captureHappyPath('admin', 'permissions_matrix');
    
    // Save permissions
    await page.click('[data-testid="button-save-permissions"]');
    
    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('Can view system health', async ({ page }) => {
    // Navigate to system health
    await page.click('[data-testid="admin-system-health"]');
    
    // Verify health indicators
    await expect(page.locator('[data-testid="health-database"]')).toBeVisible();
    await expect(page.locator('[data-testid="health-storage"]')).toBeVisible();
    await expect(page.locator('[data-testid="health-api"]')).toBeVisible();
    
    // Check database status
    const dbStatus = page.locator('[data-testid="status-database"]');
    await expect(dbStatus).toContainText(/healthy|ok|connected/i);
    
    await screenshotHelper.captureHappyPath('admin', 'system_health');
  });

  test('Can export system data', async ({ page }) => {
    // Navigate to data export
    await page.click('[data-testid="admin-export"]');
    
    // Select export options
    await page.click('[data-testid="checkbox-export-components"]');
    await page.click('[data-testid="checkbox-export-work-orders"]');
    await page.click('[data-testid="checkbox-export-spares"]');
    
    await formHelper.selectDropdown('select-export-format', 'excel');
    
    await screenshotHelper.captureHappyPath('admin', 'export_options');
    
    // Start export
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="button-export"]');
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toContain('pms_export');
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test('Admin access control works', async ({ page }) => {
    // Logout and login as non-admin
    await authHelper.logout();
    await authHelper.loginAs('chiefEngineer');
    
    // Try to navigate to admin
    await page.goto('/admin');
    
    // Should be redirected or show access denied
    const accessDenied = await page.locator('[data-testid="access-denied"]').isVisible();
    const redirected = !page.url().includes('/admin');
    
    expect(accessDenied || redirected).toBeTruthy();
    
    await screenshotHelper.captureHappyPath('admin', 'access_control');
  });
});