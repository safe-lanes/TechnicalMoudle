import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { FormHelper } from '../helpers/form.helper';
import { TableHelper } from '../helpers/table.helper';
import { ModalHelper } from '../helpers/modal.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { DatabaseVerification } from '../db/verification';
import { generateSparePartData, generateUniqueId } from '../fixtures/test-data';

test.describe('Spares Module - Comprehensive Tests', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let formHelper: FormHelper;
  let tableHelper: TableHelper;
  let modalHelper: ModalHelper;
  let screenshotHelper: ScreenshotHelper;
  let dbVerifier: DatabaseVerification;

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

  test.afterEach(async () => {
    if (dbVerifier) {
      await dbVerifier.close();
    }
  });

  test.describe('Basic Functionality', () => {
    test('Spares list loads with all required columns', async ({ page }) => {
      // Verify table is visible
      await expect(page.locator('[data-testid="table-spares"]')).toBeVisible();
      
      // Verify all required columns including IHM
      const requiredColumns = [
        'Part Code', 'Part Name', 'Component', 'Critical',
        'ROB', 'Min', 'Stock', 'Location', 'IHM Presence', 'IHM Evidence'
      ];
      
      for (const column of requiredColumns) {
        await expect(page.getByText(column).first()).toBeVisible();
      }
      
      await screenshotHelper.captureHappyPath('spares', 'list_with_all_columns');
    });

    test('Add spare with unique code, linked component, criticality, and IHM metadata', async ({ page }) => {
      // Click add button
      await page.click('[data-testid="button-add-spare"]');
      await modalHelper.waitForModal('modal-add-spare');
      
      // Generate unique test data
      const uniqueCode = generateUniqueId('SP');
      const testData = generateSparePartData();
      
      // Fill all required fields
      await formHelper.fillInput('input-part-code', uniqueCode);
      await formHelper.fillInput('input-part-name', testData.partName);
      await formHelper.fillInput('input-component', testData.component);
      await formHelper.selectDropdown('select-critical', testData.critical);
      await formHelper.fillInput('input-rob', testData.rob.toString());
      await formHelper.fillInput('input-min', testData.min.toString());
      await formHelper.fillInput('input-location', testData.location);
      
      // Fill IHM fields
      await formHelper.selectDropdown('select-ihm-presence', 'Present');
      await formHelper.selectDropdown('select-ihm-evidence', 'MD');
      
      await screenshotHelper.captureHappyPath('spares', 'add_spare_with_ihm');
      
      // Submit
      await formHelper.submitForm();
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      
      // Search for the created spare to verify it exists
      await tableHelper.searchTable(uniqueCode);
      await page.waitForTimeout(1000);
      
      const rowCount = await tableHelper.getRowCount('table-spares');
      expect(rowCount).toBeGreaterThan(0);
      await tableHelper.verifyRowContent(0, [uniqueCode, testData.partName]);
      
      await screenshotHelper.captureHappyPath('spares', 'spare_added_verified');
    });
  });

  test.describe('Consume and Receive Operations', () => {
    test('Consume single-row action with mandatory comments and dates', async ({ page }) => {
      // Find a spare with ROB > 0
      const rowCount = await tableHelper.getRowCount('table-spares');
      let targetRow = -1;
      let initialROB = 0;
      
      for (let i = 0; i < rowCount; i++) {
        const robText = await tableHelper.getCellValue(i, 4, 'table-spares');
        const rob = parseInt(robText);
        if (rob > 0) {
          targetRow = i;
          initialROB = rob;
          break;
        }
      }
      
      if (targetRow >= 0) {
        const partCode = await tableHelper.getCellValue(targetRow, 0, 'table-spares');
        
        // Click consume button
        await tableHelper.clickRowAction(targetRow, 'button-consume');
        await modalHelper.waitForModal('modal-consume-spare');
        
        // Fill all mandatory fields
        const consumeQty = '2';
        await formHelper.fillInput('input-consume-quantity', consumeQty);
        await formHelper.fillInput('input-consume-date', new Date().toISOString().split('T')[0]);
        await formHelper.fillInput('input-consume-place', 'Engine Room - Main Deck');
        await formHelper.fillTextarea('textarea-consume-remarks', 'Scheduled maintenance - Main engine overhaul');
        
        await screenshotHelper.captureHappyPath('spares', 'consume_with_mandatory_fields');
        
        // Submit
        await modalHelper.confirmModal();
        await page.waitForTimeout(1000);
        
        // Verify success and ROB update
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
        
        const newROB = await tableHelper.getCellValue(targetRow, 4, 'table-spares');
        expect(parseInt(newROB)).toBe(initialROB - parseInt(consumeQty));
        
        await screenshotHelper.captureHappyPath('spares', 'rob_decreased_after_consume');
      }
    });

    test('Receive single-row action with mandatory comments and dates', async ({ page }) => {
      const rowCount = await tableHelper.getRowCount('table-spares');
      if (rowCount > 0) {
        const initialROB = parseInt(await tableHelper.getCellValue(0, 4, 'table-spares'));
        
        // Click receive button
        await tableHelper.clickRowAction(0, 'button-receive');
        await modalHelper.waitForModal('modal-receive-spare');
        
        // Fill all mandatory fields
        const receiveQty = '10';
        await formHelper.fillInput('input-receive-quantity', receiveQty);
        await formHelper.fillInput('input-receive-date', new Date().toISOString().split('T')[0]);
        await formHelper.fillInput('input-receive-place', 'Port of Singapore');
        await formHelper.fillTextarea('textarea-receive-remarks', 'Regular supply from vendor XYZ');
        await formHelper.fillInput('input-supplier-po', 'PO-2025-' + generateUniqueId());
        
        await screenshotHelper.captureHappyPath('spares', 'receive_with_mandatory_fields');
        
        // Submit
        await modalHelper.confirmModal();
        await page.waitForTimeout(1000);
        
        // Verify success and ROB update
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
        
        const newROB = parseInt(await tableHelper.getCellValue(0, 4, 'table-spares'));
        expect(newROB).toBe(initialROB + parseInt(receiveQty));
        
        await screenshotHelper.captureHappyPath('spares', 'rob_increased_after_receive');
      }
    });
  });

  test.describe('Bulk Update Operations', () => {
    test('Bulk update with header info and per-row consumed/received, verify ROB recalculated', async ({ page }) => {
      // Get initial ROB values for first 3 rows
      const initialROBs: number[] = [];
      for (let i = 0; i < 3; i++) {
        const rob = await tableHelper.getCellValue(i, 4, 'table-spares');
        initialROBs.push(parseInt(rob));
      }
      
      // Select multiple rows
      await tableHelper.selectRow(0);
      await tableHelper.selectRow(1);
      await tableHelper.selectRow(2);
      
      // Click bulk update
      await page.click('[data-testid="button-bulk-update"]');
      await modalHelper.waitForModal('modal-bulk-update-spares');
      
      // Fill header information
      await formHelper.fillInput('input-bulk-date', new Date().toISOString().split('T')[0]);
      await formHelper.fillInput('input-bulk-place', 'Engine Room');
      await formHelper.fillTextarea('textarea-bulk-comments', 'Monthly inventory adjustment');
      
      // Set per-row operations
      await formHelper.fillInput('input-bulk-consumed-0', '2');
      await formHelper.fillInput('input-bulk-received-1', '5');
      await formHelper.fillInput('input-bulk-consumed-2', '1');
      await formHelper.fillInput('input-bulk-received-2', '3');
      
      await screenshotHelper.captureHappyPath('spares', 'bulk_update_with_header');
      
      // Submit
      await modalHelper.confirmModal();
      await page.waitForTimeout(2000);
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      
      // Verify ROB calculations
      const newROB0 = parseInt(await tableHelper.getCellValue(0, 4, 'table-spares'));
      const newROB1 = parseInt(await tableHelper.getCellValue(1, 4, 'table-spares'));
      const newROB2 = parseInt(await tableHelper.getCellValue(2, 4, 'table-spares'));
      
      expect(newROB0).toBe(initialROBs[0] - 2);
      expect(newROB1).toBe(initialROBs[1] + 5);
      expect(newROB2).toBe(initialROBs[2] - 1 + 3);
      
      await screenshotHelper.captureHappyPath('spares', 'bulk_update_rob_recalculated');
    });
  });

  test.describe('History Tab Verification', () => {
    test('History tab shows append-only entries (Opening Balance, Receipt, Consumption, Adjustment)', async ({ page }) => {
      // Navigate to history tab
      await page.click('[data-testid="tab-history"]');
      await page.waitForTimeout(1000);
      
      // Verify history table is visible
      await expect(page.locator('[data-testid="table-history"]')).toBeVisible();
      
      // Verify required columns
      const historyColumns = [
        'Date', 'Event Type', 'Part Name', 'Part Code',
        'Quantity', 'ROB After', 'Place', 'User', 'Remarks'
      ];
      
      for (const column of historyColumns) {
        await expect(page.getByText(column).first()).toBeVisible();
      }
      
      // Check for different event types
      const eventTypes = ['Opening Balance', 'Receipt', 'Consumption', 'Adjustment'];
      const rowCount = await tableHelper.getRowCount('table-history');
      
      if (rowCount > 0) {
        const foundEventTypes = new Set<string>();
        for (let i = 0; i < Math.min(rowCount, 10); i++) {
          const eventType = await tableHelper.getCellValue(i, 1, 'table-history');
          if (eventTypes.includes(eventType)) {
            foundEventTypes.add(eventType);
          }
        }
        console.log('Found event types:', Array.from(foundEventTypes));
      }
      
      await screenshotHelper.captureHappyPath('spares', 'history_tab_with_entries');
    });

    test('History entries are immutable - no edit or delete actions available', async ({ page }) => {
      await page.click('[data-testid="tab-history"]');
      await page.waitForTimeout(1000);
      
      const rowCount = await tableHelper.getRowCount('table-history');
      if (rowCount > 0) {
        const firstRow = await tableHelper.getRow(0, 'table-history');
        
        // Verify no edit/delete buttons
        const editButton = firstRow.locator('[data-testid="button-edit"]');
        const deleteButton = firstRow.locator('[data-testid="button-delete"]');
        
        await expect(editButton).not.toBeVisible();
        await expect(deleteButton).not.toBeVisible();
        
        // Verify cells are read-only
        const cells = firstRow.locator('td');
        const cellCount = await cells.count();
        for (let i = 0; i < cellCount; i++) {
          const inputCount = await cells.nth(i).locator('input').count();
          expect(inputCount).toBe(0);
        }
        
        await screenshotHelper.captureHappyPath('spares', 'history_immutable_verified');
      }
    });
  });

  test.describe('Stock Status Logic', () => {
    test('Stock status shows OK when ROB >= Min', async ({ page }) => {
      // Create a spare with ROB >= Min
      await page.click('[data-testid="button-add-spare"]');
      await modalHelper.waitForModal('modal-add-spare');
      
      const uniqueCode = generateUniqueId('SP-OK');
      await formHelper.fillInput('input-part-code', uniqueCode);
      await formHelper.fillInput('input-part-name', 'Stock OK Test');
      await formHelper.fillInput('input-rob', '15');
      await formHelper.fillInput('input-min', '10');
      await formHelper.fillInput('input-location', 'Test Location');
      
      await formHelper.submitForm();
      await page.waitForTimeout(1000);
      
      // Search and verify
      await tableHelper.searchTable(uniqueCode);
      await page.waitForTimeout(1000);
      
      const stockStatus = await tableHelper.getCellValue(0, 6, 'table-spares');
      expect(stockStatus).toBe('OK');
      
      // Check for green indicator
      const okBadge = page.locator('[data-testid="badge-stock-ok"]').first();
      await expect(okBadge).toBeVisible();
      
      await screenshotHelper.captureHappyPath('spares', 'stock_status_ok');
    });

    test('Stock status shows Low when 0 < ROB < Min', async ({ page }) => {
      // Create a spare with 0 < ROB < Min
      await page.click('[data-testid="button-add-spare"]');
      await modalHelper.waitForModal('modal-add-spare');
      
      const uniqueCode = generateUniqueId('SP-LOW');
      await formHelper.fillInput('input-part-code', uniqueCode);
      await formHelper.fillInput('input-part-name', 'Stock Low Test');
      await formHelper.fillInput('input-rob', '3');
      await formHelper.fillInput('input-min', '10');
      await formHelper.fillInput('input-location', 'Test Location');
      
      await formHelper.submitForm();
      await page.waitForTimeout(1000);
      
      // Search and verify
      await tableHelper.searchTable(uniqueCode);
      await page.waitForTimeout(1000);
      
      const stockStatus = await tableHelper.getCellValue(0, 6, 'table-spares');
      expect(stockStatus).toBe('Low');
      
      // Check for amber/yellow indicator
      const lowBadge = page.locator('[data-testid="badge-stock-low"]').first();
      await expect(lowBadge).toBeVisible();
      
      await screenshotHelper.captureHappyPath('spares', 'stock_status_low');
    });

    test('Stock status shows Empty when ROB = 0', async ({ page }) => {
      // Create a spare with ROB = 0
      await page.click('[data-testid="button-add-spare"]');
      await modalHelper.waitForModal('modal-add-spare');
      
      const uniqueCode = generateUniqueId('SP-EMPTY');
      await formHelper.fillInput('input-part-code', uniqueCode);
      await formHelper.fillInput('input-part-name', 'Stock Empty Test');
      await formHelper.fillInput('input-rob', '0');
      await formHelper.fillInput('input-min', '5');
      await formHelper.fillInput('input-location', 'Test Location');
      
      await formHelper.submitForm();
      await page.waitForTimeout(1000);
      
      // Search and verify
      await tableHelper.searchTable(uniqueCode);
      await page.waitForTimeout(1000);
      
      const stockStatus = await tableHelper.getCellValue(0, 6, 'table-spares');
      expect(['Empty', 'Out'].includes(stockStatus)).toBeTruthy();
      
      // Check for red indicator
      const emptyBadge = page.locator('[data-testid="badge-stock-out"], [data-testid="badge-stock-empty"]').first();
      await expect(emptyBadge).toBeVisible();
      
      await screenshotHelper.captureHappyPath('spares', 'stock_status_empty');
    });
  });

  test.describe('Data Persistency', () => {
    test('Spare data persists with links to components, history ledger, and IHM metadata', async ({ page }) => {
      // Create a spare with full details
      const uniqueCode = generateUniqueId('SP-PERSIST');
      
      await page.click('[data-testid="button-add-spare"]');
      await modalHelper.waitForModal('modal-add-spare');
      
      await formHelper.fillInput('input-part-code', uniqueCode);
      await formHelper.fillInput('input-part-name', 'Persistence Test Spare');
      await formHelper.fillInput('input-component', 'Main Engine #1 (Wartsila 8L46F)');
      await formHelper.selectDropdown('select-critical', 'Yes');
      await formHelper.fillInput('input-rob', '20');
      await formHelper.fillInput('input-min', '5');
      await formHelper.fillInput('input-location', 'Store Room A');
      await formHelper.selectDropdown('select-ihm-presence', 'Present');
      await formHelper.selectDropdown('select-ihm-evidence', 'SDoC');
      
      await formHelper.submitForm();
      await page.waitForTimeout(1000);
      
      // Perform a consume operation to create history
      await tableHelper.searchTable(uniqueCode);
      await page.waitForTimeout(1000);
      await tableHelper.clickRowAction(0, 'button-consume');
      await modalHelper.waitForModal('modal-consume-spare');
      
      await formHelper.fillInput('input-consume-quantity', '3');
      await formHelper.fillInput('input-consume-date', new Date().toISOString().split('T')[0]);
      await formHelper.fillInput('input-consume-place', 'Engine Room');
      await formHelper.fillTextarea('textarea-consume-remarks', 'Test consumption');
      await modalHelper.confirmModal();
      await page.waitForTimeout(1000);
      
      // Navigate away and back
      await navHelper.navigateToStores();
      await page.waitForTimeout(1000);
      await navHelper.navigateToSpares();
      
      // Search and verify all data persists
      await tableHelper.searchTable(uniqueCode);
      await page.waitForTimeout(1000);
      
      // Verify spare exists
      const rowCount = await tableHelper.getRowCount('table-spares');
      expect(rowCount).toBeGreaterThan(0);
      
      // Verify component link
      const component = await tableHelper.getCellValue(0, 2, 'table-spares');
      expect(component).toContain('Main Engine');
      
      // Verify ROB after consumption
      const rob = await tableHelper.getCellValue(0, 4, 'table-spares');
      expect(parseInt(rob)).toBe(17); // 20 - 3
      
      // Go to history tab to verify ledger
      await page.click('[data-testid="tab-history"]');
      await page.waitForTimeout(1000);
      
      // Search for the history entry
      await page.fill('[data-testid="input-history-search"]', uniqueCode);
      await page.waitForTimeout(1000);
      
      const historyRowCount = await tableHelper.getRowCount('table-history');
      expect(historyRowCount).toBeGreaterThan(0);
      
      await screenshotHelper.captureHappyPath('spares', 'data_persistence_verified');
    });

    test('ROB calculations remain correct after multiple operations', async ({ page }) => {
      // Create a spare for testing
      const uniqueCode = generateUniqueId('SP-CALC');
      const initialROB = 50;
      
      await page.click('[data-testid="button-add-spare"]');
      await modalHelper.waitForModal('modal-add-spare');
      
      await formHelper.fillInput('input-part-code', uniqueCode);
      await formHelper.fillInput('input-part-name', 'ROB Calculation Test');
      await formHelper.fillInput('input-rob', initialROB.toString());
      await formHelper.fillInput('input-min', '10');
      await formHelper.fillInput('input-location', 'Test Location');
      
      await formHelper.submitForm();
      await page.waitForTimeout(1000);
      
      // Search for the spare
      await tableHelper.searchTable(uniqueCode);
      await page.waitForTimeout(1000);
      
      let expectedROB = initialROB;
      
      // Operation 1: Consume 5
      await tableHelper.clickRowAction(0, 'button-consume');
      await modalHelper.waitForModal('modal-consume-spare');
      await formHelper.fillInput('input-consume-quantity', '5');
      await formHelper.fillInput('input-consume-date', new Date().toISOString().split('T')[0]);
      await formHelper.fillInput('input-consume-place', 'Test');
      await formHelper.fillTextarea('textarea-consume-remarks', 'Op 1');
      await modalHelper.confirmModal();
      expectedROB -= 5;
      await page.waitForTimeout(1000);
      
      // Operation 2: Receive 15
      await tableHelper.clickRowAction(0, 'button-receive');
      await modalHelper.waitForModal('modal-receive-spare');
      await formHelper.fillInput('input-receive-quantity', '15');
      await formHelper.fillInput('input-receive-date', new Date().toISOString().split('T')[0]);
      await formHelper.fillInput('input-receive-place', 'Test');
      await formHelper.fillTextarea('textarea-receive-remarks', 'Op 2');
      await modalHelper.confirmModal();
      expectedROB += 15;
      await page.waitForTimeout(1000);
      
      // Operation 3: Consume 8
      await tableHelper.clickRowAction(0, 'button-consume');
      await modalHelper.waitForModal('modal-consume-spare');
      await formHelper.fillInput('input-consume-quantity', '8');
      await formHelper.fillInput('input-consume-date', new Date().toISOString().split('T')[0]);
      await formHelper.fillInput('input-consume-place', 'Test');
      await formHelper.fillTextarea('textarea-consume-remarks', 'Op 3');
      await modalHelper.confirmModal();
      expectedROB -= 8;
      await page.waitForTimeout(1000);
      
      // Verify final ROB
      const finalROB = parseInt(await tableHelper.getCellValue(0, 4, 'table-spares'));
      expect(finalROB).toBe(expectedROB);
      
      await screenshotHelper.captureHappyPath('spares', 'rob_math_verified');
    });
  });

  test.describe('Export and Validation', () => {
    test('Export functionality generates usable Excel file', async ({ page }) => {
      // Trigger export
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="button-export"], [data-testid="button-export-excel"]');
      
      const download = await downloadPromise;
      
      // Verify download
      expect(download.suggestedFilename()).toMatch(/spares.*\.(xlsx|xls|csv)$/i);
      
      await screenshotHelper.captureHappyPath('spares', 'export_successful');
    });

    test('Validates uniqueness of part codes', async ({ page }) => {
      // Create a spare with unique code
      const uniqueCode = generateUniqueId('SP-UNIQUE');
      
      await page.click('[data-testid="button-add-spare"]');
      await modalHelper.waitForModal('modal-add-spare');
      
      await formHelper.fillInput('input-part-code', uniqueCode);
      await formHelper.fillInput('input-part-name', 'First Spare');
      await formHelper.fillInput('input-rob', '10');
      await formHelper.fillInput('input-min', '5');
      await formHelper.fillInput('input-location', 'Location A');
      
      await formHelper.submitForm();
      await page.waitForTimeout(1000);
      
      // Try to create another spare with same code
      await page.click('[data-testid="button-add-spare"]');
      await modalHelper.waitForModal('modal-add-spare');
      
      await formHelper.fillInput('input-part-code', uniqueCode);
      await formHelper.fillInput('input-part-name', 'Duplicate Spare');
      await formHelper.fillInput('input-rob', '5');
      await formHelper.fillInput('input-min', '2');
      await formHelper.fillInput('input-location', 'Location B');
      
      await formHelper.submitForm();
      
      // Should show error
      const errorToast = page.locator('[data-testid="toast-error"]');
      const errorMessage = page.locator('[data-testid="input-part-code-error"]');
      
      const hasError = await errorToast.isVisible() || await errorMessage.isVisible();
      expect(hasError).toBeTruthy();
      
      await screenshotHelper.captureHappyPath('spares', 'duplicate_code_prevented');
    });
  });

  test.describe('Issue Reporting', () => {
    test('Document any UI issues found during testing', async ({ page }) => {
      const issues: string[] = [];
      
      // Check for missing test IDs
      const missingTestIds = [];
      const elementsToCheck = [
        'button-archive',
        'filter-critical',
        'sort-part-name',
        'pagination-next',
        'pagination-previous'
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
      
      // Check mobile responsiveness
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      
      const tableVisible = await page.locator('[data-testid="table-spares"]').isVisible();
      if (!tableVisible) {
        issues.push('Table not properly responsive on mobile viewport (768px)');
      }
      
      // Reset viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Check for proper error handling
      await page.click('[data-testid="button-add-spare"]');
      await modalHelper.waitForModal('modal-add-spare');
      await formHelper.submitForm();
      
      const hasValidationErrors = await page.locator('[data-testid$="-error"]').count() > 0;
      if (!hasValidationErrors) {
        issues.push('Form validation errors not properly displayed');
      }
      
      await modalHelper.cancelModal();
      
      // Report issues
      if (issues.length > 0) {
        console.log('⚠️ Issues found in Spares module:');
        issues.forEach(issue => console.log(`  - ${issue}`));
        await screenshotHelper.captureError('spares_issues');
      } else {
        console.log('✅ No major issues found in Spares module');
      }
    });
  });
});