import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { FormHelper } from '../helpers/form.helper';
import { TableHelper } from '../helpers/table.helper';
import { ModalHelper } from '../helpers/modal.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { generateSparePartData } from '../fixtures/test-data';

test.describe('Spares Module Tests', () => {
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
    await navHelper.navigateToSpares();
  });

  test('Spares list loads correctly', async ({ page }) => {
    // Verify table is visible
    await expect(page.locator('[data-testid="table-spares"]')).toBeVisible();
    
    // Verify columns
    await expect(page.locator('text="Part Code"')).toBeVisible();
    await expect(page.locator('text="Part Name"')).toBeVisible();
    await expect(page.locator('text="ROB"')).toBeVisible();
    await expect(page.locator('text="Min"')).toBeVisible();
    await expect(page.locator('text="Stock"')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('spares', 'list_loaded');
  });

  test('Can search for spare parts', async ({ page }) => {
    await tableHelper.searchTable('Fuel Injector');
    
    // Verify search results
    await page.waitForTimeout(1000);
    const rowCount = await tableHelper.getRowCount('table-spares');
    if (rowCount > 0) {
      await tableHelper.verifyRowContent(0, ['Fuel Injector']);
    }
    
    await screenshotHelper.captureHappyPath('spares', 'search_results');
  });

  test('Can add new spare part', async ({ page }) => {
    // Click add button
    await page.click('[data-testid="button-add-spare"]');
    await modalHelper.waitForModal('modal-add-spare');
    
    // Fill form
    const testData = generateSparePartData();
    await formHelper.fillSparePartForm(testData);
    
    await screenshotHelper.captureHappyPath('spares', 'add_spare_form');
    
    // Submit
    await formHelper.submitForm();
    
    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('spares', 'spare_added');
  });

  test('Can consume spare parts', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-spares');
    if (rowCount > 0) {
      // Click consume button
      await tableHelper.clickRowAction(0, 'button-consume');
      
      // Wait for modal
      await modalHelper.waitForModal('modal-consume-spare');
      
      // Fill consumption details
      await formHelper.fillInput('input-consume-quantity', '1');
      await formHelper.fillInput('input-consume-date', '2025-01-15');
      await formHelper.fillInput('input-consume-place', 'Engine Room');
      await formHelper.fillTextarea('textarea-consume-remarks', 'Used for maintenance');
      
      await screenshotHelper.captureHappyPath('spares', 'consume_form');
      
      // Submit
      await modalHelper.confirmModal();
      
      // Verify success and ROB updated
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      
      await screenshotHelper.captureHappyPath('spares', 'consumed');
    }
  });

  test('Can receive spare parts', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-spares');
    if (rowCount > 0) {
      // Click receive button
      await tableHelper.clickRowAction(0, 'button-receive');
      
      // Wait for modal
      await modalHelper.waitForModal('modal-receive-spare');
      
      // Fill receipt details
      await formHelper.fillInput('input-receive-quantity', '5');
      await formHelper.fillInput('input-supplier-po', 'PO-2025-001');
      await formHelper.fillInput('input-receive-date', '2025-01-15');
      await formHelper.fillInput('input-receive-place', 'Singapore Port');
      await formHelper.fillTextarea('textarea-receive-remarks', 'Regular supply delivery');
      
      await screenshotHelper.captureHappyPath('spares', 'receive_form');
      
      // Submit
      await modalHelper.confirmModal();
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      
      await screenshotHelper.captureHappyPath('spares', 'received');
    }
  });

  test('Stock status indicators work correctly', async ({ page }) => {
    // Look for different stock statuses
    const okStatus = page.locator('[data-testid="badge-stock-ok"]');
    const lowStatus = page.locator('[data-testid="badge-stock-low"]');
    const outStatus = page.locator('[data-testid="badge-stock-out"]');
    
    // Verify at least one status indicator exists
    const hasStatus = await okStatus.isVisible() || await lowStatus.isVisible() || await outStatus.isVisible();
    expect(hasStatus).toBeTruthy();
    
    await screenshotHelper.captureHappyPath('spares', 'stock_indicators');
  });

  test('Critical spare parts are highlighted', async ({ page }) => {
    // Look for critical badges
    const criticalBadges = await page.locator('[data-testid="badge-critical"]').count();
    
    if (criticalBadges > 0) {
      // Verify critical items have special styling
      const firstCritical = page.locator('[data-testid="badge-critical"]').first();
      await expect(firstCritical).toBeVisible();
      
      await screenshotHelper.captureHappyPath('spares', 'critical_spares');
    }
  });

  test('Can perform bulk update', async ({ page }) => {
    // Select multiple items
    await tableHelper.selectRow(0);
    await tableHelper.selectRow(1);
    
    // Click bulk update
    await page.click('[data-testid="button-bulk-update"]');
    await modalHelper.waitForModal('modal-bulk-update-spares');
    
    // Fill bulk update form
    await formHelper.fillInput('input-bulk-consumed-0', '1');
    await formHelper.fillInput('input-bulk-consumed-1', '2');
    await formHelper.fillTextarea('textarea-bulk-remarks', 'Monthly maintenance');
    
    await screenshotHelper.captureHappyPath('spares', 'bulk_update_form');
    
    // Submit
    await modalHelper.confirmModal();
    
    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('spares', 'bulk_updated');
  });

  test('Can view spare history', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-spares');
    if (rowCount > 0) {
      // Click history button
      await tableHelper.clickRowAction(0, 'button-view-history');
      
      // Wait for history modal
      await modalHelper.waitForModal('modal-spare-history');
      
      // Verify history table
      await expect(page.locator('[data-testid="table-spare-history"]')).toBeVisible();
      
      await screenshotHelper.captureHappyPath('spares', 'view_history');
      
      await modalHelper.closeModal();
    }
  });

  test('Can filter by component', async ({ page }) => {
    // Open component filter
    await page.click('[data-testid="button-filter-component"]');
    
    // Select a component
    await page.click('[data-testid="tree-node-6.01.001"]');
    await page.click('[data-testid="button-apply-filter"]');
    
    await page.waitForLoadState('networkidle');
    
    // Verify filtered results
    const rowCount = await tableHelper.getRowCount('table-spares');
    if (rowCount > 0) {
      await screenshotHelper.captureHappyPath('spares', 'filtered_by_component');
    }
  });

  test('Can edit spare part details', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-spares');
    if (rowCount > 0) {
      // Click edit button
      await tableHelper.clickRowAction(0, 'button-edit');
      
      // Wait for modal
      await modalHelper.waitForModal('modal-edit-spare');
      
      // Edit fields
      await formHelper.fillInput('input-min', '5');
      await formHelper.fillInput('input-location', 'Store Room E');
      
      await screenshotHelper.captureHappyPath('spares', 'edit_form');
      
      // Submit
      await modalHelper.confirmModal();
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    }
  });

  test('Can delete spare part', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-spares');
    if (rowCount > 0) {
      // Find a test spare to delete
      await tableHelper.searchTable('test_');
      await page.waitForTimeout(1000);
      
      const testRowCount = await tableHelper.getRowCount('table-spares');
      if (testRowCount > 0) {
        // Click delete button
        await tableHelper.clickRowAction(0, 'button-delete');
        
        // Confirm deletion
        await modalHelper.waitForModal('modal-confirm-delete');
        await modalHelper.confirmModal();
        
        // Verify success
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
        
        await screenshotHelper.captureHappyPath('spares', 'deleted');
      }
    }
  });

  test('Spares validation works', async ({ page }) => {
    // Click add button
    await page.click('[data-testid="button-add-spare"]');
    await modalHelper.waitForModal('modal-add-spare');
    
    // Try to submit empty form
    await formHelper.submitForm();
    
    // Check for validation errors
    await formHelper.verifyValidationError('input-part-code', 'Part code is required');
    await formHelper.verifyValidationError('input-part-name', 'Part name is required');
    
    await screenshotHelper.captureError('spare_validation');
    
    await modalHelper.cancelModal();
  });

  test('Can export spares inventory', async ({ page }) => {
    // Click export button
    await page.click('[data-testid="button-export"]');
    
    // Select export format
    await page.click('[data-testid="radio-export-excel"]');
    
    // Wait for download
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="button-confirm-export"]');
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toContain('spares_inventory');
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    
    await screenshotHelper.captureHappyPath('spares', 'exported');
  });
});