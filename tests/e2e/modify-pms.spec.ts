import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { FormHelper } from '../helpers/form.helper';
import { TableHelper } from '../helpers/table.helper';
import { ModalHelper } from '../helpers/modal.helper';
import { ComponentTreeHelper } from '../helpers/component-tree.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';

test.describe('Modify PMS Module Tests', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let formHelper: FormHelper;
  let tableHelper: TableHelper;
  let modalHelper: ModalHelper;
  let treeHelper: ComponentTreeHelper;
  let screenshotHelper: ScreenshotHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);
    formHelper = new FormHelper(page);
    tableHelper = new TableHelper(page);
    modalHelper = new ModalHelper(page);
    treeHelper = new ComponentTreeHelper(page);
    screenshotHelper = new ScreenshotHelper(page);
    
    await authHelper.loginAs('chiefEngineer');
    await navHelper.navigateToModifyPMS();
  });

  test('Modify PMS page loads correctly', async ({ page }) => {
    // Verify main sections are visible
    await expect(page.locator('[data-testid="change-request-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-new-change-request"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('modify-pms', 'page_loaded');
  });

  test('Can create new change request - Component', async ({ page }) => {
    // Click new change request
    await page.click('[data-testid="button-new-change-request"]');
    await modalHelper.waitForModal('modal-select-target-type');
    
    // Select Component
    await page.click('[data-testid="radio-target-component"]');
    await modalHelper.confirmModal('button-continue');
    
    // Select target component
    await modalHelper.waitForModal('modal-select-component');
    await treeHelper.expandNode('1');
    await treeHelper.selectNode('1.1');
    await modalHelper.confirmModal('button-select');
    
    // Fill change request form
    await formHelper.fillInput('input-change-title', 'Update maintenance frequency');
    await formHelper.fillTextarea('textarea-change-description', 'Need to adjust maintenance frequency based on operational feedback');
    await formHelper.selectDropdown('select-priority', 'High');
    
    await screenshotHelper.captureHappyPath('modify-pms', 'component_change_form');
    
    // Enter modify mode
    await page.click('[data-testid="button-enter-modify-mode"]');
    
    // Make changes
    await page.click('[data-testid="field-frequency"]');
    await formHelper.fillInput('input-frequency', '6');
    
    // Save changes
    await page.click('[data-testid="button-save-changes"]');
    
    await screenshotHelper.captureHappyPath('modify-pms', 'component_changes_made');
    
    // Review and submit
    await page.click('[data-testid="button-review-changes"]');
    await modalHelper.waitForModal('modal-review-changes');
    
    await screenshotHelper.captureHappyPath('modify-pms', 'review_changes');
    
    await modalHelper.confirmModal('button-submit-changes');
    
    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('Can create new change request - Work Orders', async ({ page }) => {
    // Click new change request
    await page.click('[data-testid="button-new-change-request"]');
    await modalHelper.waitForModal('modal-select-target-type');
    
    // Select Work Orders
    await page.click('[data-testid="radio-target-work-orders"]');
    await modalHelper.confirmModal('button-continue');
    
    // Fill change request
    await formHelper.fillInput('input-change-title', 'Bulk update work order schedules');
    await formHelper.fillTextarea('textarea-change-description', 'Adjusting schedules for Q2 maintenance');
    
    await screenshotHelper.captureHappyPath('modify-pms', 'work_orders_change_form');
    
    // Submit
    await formHelper.submitForm();
    
    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('Can create new change request - Spares', async ({ page }) => {
    // Click new change request
    await page.click('[data-testid="button-new-change-request"]');
    await modalHelper.waitForModal('modal-select-target-type');
    
    // Select Spares
    await page.click('[data-testid="radio-target-spares"]');
    await modalHelper.confirmModal('button-continue');
    
    // Fill change request
    await formHelper.fillInput('input-change-title', 'Update critical spare minimums');
    await formHelper.fillTextarea('textarea-change-description', 'Increase minimum stock levels for critical spares');
    
    await screenshotHelper.captureHappyPath('modify-pms', 'spares_change_form');
    
    // Submit
    await formHelper.submitForm();
    
    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('Can view existing change requests', async ({ page }) => {
    // Check for existing change requests
    const hasRequests = await page.locator('[data-testid="change-request-item"]').count() > 0;
    
    if (hasRequests) {
      // Click on first request
      await page.click('[data-testid="change-request-item"]');
      
      // Verify details panel opens
      await expect(page.locator('[data-testid="change-request-details"]')).toBeVisible();
      
      await screenshotHelper.captureHappyPath('modify-pms', 'view_change_request');
    }
  });

  test('Can filter change requests by status', async ({ page }) => {
    // Test different status filters
    const statuses = ['draft', 'submitted', 'approved', 'rejected'];
    
    for (const status of statuses) {
      await page.click('[data-testid="select-status-filter"]');
      await page.click(`[data-testid="select-option-${status}"]`);
      
      await page.waitForLoadState('networkidle');
      
      await screenshotHelper.captureHappyPath('modify-pms', `filter_${status}`);
    }
  });

  test('Modify mode visual indicators work', async ({ page }) => {
    // Create a change request and enter modify mode
    await page.click('[data-testid="button-new-change-request"]');
    await modalHelper.waitForModal('modal-select-target-type');
    await page.click('[data-testid="radio-target-component"]');
    await modalHelper.confirmModal('button-continue');
    
    await modalHelper.waitForModal('modal-select-component');
    await treeHelper.selectNode('1');
    await modalHelper.confirmModal('button-select');
    
    // Enter modify mode
    await page.click('[data-testid="button-enter-modify-mode"]');
    
    // Verify modify mode indicators
    await expect(page.locator('[data-testid="modify-mode-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="modify-footer"]')).toBeVisible();
    
    // Verify fields are editable
    const editableField = page.locator('[data-testid="editable-field"]').first();
    await expect(editableField).toHaveClass(/editable/);
    
    await screenshotHelper.captureHappyPath('modify-pms', 'modify_mode_indicators');
  });

  test('Can track changes in modify mode', async ({ page }) => {
    // Enter modify mode for a component
    await page.click('[data-testid="button-new-change-request"]');
    await modalHelper.waitForModal('modal-select-target-type');
    await page.click('[data-testid="radio-target-component"]');
    await modalHelper.confirmModal('button-continue');
    
    await modalHelper.waitForModal('modal-select-component');
    await treeHelper.selectNode('1');
    await modalHelper.confirmModal('button-select');
    
    await page.click('[data-testid="button-enter-modify-mode"]');
    
    // Make multiple changes
    await page.click('[data-testid="field-maker"]');
    await formHelper.fillInput('input-maker', 'New Manufacturer');
    
    await page.click('[data-testid="field-model"]');
    await formHelper.fillInput('input-model', 'Model 2025');
    
    // Verify change counter
    await expect(page.locator('[data-testid="change-count"]')).toContainText('2');
    
    // Open changes drawer
    await page.click('[data-testid="button-view-changes"]');
    await expect(page.locator('[data-testid="changes-drawer"]')).toBeVisible();
    
    // Verify changes are listed
    await expect(page.locator('[data-testid="change-item"]')).toHaveCount(2);
    
    await screenshotHelper.captureHappyPath('modify-pms', 'tracked_changes');
  });

  test('Can discard changes in modify mode', async ({ page }) => {
    // Enter modify mode
    await page.click('[data-testid="button-new-change-request"]');
    await modalHelper.waitForModal('modal-select-target-type');
    await page.click('[data-testid="radio-target-component"]');
    await modalHelper.confirmModal('button-continue');
    
    await modalHelper.waitForModal('modal-select-component');
    await treeHelper.selectNode('1');
    await modalHelper.confirmModal('button-select');
    
    await page.click('[data-testid="button-enter-modify-mode"]');
    
    // Make a change
    await page.click('[data-testid="field-maker"]');
    await formHelper.fillInput('input-maker', 'Test Manufacturer');
    
    // Discard changes
    await page.click('[data-testid="button-discard-changes"]');
    await modalHelper.waitForModal('modal-confirm-discard');
    await modalHelper.confirmModal();
    
    // Verify changes are discarded
    await expect(page.locator('[data-testid="change-count"]')).toContainText('0');
    
    await screenshotHelper.captureHappyPath('modify-pms', 'discarded_changes');
  });

  test('Can approve change request', async ({ page }) => {
    // Find a submitted change request
    await page.click('[data-testid="select-status-filter"]');
    await page.click('[data-testid="select-option-submitted"]');
    
    await page.waitForLoadState('networkidle');
    
    const hasSubmitted = await page.locator('[data-testid="change-request-item"]').count() > 0;
    
    if (hasSubmitted) {
      // Open first submitted request
      await page.click('[data-testid="change-request-item"]');
      
      // Click approve button (if user has permission)
      const approveButton = page.locator('[data-testid="button-approve"]');
      if (await approveButton.isVisible()) {
        await approveButton.click();
        
        // Add approval notes
        await modalHelper.waitForModal('modal-approve-change');
        await formHelper.fillTextarea('textarea-approval-notes', 'Approved for implementation');
        await modalHelper.confirmModal();
        
        // Verify status changed
        await expect(page.locator('[data-testid="status-badge"]')).toContainText('Approved');
        
        await screenshotHelper.captureHappyPath('modify-pms', 'approved_request');
      }
    }
  });

  test('Can reject change request', async ({ page }) => {
    // Find a submitted change request
    await page.click('[data-testid="select-status-filter"]');
    await page.click('[data-testid="select-option-submitted"]');
    
    await page.waitForLoadState('networkidle');
    
    const hasSubmitted = await page.locator('[data-testid="change-request-item"]').count() > 0;
    
    if (hasSubmitted) {
      // Open first submitted request
      await page.click('[data-testid="change-request-item"]');
      
      // Click reject button (if user has permission)
      const rejectButton = page.locator('[data-testid="button-reject"]');
      if (await rejectButton.isVisible()) {
        await rejectButton.click();
        
        // Add rejection reason
        await modalHelper.waitForModal('modal-reject-change');
        await formHelper.fillTextarea('textarea-rejection-reason', 'Requires further analysis');
        await modalHelper.confirmModal();
        
        // Verify status changed
        await expect(page.locator('[data-testid="status-badge"]')).toContainText('Rejected');
        
        await screenshotHelper.captureHappyPath('modify-pms', 'rejected_request');
      }
    }
  });

  test('Field-level change highlighting works', async ({ page }) => {
    // Enter modify mode
    await page.click('[data-testid="button-new-change-request"]');
    await modalHelper.waitForModal('modal-select-target-type');
    await page.click('[data-testid="radio-target-component"]');
    await modalHelper.confirmModal('button-continue');
    
    await modalHelper.waitForModal('modal-select-component');
    await treeHelper.selectNode('1');
    await modalHelper.confirmModal('button-select');
    
    await page.click('[data-testid="button-enter-modify-mode"]');
    
    // Make a change
    await page.click('[data-testid="field-maker"]');
    const originalValue = await page.locator('[data-testid="input-maker"]').inputValue();
    await formHelper.fillInput('input-maker', 'Changed Manufacturer');
    
    // Verify field is highlighted
    await expect(page.locator('[data-testid="field-maker"]')).toHaveClass(/changed|modified/);
    
    // Hover to see original value
    await page.hover('[data-testid="field-maker"]');
    await expect(page.locator('[data-testid="original-value-tooltip"]')).toContainText(originalValue);
    
    await screenshotHelper.captureHappyPath('modify-pms', 'field_highlighting');
  });
});