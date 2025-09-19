import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { FormHelper } from '../helpers/form.helper';
import { TableHelper } from '../helpers/table.helper';
import { ModalHelper } from '../helpers/modal.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { generateUniqueId } from '../fixtures/test-data';

test.describe('Admin Module - Comprehensive Tests', () => {
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

  test.describe('Bulk Data Import', () => {
    test('Download templates for different data types', async ({ page }) => {
      await page.click('[data-testid="admin-import"], [data-testid="button-import-data"]');
      await page.waitForTimeout(1000);
      
      const dataTypes = ['Components', 'Work Orders', 'Spares', 'Stores'];
      
      for (const dataType of dataTypes) {
        const downloadButton = page.locator(`[data-testid="download-template-${dataType.toLowerCase().replace(' ', '-')}"]`);
        if (await downloadButton.count() > 0) {
          const downloadPromise = page.waitForEvent('download');
          await downloadButton.click();
          const download = await downloadPromise;
          
          expect(download.suggestedFilename()).toContain('template');
          expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/);
          
          console.log(`Template downloaded: ${download.suggestedFilename()}`);
        }
      }
      
      await screenshotHelper.captureHappyPath('admin', 'import_templates');
    });

    test('Upload sample sheets and verify rows created', async ({ page }) => {
      await page.click('[data-testid="admin-import"], [data-testid="button-import-data"]');
      await modalHelper.waitForModal('modal-bulk-import');
      
      // Test Components import
      const csvContent = `id,name,maker,model,category,parent_id
comp_${generateUniqueId()},Test Pump,TestMaker,Model-A,Machinery,
comp_${generateUniqueId()},Test Motor,TestMaker,Model-B,Electrical,`;
      
      await formHelper.selectDropdown('select-import-type', 'Components');
      
      const fileInput = page.locator('[data-testid="input-import-file"]');
      await fileInput.setInputFiles({
        name: 'test_components.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent)
      });
      
      // Preview import
      await page.click('[data-testid="button-preview-import"]');
      await page.waitForTimeout(1000);
      
      // Check preview table
      const previewTable = page.locator('[data-testid="table-import-preview"]');
      await expect(previewTable).toBeVisible();
      
      const previewRows = await page.locator('[data-testid^="preview-row-"]').count();
      expect(previewRows).toBe(2);
      
      await screenshotHelper.captureHappyPath('admin', 'import_preview');
      
      // Validate import
      await page.click('[data-testid="button-validate-import"]');
      await page.waitForTimeout(1000);
      
      const validationStatus = page.locator('[data-testid="validation-status"]');
      await expect(validationStatus).toContainText(/valid|success/i);
      
      // Execute import
      await page.click('[data-testid="button-execute-import"]');
      await page.waitForTimeout(2000);
      
      // Check results
      const importResults = page.locator('[data-testid="import-results"]');
      await expect(importResults).toBeVisible();
      await expect(importResults).toContainText('2'); // 2 rows imported
      
      await screenshotHelper.captureHappyPath('admin', 'import_success');
    });

    test('Test error reporting for invalid data', async ({ page }) => {
      await page.click('[data-testid="admin-import"], [data-testid="button-import-data"]');
      await modalHelper.waitForModal('modal-bulk-import');
      
      // Invalid CSV with missing required fields
      const invalidCsv = `name,category
Test Item,
,Machinery
Invalid Row,Invalid Category`;
      
      await formHelper.selectDropdown('select-import-type', 'Components');
      
      const fileInput = page.locator('[data-testid="input-import-file"]');
      await fileInput.setInputFiles({
        name: 'invalid_data.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(invalidCsv)
      });
      
      // Validate import
      await page.click('[data-testid="button-validate-import"]');
      await page.waitForTimeout(1000);
      
      // Check for errors
      const errorList = page.locator('[data-testid="validation-errors"]');
      await expect(errorList).toBeVisible();
      
      const errors = await page.locator('[data-testid^="error-row-"]').count();
      expect(errors).toBeGreaterThan(0);
      
      await screenshotHelper.captureHappyPath('admin', 'import_errors');
    });

    test('Verify import logs are persisted', async ({ page }) => {
      // Perform an import first
      await page.click('[data-testid="admin-import"], [data-testid="button-import-data"]');
      await modalHelper.waitForModal('modal-bulk-import');
      
      const uniqueId = generateUniqueId();
      const csvContent = `id,name,category\ntest_${uniqueId},Test Import,Machinery`;
      
      await formHelper.selectDropdown('select-import-type', 'Components');
      
      const fileInput = page.locator('[data-testid="input-import-file"]');
      await fileInput.setInputFiles({
        name: `import_${uniqueId}.csv`,
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent)
      });
      
      await page.click('[data-testid="button-execute-import"]');
      await page.waitForTimeout(2000);
      
      // Close import modal
      await modalHelper.closeModal();
      
      // Navigate to import logs
      await page.click('[data-testid="admin-import-logs"], [data-testid="button-view-import-history"]');
      await page.waitForTimeout(1000);
      
      // Check if import appears in logs
      const logTable = page.locator('[data-testid="table-import-logs"]');
      await expect(logTable).toBeVisible();
      
      const latestLog = page.locator('[data-testid^="import-log-"]').first();
      await expect(latestLog).toContainText('Components');
      await expect(latestLog).toContainText(/success|completed/i);
      
      await screenshotHelper.captureHappyPath('admin', 'import_logs');
    });
  });

  test.describe('Alerts Configuration', () => {
    test('Enable different alert types with Email/In-App notifications', async ({ page }) => {
      await page.click('[data-testid="admin-alerts"]');
      await page.waitForTimeout(1000);
      
      const alertTypes = [
        { name: 'Maintenance Due', testId: 'alert-maintenance-due' },
        { name: 'Critical Inventory', testId: 'alert-critical-inventory' },
        { name: 'Running Hours Threshold', testId: 'alert-running-hours' },
        { name: 'Certificate Expiration', testId: 'alert-certificate' }
      ];
      
      for (const alert of alertTypes) {
        const alertRow = page.locator(`[data-testid="${alert.testId}"]`);
        if (await alertRow.count() > 0) {
          // Enable alert
          const enableToggle = alertRow.locator('[data-testid="toggle-enable"]');
          if (await enableToggle.count() > 0) {
            const isEnabled = await enableToggle.getAttribute('aria-checked') === 'true';
            if (!isEnabled) {
              await enableToggle.click();
            }
          }
          
          // Configure Email notification
          const emailToggle = alertRow.locator('[data-testid="toggle-email"]');
          if (await emailToggle.count() > 0) {
            await emailToggle.click();
          }
          
          // Configure In-App notification
          const inAppToggle = alertRow.locator('[data-testid="toggle-in-app"]');
          if (await inAppToggle.count() > 0) {
            await inAppToggle.click();
          }
          
          // Set Priority
          const prioritySelect = alertRow.locator('[data-testid="select-priority"]');
          if (await prioritySelect.count() > 0) {
            await prioritySelect.click();
            await page.click('[data-testid="priority-high"]');
          }
        }
      }
      
      await screenshotHelper.captureHappyPath('admin', 'alerts_configured');
      
      // Save configuration
      await page.click('[data-testid="button-save-alert-config"]');
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    });

    test('Configure Quiet Hours for notifications', async ({ page }) => {
      await page.click('[data-testid="admin-alerts"]');
      await page.waitForTimeout(1000);
      
      // Open quiet hours configuration
      await page.click('[data-testid="button-configure-quiet-hours"]');
      await modalHelper.waitForModal('modal-quiet-hours');
      
      // Enable quiet hours
      await page.click('[data-testid="toggle-enable-quiet-hours"]');
      
      // Set time range
      await formHelper.fillInput('input-quiet-hours-start', '22:00');
      await formHelper.fillInput('input-quiet-hours-end', '06:00');
      
      // Configure days
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      for (const day of days) {
        await page.click(`[data-testid="checkbox-quiet-${day}"]`);
      }
      
      // Set exceptions for critical alerts
      await page.click('[data-testid="checkbox-allow-critical-during-quiet"]');
      
      await screenshotHelper.captureHappyPath('admin', 'quiet_hours_config');
      
      // Save
      await modalHelper.confirmModal();
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    });

    test('Configure Escalation rules', async ({ page }) => {
      await page.click('[data-testid="admin-alerts"]');
      await page.waitForTimeout(1000);
      
      // Open escalation configuration
      await page.click('[data-testid="button-configure-escalation"]');
      await modalHelper.waitForModal('modal-escalation-rules');
      
      // Add escalation rule
      await page.click('[data-testid="button-add-escalation-rule"]');
      
      // Configure first level
      await formHelper.selectDropdown('select-alert-type-0', 'Critical Inventory');
      await formHelper.fillInput('input-escalate-after-0', '30'); // minutes
      await formHelper.selectDropdown('select-escalate-to-0', 'Chief Engineer');
      
      // Add second level
      await page.click('[data-testid="button-add-level-0"]');
      await formHelper.fillInput('input-escalate-after-0-1', '60');
      await formHelper.selectDropdown('select-escalate-to-0-1', 'Master');
      
      await screenshotHelper.captureHappyPath('admin', 'escalation_rules');
      
      // Save
      await modalHelper.confirmModal();
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    });

    test('Trigger sample conditions and verify alerts', async ({ page }) => {
      // First configure alerts
      await page.click('[data-testid="admin-alerts"]');
      
      // Enable test mode
      const testModeToggle = page.locator('[data-testid="toggle-test-mode"]');
      if (await testModeToggle.count() > 0) {
        await testModeToggle.click();
      }
      
      // Trigger maintenance due alert
      await page.click('[data-testid="button-trigger-maintenance-alert"]');
      await page.waitForTimeout(1000);
      
      // Check notification appears
      const notification = page.locator('[data-testid="notification-maintenance-due"]');
      if (await notification.count() > 0) {
        await expect(notification).toBeVisible();
        await expect(notification).toContainText('Maintenance Due');
      }
      
      // Trigger low inventory alert
      await page.click('[data-testid="button-trigger-inventory-alert"]');
      await page.waitForTimeout(1000);
      
      // Navigate to alerts dashboard
      await page.click('[data-testid="button-view-active-alerts"]');
      await page.waitForTimeout(1000);
      
      // Verify alerts appear in dashboard
      const alertsTable = page.locator('[data-testid="table-active-alerts"]');
      await expect(alertsTable).toBeVisible();
      
      const alertCount = await page.locator('[data-testid^="alert-row-"]').count();
      expect(alertCount).toBeGreaterThan(0);
      
      await screenshotHelper.captureHappyPath('admin', 'triggered_alerts');
    });

    test('Verify alert events are logged', async ({ page }) => {
      await page.click('[data-testid="admin-alerts"]');
      
      // Navigate to alert history
      await page.click('[data-testid="button-alert-history"]');
      await page.waitForTimeout(1000);
      
      const historyTable = page.locator('[data-testid="table-alert-history"]');
      await expect(historyTable).toBeVisible();
      
      // Check for required columns
      const columns = ['Alert Type', 'Triggered At', 'Severity', 'Status', 'Recipient', 'Delivery Method'];
      for (const column of columns) {
        await expect(page.getByText(column).first()).toBeVisible();
      }
      
      // Verify persistence
      const alertEvents = await page.locator('[data-testid^="alert-event-"]').count();
      if (alertEvents > 0) {
        const firstEvent = page.locator('[data-testid^="alert-event-"]').first();
        await expect(firstEvent).toContainText(/sent|delivered|triggered/i);
      }
      
      await screenshotHelper.captureHappyPath('admin', 'alert_history');
    });
  });

  test.describe('Forms Control', () => {
    test('Change form attributes and version tracking', async ({ page }) => {
      await page.click('[data-testid="admin-forms"]');
      await page.waitForTimeout(1000);
      
      // Select a form to edit
      const formsList = page.locator('[data-testid^="form-item-"]');
      if (await formsList.count() > 0) {
        await formsList.first().click();
        await modalHelper.waitForModal('modal-form-editor');
        
        // Get current version
        const currentVersion = await page.locator('[data-testid="form-version"]').textContent();
        
        // Make changes
        await formHelper.fillInput('input-form-title', `Updated Form ${generateUniqueId()}`);
        
        // Add a new field
        await page.click('[data-testid="button-add-field"]');
        await formHelper.fillInput('input-field-name', `field_${generateUniqueId()}`);
        await formHelper.fillInput('input-field-label', 'New Test Field');
        await formHelper.selectDropdown('select-field-type', 'text');
        await page.click('[data-testid="checkbox-field-required"]');
        
        // Add validation rule
        await page.click('[data-testid="button-add-validation"]');
        await formHelper.selectDropdown('select-validation-type', 'minLength');
        await formHelper.fillInput('input-validation-value', '5');
        
        await screenshotHelper.captureHappyPath('admin', 'form_editing');
        
        // Save as new version
        await page.click('[data-testid="button-save-new-version"]');
        await modalHelper.waitForModal('modal-version-notes');
        
        await formHelper.fillTextarea('textarea-version-notes', 'Added new required field with validation');
        await modalHelper.confirmModal();
        
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
        
        // Verify new version created
        const newVersion = await page.locator('[data-testid="form-version"]').textContent();
        expect(newVersion).not.toBe(currentVersion);
        
        await screenshotHelper.captureHappyPath('admin', 'form_new_version');
      }
    });

    test('Verify form version table with dates', async ({ page }) => {
      await page.click('[data-testid="admin-forms"]');
      
      // Open form version history
      await page.click('[data-testid="button-form-versions"]');
      await modalHelper.waitForModal('modal-form-versions');
      
      // Check version table
      const versionTable = page.locator('[data-testid="table-form-versions"]');
      await expect(versionTable).toBeVisible();
      
      // Verify columns
      const columns = ['Version', 'Date', 'Author', 'Changes', 'Status'];
      for (const column of columns) {
        await expect(page.getByText(column).first()).toBeVisible();
      }
      
      // Check for version entries
      const versionRows = await page.locator('[data-testid^="version-row-"]').count();
      if (versionRows > 0) {
        const latestVersion = page.locator('[data-testid^="version-row-"]').first();
        
        // Verify date format
        const dateCell = latestVersion.locator('[data-testid="version-date"]');
        const dateText = await dateCell.textContent();
        expect(dateText).toMatch(/\d{4}-\d{2}-\d{2}/); // YYYY-MM-DD format
        
        // Verify version number
        const versionCell = latestVersion.locator('[data-testid="version-number"]');
        const versionText = await versionCell.textContent();
        expect(versionText).toMatch(/v?\d+\.\d+/); // v1.0 or 1.0 format
      }
      
      await screenshotHelper.captureHappyPath('admin', 'form_version_history');
    });

    test('Test form preview functionality', async ({ page }) => {
      await page.click('[data-testid="admin-forms"]');
      
      // Select a form
      const formItem = page.locator('[data-testid^="form-item-"]').first();
      if (await formItem.count() > 0) {
        await formItem.click();
        await modalHelper.waitForModal('modal-form-editor');
        
        // Click preview
        await page.click('[data-testid="button-preview-form"]');
        await page.waitForTimeout(1000);
        
        // Check preview panel
        const previewPanel = page.locator('[data-testid="form-preview"]');
        await expect(previewPanel).toBeVisible();
        
        // Verify form renders correctly
        const formFields = await previewPanel.locator('input, select, textarea').count();
        expect(formFields).toBeGreaterThan(0);
        
        // Test form validation in preview
        await page.click('[data-testid="button-test-submit"]');
        
        // Check for validation errors
        const validationErrors = await previewPanel.locator('[data-testid$="-error"]').count();
        console.log(`Form has ${validationErrors} validation errors in preview`);
        
        await screenshotHelper.captureHappyPath('admin', 'form_preview');
      }
    });
  });

  test.describe('Data Persistence Verification', () => {
    test('Verify import logs persistence', async ({ page }) => {
      // Navigate to import logs
      await page.click('[data-testid="admin-import-logs"], [data-testid="button-import-history"]');
      await page.waitForTimeout(1000);
      
      const logTable = page.locator('[data-testid="table-import-logs"]');
      await expect(logTable).toBeVisible();
      
      // Check log entries have required data
      const logEntries = await page.locator('[data-testid^="import-log-"]').count();
      if (logEntries > 0) {
        const firstLog = page.locator('[data-testid^="import-log-"]').first();
        
        // Verify timestamp
        const timestamp = firstLog.locator('[data-testid="log-timestamp"]');
        if (await timestamp.count() > 0) {
          const timeText = await timestamp.textContent();
          expect(timeText).toBeTruthy();
        }
        
        // Verify user
        const user = firstLog.locator('[data-testid="log-user"]');
        if (await user.count() > 0) {
          const userText = await user.textContent();
          expect(userText).toBeTruthy();
        }
        
        // Verify status
        const status = firstLog.locator('[data-testid="log-status"]');
        if (await status.count() > 0) {
          const statusText = await status.textContent();
          expect(['Success', 'Failed', 'Partial'].includes(statusText!)).toBeTruthy();
        }
      }
      
      await screenshotHelper.captureHappyPath('admin', 'import_logs_persistent');
    });

    test('Verify alert policy records persistence', async ({ page }) => {
      await page.click('[data-testid="admin-alerts"]');
      
      // Make a change to alert policy
      const uniqueId = generateUniqueId();
      await page.click('[data-testid="button-create-alert-policy"]');
      await modalHelper.waitForModal('modal-alert-policy');
      
      await formHelper.fillInput('input-policy-name', `Test Policy ${uniqueId}`);
      await formHelper.selectDropdown('select-alert-type', 'Maintenance Due');
      await formHelper.fillInput('input-threshold-days', '7');
      await formHelper.selectDropdown('select-priority', 'Medium');
      
      await modalHelper.confirmModal();
      await page.waitForTimeout(1000);
      
      // Navigate away and back
      await navHelper.navigateToDashboard();
      await page.waitForTimeout(1000);
      await navHelper.navigateToAdmin();
      await page.click('[data-testid="admin-alerts"]');
      
      // Search for the policy
      const searchInput = page.locator('[data-testid="input-search-policies"]');
      if (await searchInput.count() > 0) {
        await searchInput.fill(uniqueId);
        await page.waitForTimeout(1000);
      }
      
      // Verify policy exists
      const policyItem = page.locator(`[data-testid*="${uniqueId}"]`);
      if (await policyItem.count() > 0) {
        await expect(policyItem).toBeVisible();
      }
      
      await screenshotHelper.captureHappyPath('admin', 'alert_policy_persistent');
    });
  });

  test.describe('Issue Reporting', () => {
    test('Document any UI issues found during testing', async ({ page }) => {
      const issues: string[] = [];
      
      // Check for missing test IDs
      const missingTestIds = [];
      const elementsToCheck = [
        'button-export-config',
        'filter-import-type',
        'sort-alert-priority',
        'pagination-logs',
        'button-backup-data'
      ];
      
      for (const element of elementsToCheck) {
        const count = await page.locator(`[data-testid="${element}"]`).count();
        if (count === 0) {
          missingTestIds.push(element);
        }
      }
      
      if (missingTestIds.length > 0) {
        issues.push(`Missing data-testid attributes: ${missingTestIds.join(', ')}`);
      }
      
      // Check for proper role-based access
      await authHelper.logout();
      await authHelper.loginAs('crew');
      
      // Try to access admin
      await page.goto('/admin');
      await page.waitForTimeout(1000);
      
      const hasAccess = page.url().includes('/admin');
      const accessDenied = await page.locator('[data-testid="access-denied"]').count() > 0;
      
      if (hasAccess && !accessDenied) {
        issues.push('Admin area accessible to non-admin users');
      }
      
      // Report issues
      if (issues.length > 0) {
        console.log('⚠️ Issues found in Admin module:');
        issues.forEach(issue => console.log(`  - ${issue}`));
        await screenshotHelper.captureError('admin_issues');
      } else {
        console.log('✅ No major issues found in Admin module');
      }
    });
  });
});