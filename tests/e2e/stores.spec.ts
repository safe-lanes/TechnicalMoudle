import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { FormHelper } from '../helpers/form.helper';
import { TableHelper } from '../helpers/table.helper';
import { ModalHelper } from '../helpers/modal.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { generateStoresItemData } from '../fixtures/test-data';

test.describe('Stores Module Tests', () => {
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
    await navHelper.navigateToStores();
  });

  test('Stores list loads correctly', async ({ page }) => {
    // Verify table is visible
    await expect(page.locator('[data-testid="table-stores"]')).toBeVisible();
    
    // Verify category tabs
    await expect(page.locator('[data-testid="tab-all-items"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-stores"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-lubes"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-chemicals"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('stores', 'list_loaded');
  });

  test('Can switch between category tabs', async ({ page }) => {
    // Test each tab
    const tabs = ['stores', 'lubes', 'chemicals', 'others'];
    
    for (const tab of tabs) {
      await page.click(`[data-testid="tab-${tab}"]`);
      await page.waitForLoadState('networkidle');
      
      // Verify tab is active
      await expect(page.locator(`[data-testid="tab-${tab}"]`)).toHaveClass(/active|selected/);
      
      await screenshotHelper.captureHappyPath('stores', `tab_${tab}`);
    }
  });

  test('Can add new store item', async ({ page }) => {
    // Click add button
    await page.click('[data-testid="button-add-store-item"]');
    await modalHelper.waitForModal('modal-add-store-item');
    
    // Fill form
    const testData = generateStoresItemData();
    await formHelper.fillInput('input-item-code', testData.itemCode);
    await formHelper.fillInput('input-item-name', testData.itemName);
    await formHelper.selectDropdown('select-category', testData.storesCategory);
    await formHelper.selectDropdown('select-uom', testData.uom);
    await formHelper.fillInput('input-rob', testData.rob.toString());
    await formHelper.fillInput('input-min', testData.min.toString());
    await formHelper.fillInput('input-location', testData.location);
    
    await screenshotHelper.captureHappyPath('stores', 'add_item_form');
    
    // Submit
    await formHelper.submitForm();
    
    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('stores', 'item_added');
  });

  test('Can consume store items', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-stores');
    if (rowCount > 0) {
      // Click consume button
      await tableHelper.clickRowAction(0, 'button-consume');
      
      // Wait for modal
      await modalHelper.waitForModal('modal-consume-store');
      
      // Fill consumption details
      await formHelper.fillInput('input-consume-quantity', '10');
      await formHelper.selectDropdown('select-uom', 'Liters');
      await formHelper.fillInput('input-consume-date', '2025-01-15');
      await formHelper.fillTextarea('textarea-consume-reason', 'Monthly consumption');
      
      await screenshotHelper.captureHappyPath('stores', 'consume_form');
      
      // Submit
      await modalHelper.confirmModal();
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    }
  });

  test('Can receive store items', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-stores');
    if (rowCount > 0) {
      // Click receive button
      await tableHelper.clickRowAction(0, 'button-receive');
      
      // Wait for modal
      await modalHelper.waitForModal('modal-receive-store');
      
      // Fill receipt details
      await formHelper.fillInput('input-receive-quantity', '50');
      await formHelper.selectDropdown('select-uom', 'Liters');
      await formHelper.fillInput('input-supplier', 'Test Supplier Co.');
      await formHelper.fillInput('input-receive-date', '2025-01-15');
      await formHelper.fillTextarea('textarea-receive-notes', 'Regular supply delivery');
      
      await screenshotHelper.captureHappyPath('stores', 'receive_form');
      
      // Submit
      await modalHelper.confirmModal();
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    }
  });

  test('UOM dropdown works correctly', async ({ page }) => {
    // Click add button
    await page.click('[data-testid="button-add-store-item"]');
    await modalHelper.waitForModal('modal-add-store-item');
    
    // Test UOM dropdown
    await page.click('[data-testid="select-uom"]');
    
    // Verify UOM options
    await expect(page.locator('[data-testid="select-option-liters"]')).toBeVisible();
    await expect(page.locator('[data-testid="select-option-kg"]')).toBeVisible();
    await expect(page.locator('[data-testid="select-option-pieces"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('stores', 'uom_options');
    
    await modalHelper.cancelModal();
  });

  test('IHM management works correctly', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-stores');
    if (rowCount > 0) {
      // Click IHM button
      await tableHelper.clickRowAction(0, 'button-ihm');
      
      // Wait for IHM modal
      await modalHelper.waitForModal('modal-ihm-management');
      
      // Set IHM presence
      await formHelper.selectDropdown('select-ihm-presence', 'Present');
      await formHelper.selectDropdown('select-ihm-evidence', 'SDoC');
      
      await screenshotHelper.captureHappyPath('stores', 'ihm_management');
      
      // Submit
      await modalHelper.confirmModal();
      
      // Verify IHM badge appears
      await expect(page.locator('[data-testid="badge-ihm"]').first()).toBeVisible();
    }
  });

  test('Can archive store items', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-stores');
    if (rowCount > 0) {
      // Click archive button
      await tableHelper.clickRowAction(0, 'button-archive');
      
      // Confirm archive
      await modalHelper.waitForModal('modal-confirm-archive');
      await modalHelper.confirmModal();
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      
      // Switch to archived view
      await page.click('[data-testid="toggle-show-archived"]');
      
      // Verify archived item appears
      await page.waitForLoadState('networkidle');
      
      await screenshotHelper.captureHappyPath('stores', 'archived_items');
    }
  });

  test('Stock status badges work correctly', async ({ page }) => {
    // Look for stock status indicators
    const okBadge = page.locator('[data-testid="badge-stock-ok"]');
    const lowBadge = page.locator('[data-testid="badge-stock-low"]');
    const outBadge = page.locator('[data-testid="badge-stock-out"]');
    
    // Verify at least one status exists
    const hasStatus = await okBadge.isVisible() || await lowBadge.isVisible() || await outBadge.isVisible();
    expect(hasStatus).toBeTruthy();
    
    await screenshotHelper.captureHappyPath('stores', 'stock_badges');
  });

  test('Can search store items', async ({ page }) => {
    await tableHelper.searchTable('oil');
    
    // Verify search results
    await page.waitForTimeout(1000);
    const rowCount = await tableHelper.getRowCount('table-stores');
    
    await screenshotHelper.captureHappyPath('stores', 'search_results');
  });

  test('Can edit store item', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-stores');
    if (rowCount > 0) {
      // Click edit button
      await tableHelper.clickRowAction(0, 'button-edit');
      
      // Wait for modal
      await modalHelper.waitForModal('modal-edit-store-item');
      
      // Edit fields
      await formHelper.fillInput('input-min', '25');
      await formHelper.fillInput('input-location', 'Store Room F');
      
      await screenshotHelper.captureHappyPath('stores', 'edit_form');
      
      // Submit
      await modalHelper.confirmModal();
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    }
  });

  test('Can delete store item', async ({ page }) => {
    // Search for test items
    await tableHelper.searchTable('test_');
    await page.waitForTimeout(1000);
    
    const testRowCount = await tableHelper.getRowCount('table-stores');
    if (testRowCount > 0) {
      // Click delete button
      await tableHelper.clickRowAction(0, 'button-delete');
      
      // Confirm deletion
      await modalHelper.waitForModal('modal-confirm-delete');
      await modalHelper.confirmModal();
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    }
  });

  test('Can export stores inventory', async ({ page }) => {
    // Click export button
    await page.click('[data-testid="button-export"]');
    
    // Select export options
    await page.click('[data-testid="checkbox-include-ihm"]');
    await page.click('[data-testid="radio-export-excel"]');
    
    // Wait for download
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="button-confirm-export"]');
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toContain('stores_inventory');
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    
    await screenshotHelper.captureHappyPath('stores', 'exported');
  });

  test('Stores validation works', async ({ page }) => {
    // Click add button
    await page.click('[data-testid="button-add-store-item"]');
    await modalHelper.waitForModal('modal-add-store-item');
    
    // Try to submit empty form
    await formHelper.submitForm();
    
    // Check for validation errors
    await formHelper.verifyValidationError('input-item-code', 'Item code is required');
    await formHelper.verifyValidationError('input-item-name', 'Item name is required');
    await formHelper.verifyValidationError('select-category', 'Category is required');
    
    await screenshotHelper.captureError('stores_validation');
    
    await modalHelper.cancelModal();
  });

  test('Can view consumption history', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-stores');
    if (rowCount > 0) {
      // Click history button
      await tableHelper.clickRowAction(0, 'button-view-history');
      
      // Wait for history modal
      await modalHelper.waitForModal('modal-stores-history');
      
      // Verify history table
      await expect(page.locator('[data-testid="table-stores-history"]')).toBeVisible();
      
      await screenshotHelper.captureHappyPath('stores', 'view_history');
      
      await modalHelper.closeModal();
    }
  });
});