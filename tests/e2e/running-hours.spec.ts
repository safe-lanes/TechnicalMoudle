import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { FormHelper } from '../helpers/form.helper';
import { TableHelper } from '../helpers/table.helper';
import { ModalHelper } from '../helpers/modal.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { generateRunningHoursData, generateUniqueId } from '../fixtures/test-data';
import { nanoid } from 'nanoid';

test.describe('Running Hours Module - Comprehensive Tests', () => {
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
    await navHelper.navigateToRunningHours();
  });

  test.describe('List Display Verification', () => {
    test('Running hours list displays all required columns', async ({ page }) => {
      // Verify table is visible
      await expect(page.locator('[data-testid="table-running-hours"]')).toBeVisible();
      
      // Verify all required columns are present
      const requiredColumns = [
        'Component',
        'Category', 
        'Running Hours',
        'Last Updated',
        'Utilization Rate'
      ];
      
      for (const column of requiredColumns) {
        await expect(page.locator(`thead th:has-text("${column}")`)).toBeVisible();
      }
      
      // Verify Update RH button is present in each row
      const rowCount = await tableHelper.getRowCount('table-running-hours');
      if (rowCount > 0) {
        const firstRowButton = await page.locator('[data-testid="table-running-hours"] tbody tr').first().locator('[data-testid="button-update-hours"]');
        await expect(firstRowButton).toBeVisible();
      }
      
      await screenshotHelper.captureHappyPath('running-hours', 'list_display_verification');
    });

    test('Can search and filter components', async ({ page }) => {
      // Test search functionality
      await tableHelper.searchTable('Generator');
      await page.waitForTimeout(1000);
      
      // Verify search filters results
      const searchResults = await tableHelper.getRowCount('table-running-hours');
      const rows = page.locator('[data-testid="table-running-hours"] tbody tr');
      
      for (let i = 0; i < searchResults; i++) {
        const rowText = await rows.nth(i).innerText();
        expect(rowText.toLowerCase()).toContain('generator');
      }
      
      await screenshotHelper.captureHappyPath('running-hours', 'search_filter_results');
      
      // Clear search
      await page.fill('[data-testid="input-table-search"]', '');
      await page.waitForTimeout(500);
    });

    test('Can sort by columns', async ({ page }) => {
      // Sort by Running Hours
      const sortButton = page.locator('[data-testid="sort-running-hours"]');
      if (await sortButton.count() > 0) {
        await sortButton.click();
        await page.waitForTimeout(500);
        
        // Verify sort indicator is visible
        await expect(sortButton.locator('svg')).toBeVisible();
        
        // Click again for reverse sort
        await sortButton.click();
        await page.waitForTimeout(500);
        
        await screenshotHelper.captureHappyPath('running-hours', 'sorted_list');
      }
    });

    test('Displays utilization rate correctly', async ({ page }) => {
      // Wait for utilization rates to load
      await page.waitForTimeout(2000);
      
      // Check if utilization rates are displayed
      const utilizationCells = page.locator('[data-testid="table-running-hours"] tbody td:nth-child(5)');
      const count = await utilizationCells.count();
      
      if (count > 0) {
        const firstRate = await utilizationCells.first().innerText();
        // Utilization rate should be either a number with "hrs/day" or "N/A"
        expect(firstRate).toMatch(/(\d+(\.\d+)?\s*hrs\/day|N\/A|Calculating\.\.\.)/);
      }
      
      await screenshotHelper.captureHappyPath('running-hours', 'utilization_rates_display');
    });
  });

  test.describe('Individual Update Operations', () => {
    test('Set Total - Updates running hours with mandatory fields', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-running-hours');
    if (rowCount > 0) {
      // Click update button on first row
      await tableHelper.clickRowAction(0, 'button-update-hours');
      
      // Wait for modal
      await modalHelper.waitForModal('modal-update-running-hours');
      
      // Select set total mode
      await page.click('[data-testid="radio-set-total"]');
      
      // Fill form
      const currentValue = await page.locator('[data-testid="input-current-hours"]').inputValue();
      const newValue = (parseInt(currentValue.replace(/,/g, '')) + 100).toString();
      
      await formHelper.fillInput('input-new-hours', newValue);
      await formHelper.fillInput('input-date-updated', '2025-01-15');
      await formHelper.fillTextarea('textarea-comments', 'Monthly update');
      
      await screenshotHelper.captureHappyPath('running-hours', 'update_set_total');
      
      // Submit
      await modalHelper.confirmModal('button-update');
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      
      await screenshotHelper.captureHappyPath('running-hours', 'updated_success');
    }
  });

  test('Can update running hours - add delta mode', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-running-hours');
    if (rowCount > 0) {
      // Click update button
      await tableHelper.clickRowAction(0, 'button-update-hours');
      
      // Wait for modal
      await modalHelper.waitForModal('modal-update-running-hours');
      
      // Select add delta mode
      await page.click('[data-testid="radio-add-delta"]');
      
      // Fill delta value
      await formHelper.fillInput('input-delta-hours', '24');
      await formHelper.fillInput('input-date-updated', '2025-01-15');
      await formHelper.fillTextarea('textarea-comments', 'Daily run time added');
      
      await screenshotHelper.captureHappyPath('running-hours', 'update_add_delta');
      
      // Submit
      await modalHelper.confirmModal('button-update');
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    }
  });

  test('Can handle meter replacement', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-running-hours');
    if (rowCount > 0) {
      // Click update button
      await tableHelper.clickRowAction(0, 'button-update-hours');
      
      // Wait for modal
      await modalHelper.waitForModal('modal-update-running-hours');
      
      // Check meter replaced
      await formHelper.toggleCheckbox('checkbox-meter-replaced', true);
      
      // Fill meter replacement fields
      await formHelper.fillInput('input-old-meter-final', '25000');
      await formHelper.fillInput('input-new-meter-start', '0');
      await formHelper.fillInput('input-date-updated', '2025-01-15');
      await formHelper.fillTextarea('textarea-comments', 'Meter replaced due to malfunction');
      
      await screenshotHelper.captureHappyPath('running-hours', 'meter_replacement');
      
      // Submit
      await modalHelper.confirmModal('button-update');
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    }
  });

  test('Can perform bulk update', async ({ page }) => {
    // Click bulk update button
    await page.click('[data-testid="button-bulk-update"]');
    
    // Wait for modal
    await modalHelper.waitForModal('modal-bulk-update');
    
    // Select components
    await page.click('[data-testid="checkbox-component-1"]');
    await page.click('[data-testid="checkbox-component-2"]');
    
    // Select update mode
    await page.click('[data-testid="radio-bulk-add-delta"]');
    
    // Enter delta values
    await formHelper.fillInput('input-bulk-delta-1', '10');
    await formHelper.fillInput('input-bulk-delta-2', '15');
    
    await screenshotHelper.captureHappyPath('running-hours', 'bulk_update_form');
    
    // Submit
    await modalHelper.confirmModal('button-bulk-update');
    
    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('running-hours', 'bulk_update_success');
  });

  test('Running hours validation works', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-running-hours');
    if (rowCount > 0) {
      // Click update button
      await tableHelper.clickRowAction(0, 'button-update-hours');
      
      // Wait for modal
      await modalHelper.waitForModal('modal-update-running-hours');
      
      // Try to enter invalid values
      await page.click('[data-testid="radio-set-total"]');
      
      // Enter value less than current
      const currentValue = await page.locator('[data-testid="input-current-hours"]').inputValue();
      const invalidValue = (parseInt(currentValue.replace(/,/g, '')) - 100).toString();
      
      await formHelper.fillInput('input-new-hours', invalidValue);
      await modalHelper.confirmModal('button-update');
      
      // Verify error
      await formHelper.verifyValidationError('input-new-hours', 'New value must be greater than current');
      
      await screenshotHelper.captureError('running_hours_validation');
      
      await modalHelper.cancelModal();
    }
  });

  test('Can view running hours history', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-running-hours');
    if (rowCount > 0) {
      // Click history button
      await tableHelper.clickRowAction(0, 'button-view-history');
      
      // Wait for history modal
      await modalHelper.waitForModal('modal-running-hours-history');
      
      // Verify history table
      await expect(page.locator('[data-testid="table-history"]')).toBeVisible();
      
      await screenshotHelper.captureHappyPath('running-hours', 'view_history');
      
      await modalHelper.closeModal();
    }
  });

  test('Utilization rate displays correctly', async ({ page }) => {
    // Check for utilization rate column
    const hasUtilization = await page.locator('text="Utilization Rate"').isVisible();
    
    if (hasUtilization) {
      // Verify utilization values
      const utilizationCells = await page.locator('[data-testid^="utilization-"]').count();
      if (utilizationCells > 0) {
        await screenshotHelper.captureHappyPath('running-hours', 'utilization_rates');
      }
    }
  });

  test('Can export running hours data', async ({ page }) => {
    // Click export button
    await page.click('[data-testid="button-export"]');
    
    // Wait for download
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="button-confirm-export"]');
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toContain('running_hours');
    expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/);
    
    await screenshotHelper.captureHappyPath('running-hours', 'exported');
  });

  test('Component category filter works', async ({ page }) => {
    // Apply category filter
    await page.click('[data-testid="select-category-filter"]');
    await page.click('[data-testid="select-option-machinery"]');
    
    await page.waitForLoadState('networkidle');
    
    // Verify filtered results
    const rowCount = await tableHelper.getRowCount('table-running-hours');
    if (rowCount > 0) {
      await screenshotHelper.captureHappyPath('running-hours', 'filtered_by_category');
    }
  });

  test('Running hours audit trail is maintained', async ({ page }) => {
    const rowCount = await tableHelper.getRowCount('table-running-hours');
    if (rowCount > 0) {
      // Update hours
      await tableHelper.clickRowAction(0, 'button-update-hours');
      await modalHelper.waitForModal('modal-update-running-hours');
      
      await page.click('[data-testid="radio-add-delta"]');
      await formHelper.fillInput('input-delta-hours', '5');
      await formHelper.fillInput('input-date-updated', '2025-01-15');
      await formHelper.fillTextarea('textarea-comments', 'Test audit trail');
      
      await modalHelper.confirmModal('button-update');
      await page.waitForTimeout(1000);
      
      // View history to verify audit
      await tableHelper.clickRowAction(0, 'button-view-history');
      await modalHelper.waitForModal('modal-running-hours-history');
      
      // Check latest entry
      await expect(page.locator('[data-testid="table-history"]')).toContainText('Test audit trail');
      
      await screenshotHelper.captureHappyPath('running-hours', 'audit_trail');
      
      await modalHelper.closeModal();
    }
  });
});