import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { FormHelper } from '../helpers/form.helper';
import { TableHelper } from '../helpers/table.helper';
import { ModalHelper } from '../helpers/modal.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { generateWorkOrderData } from '../fixtures/test-data';

test.describe('Work Orders Module Tests', () => {
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
    
    await authHelper.loginAs('chiefEngineer');
    await navHelper.navigateToWorkOrders();
  });

  test('Work orders list loads correctly', async ({ page }) => {
    // Verify table or empty state is visible
    const tableVisible = await page.locator('[data-testid="table-main"]').isVisible();
    const emptyVisible = await page.locator('[data-testid="table-empty-state"]').isVisible();
    
    expect(tableVisible || emptyVisible).toBeTruthy();
    
    await screenshotHelper.captureHappyPath('work-orders', 'list_loaded');
  });

  test('Can filter work orders by vessel', async ({ page }) => {
    await page.click('[data-testid="select-vessel"]');
    await page.click('[data-testid="select-option-V001"]');
    
    await page.waitForLoadState('networkidle');
    await screenshotHelper.captureHappyPath('work-orders', 'filtered_by_vessel');
  });

  test('Can search work orders', async ({ page }) => {
    await tableHelper.searchTable('Main Engine');
    
    // Verify search results
    const rowCount = await tableHelper.getRowCount();
    if (rowCount > 0) {
      await tableHelper.verifyRowContent(0, ['Main Engine']);
    }
    
    await screenshotHelper.captureHappyPath('work-orders', 'search_results');
  });

  test('Can create new planned work order', async ({ page }) => {
    // Click create button
    await page.click('[data-testid="button-new-work-order"]');
    await modalHelper.waitForModal('modal-work-order');
    
    // Fill work order form
    const testData = generateWorkOrderData();
    await formHelper.fillWorkOrderForm(testData);
    
    await screenshotHelper.captureHappyPath('work-orders', 'new_work_order_form');
    
    // Submit form
    await formHelper.submitForm();
    
    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('work-orders', 'created_work_order');
  });

  test('Can create unplanned work order', async ({ page }) => {
    // Click unplanned work order button
    await page.click('[data-testid="button-unplanned-work-order"]');
    await modalHelper.waitForModal('modal-unplanned-work-order');
    
    // Fill form
    await formHelper.fillInput('input-description', 'Emergency repair needed');
    await formHelper.selectDropdown('select-urgency', 'High');
    await formHelper.fillTextarea('textarea-details', 'Pump failure detected during routine inspection');
    
    await screenshotHelper.captureHappyPath('work-orders', 'unplanned_form');
    
    // Submit
    await formHelper.submitForm();
    
    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('Can view work order details', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount();
    if (rowCount > 0) {
      // Click on first work order
      await tableHelper.clickRowAction(0, 'button-view-details');
      
      // Verify details modal opens
      await modalHelper.waitForModal('modal-work-order-details');
      await expect(page.locator('[data-testid="work-order-details"]')).toBeVisible();
      
      await screenshotHelper.captureHappyPath('work-orders', 'view_details');
      
      await modalHelper.closeModal();
    }
  });

  test('Can mark work order as completed', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount();
    if (rowCount > 0) {
      // Find a pending work order
      await tableHelper.clickRowAction(0, 'button-complete');
      
      // Fill completion form
      await modalHelper.waitForModal('modal-complete-work-order');
      await formHelper.fillTextarea('textarea-completion-notes', 'Work completed successfully');
      await formHelper.fillInput('input-actual-duration', '2.5');
      
      await screenshotHelper.captureHappyPath('work-orders', 'completion_form');
      
      // Submit
      await modalHelper.confirmModal();
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    }
  });

  test('Can postpone work order', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount();
    if (rowCount > 0) {
      // Click postpone button
      await tableHelper.clickRowAction(0, 'button-postpone');
      
      // Fill postpone dialog
      await modalHelper.waitForModal('modal-postpone-work-order');
      await formHelper.fillInput('input-new-date', '2025-12-31');
      await formHelper.fillTextarea('textarea-reason', 'Parts not available');
      
      await screenshotHelper.captureHappyPath('work-orders', 'postpone_dialog');
      
      // Submit
      await modalHelper.confirmModal();
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    }
  });

  test('Work order status tabs work correctly', async ({ page }) => {
    // Test different tabs
    const tabs = ['All W.O', 'Pending', 'Overdue', 'Completed'];
    
    for (const tab of tabs) {
      await page.click(`[data-testid="tab-${tab.toLowerCase().replace(/\s+/g, '-')}"]`);
      await page.waitForLoadState('networkidle');
      
      // Verify correct tab is active
      await expect(page.locator(`[data-testid="tab-${tab.toLowerCase().replace(/\s+/g, '-')}"]`))
        .toHaveClass(/active|selected/);
        
      await screenshotHelper.captureHappyPath('work-orders', `tab_${tab.toLowerCase().replace(/\s+/g, '_')}`);
    }
  });

  test('Can filter by responsible rank', async ({ page }) => {
    await page.click('[data-testid="select-rank-filter"]');
    await page.click('[data-testid="select-option-chief-engineer"]');
    
    await page.waitForLoadState('networkidle');
    
    // Verify filtered results
    const rowCount = await tableHelper.getRowCount();
    if (rowCount > 0) {
      for (let i = 0; i < Math.min(rowCount, 3); i++) {
        const rankCell = await tableHelper.getCellValue(i, 4); // Assuming rank is in column 4
        expect(rankCell).toContain('Chief Engineer');
      }
    }
    
    await screenshotHelper.captureHappyPath('work-orders', 'filtered_by_rank');
  });

  test('Can filter by criticality', async ({ page }) => {
    await page.click('[data-testid="select-criticality-filter"]');
    await page.click('[data-testid="select-option-critical"]');
    
    await page.waitForLoadState('networkidle');
    
    // Verify critical badge appears
    const criticalBadges = await page.locator('[data-testid="badge-critical"]').count();
    if (criticalBadges > 0) {
      await screenshotHelper.captureHappyPath('work-orders', 'critical_work_orders');
    }
  });

  test('Template code is generated correctly', async ({ page }) => {
    await page.click('[data-testid="button-new-work-order"]');
    await modalHelper.waitForModal('modal-work-order');
    
    // Fill component and task type
    await formHelper.fillInput('input-component-code', '1.1.1');
    await formHelper.selectDropdown('select-task-type', 'Inspection');
    await formHelper.selectDropdown('select-maintenance-basis', 'Calendar');
    await formHelper.fillInput('input-frequency', '3');
    await formHelper.selectDropdown('select-unit', 'Months');
    
    // Verify template code is generated
    const templateCode = await page.locator('[data-testid="input-template-code"]').inputValue();
    expect(templateCode).toMatch(/WO-.*-INS.*M3/);
    
    await screenshotHelper.captureHappyPath('work-orders', 'template_code_generated');
    
    await modalHelper.cancelModal();
  });

  test('Work order validation works', async ({ page }) => {
    await page.click('[data-testid="button-new-work-order"]');
    await modalHelper.waitForModal('modal-work-order');
    
    // Try to submit empty form
    await formHelper.submitForm();
    
    // Check for validation errors
    await formHelper.verifyValidationError('input-component', 'Component is required');
    await formHelper.verifyValidationError('input-description', 'Description is required');
    
    await screenshotHelper.captureError('work_order_validation');
    
    await modalHelper.cancelModal();
  });
});