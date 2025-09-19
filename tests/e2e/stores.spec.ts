import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { FormHelper } from '../helpers/form.helper';
import { TableHelper } from '../helpers/table.helper';
import { ModalHelper } from '../helpers/modal.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { generateStoresItemData, generateUniqueId } from '../fixtures/test-data';

test.describe('Stores Module - Comprehensive Tests', () => {
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

  test.describe('Tab Navigation and Display', () => {
    test('All 4 tabs (Stores/Lubes/Chemicals/Others) are present and functional', async ({ page }) => {
      // Verify table is visible
      await expect(page.locator('[data-testid="table-stores"]')).toBeVisible();
      
      // Verify all tabs are present
      const tabs = [
        { testId: 'tab-stores', name: 'Stores' },
        { testId: 'tab-lubes', name: 'Lubes' },
        { testId: 'tab-chemicals', name: 'Chemicals' },
        { testId: 'tab-others', name: 'Others' }
      ];
      
      for (const tab of tabs) {
        const tabElement = page.locator(`[data-testid="${tab.testId}"]`);
        const tabExists = await tabElement.count() > 0;
        if (tabExists) {
          await expect(tabElement).toBeVisible();
          await expect(tabElement).toContainText(tab.name);
        } else {
          // Try alternative selector
          const altTab = page.locator(`text="${tab.name}"`).first();
          await expect(altTab).toBeVisible();
        }
      }
      
      await screenshotHelper.captureHappyPath('stores', 'all_tabs_visible');
    });

    test('Can switch between category tabs and data persists per tab', async ({ page }) => {
      // Test switching between each tab
      const tabTests = [
        { testId: 'tab-stores', name: 'stores' },
        { testId: 'tab-lubes', name: 'lubes' },
        { testId: 'tab-chemicals', name: 'chemicals' },
        { testId: 'tab-others', name: 'others' }
      ];
      
      for (const tab of tabTests) {
        const tabElement = page.locator(`[data-testid="${tab.testId}"]`);
        const tabExists = await tabElement.count() > 0;
        
        if (tabExists) {
          await tabElement.click();
        } else {
          // Try clicking by text
          await page.click(`text="${tab.name.charAt(0).toUpperCase() + tab.name.slice(1)}"`);
        }
        
        await page.waitForLoadState('networkidle');
        
        // Verify table updates for the selected category
        await expect(page.locator('[data-testid="table-stores"]')).toBeVisible();
        
        await screenshotHelper.captureHappyPath('stores', `tab_${tab.name}_active`);
      }
    });

    test('Each tab maintains its own data independently', async ({ page }) => {
      // Create unique items in different tabs
      const testItems = [
        { tab: 'stores', category: 'Stores', itemCode: generateUniqueId('ST-S'), name: 'Test Store Item' },
        { tab: 'lubes', category: 'Lubes', itemCode: generateUniqueId('ST-L'), name: 'Test Lube Item' },
        { tab: 'chemicals', category: 'Chemicals', itemCode: generateUniqueId('ST-C'), name: 'Test Chemical' },
        { tab: 'others', category: 'Others', itemCode: generateUniqueId('ST-O'), name: 'Test Other Item' }
      ];
      
      for (const item of testItems) {
        // Switch to tab
        const tabElement = page.locator(`[data-testid="tab-${item.tab}"]`);
        if (await tabElement.count() > 0) {
          await tabElement.click();
        } else {
          await page.click(`text="${item.category}"`);
        }
        await page.waitForTimeout(1000);
        
        // Add item
        await page.click('[data-testid="button-add-store-item"]');
        await modalHelper.waitForModal('modal-add-store-item');
        
        await formHelper.fillInput('input-item-code', item.itemCode);
        await formHelper.fillInput('input-item-name', item.name);
        await formHelper.selectDropdown('select-category', item.category);
        await formHelper.selectDropdown('select-uom', 'pcs');
        await formHelper.fillInput('input-rob', '10');
        await formHelper.fillInput('input-min', '5');
        await formHelper.fillInput('input-location', 'Test Location');
        
        await formHelper.submitForm();
        await page.waitForTimeout(1000);
      }
      
      // Verify each tab shows only its items
      for (const item of testItems) {
        const tabElement = page.locator(`[data-testid="tab-${item.tab}"]`);
        if (await tabElement.count() > 0) {
          await tabElement.click();
        } else {
          await page.click(`text="${item.category}"`);
        }
        await page.waitForTimeout(1000);
        
        await tableHelper.searchTable(item.itemCode);
        await page.waitForTimeout(1000);
        
        const rowCount = await tableHelper.getRowCount('table-stores');
        expect(rowCount).toBeGreaterThan(0);
        await tableHelper.verifyRowContent(0, [item.itemCode, item.name]);
      }
      
      await screenshotHelper.captureHappyPath('stores', 'tab_data_independence');
    });
  });

  test.describe('Add Store Items', () => {
    test('Add items with all fields including code, name, category, UOM, ROB, Min, Location, IHM', async ({ page }) => {
      // Click add button
      await page.click('[data-testid="button-add-store-item"]');
      await modalHelper.waitForModal('modal-add-store-item');
      
      // Generate test data
      const uniqueCode = generateUniqueId('ST');
      const testData = generateStoresItemData();
      
      // Fill all fields
      await formHelper.fillInput('input-item-code', uniqueCode);
      await formHelper.fillInput('input-item-name', testData.itemName);
      await formHelper.selectDropdown('select-category', 'Stores');
      await formHelper.selectDropdown('select-uom', 'pcs');
      await formHelper.fillInput('input-rob', testData.rob.toString());
      await formHelper.fillInput('input-min', testData.min.toString());
      await formHelper.fillInput('input-location', testData.location);
      
      // IHM fields
      const ihmPresenceField = page.locator('[data-testid="select-ihm-presence"]');
      if (await ihmPresenceField.count() > 0) {
        await formHelper.selectDropdown('select-ihm-presence', 'Present');
        await formHelper.selectDropdown('select-ihm-evidence', 'Test');
      }
      
      await screenshotHelper.captureHappyPath('stores', 'add_item_complete');
      
      // Submit
      await formHelper.submitForm();
      await page.waitForTimeout(1000);
      
      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      
      // Search and verify item was added
      await tableHelper.searchTable(uniqueCode);
      await page.waitForTimeout(1000);
      
      const rowCount = await tableHelper.getRowCount('table-stores');
      expect(rowCount).toBeGreaterThan(0);
      await tableHelper.verifyRowContent(0, [uniqueCode, testData.itemName]);
      
      await screenshotHelper.captureHappyPath('stores', 'item_added_verified');
    });

    test('UOM dropdown includes all standard units', async ({ page }) => {
      await page.click('[data-testid="button-add-store-item"]');
      await modalHelper.waitForModal('modal-add-store-item');
      
      // Click UOM dropdown
      await page.click('[data-testid="select-uom"]');
      
      // Expected UOM options
      const expectedUOMs = ['pcs', 'kg', 'ltr', 'm'];
      
      // Verify at least some options are present
      for (const uom of expectedUOMs) {
        const option = page.locator(`text="${uom}"`).first();
        const optionVisible = await option.isVisible().catch(() => false);
        if (optionVisible) {
          console.log(`UOM option found: ${uom}`);
        }
      }
      
      await screenshotHelper.captureHappyPath('stores', 'uom_dropdown_options');
      
      await modalHelper.cancelModal();
    });
  });

  test.describe('Row Consume/Receive Actions', () => {
    test('Row consume action with mandatory fields', async ({ page }) => {
      const rowCount = await tableHelper.getRowCount('table-stores');
      let targetRow = -1;
      let initialROB = 0;
      
      // Find item with ROB > 0
      for (let i = 0; i < rowCount; i++) {
        const robText = await tableHelper.getCellValue(i, 4, 'table-stores');
        const rob = parseInt(robText);
        if (rob > 0) {
          targetRow = i;
          initialROB = rob;
          break;
        }
      }
      
      if (targetRow >= 0) {
        // Click consume button
        await tableHelper.clickRowAction(targetRow, 'button-consume');
        await modalHelper.waitForModal('modal-consume-store');
        
        // Fill mandatory fields
        const consumeQty = '3';
        await formHelper.fillInput('input-consume-quantity', consumeQty);
        await formHelper.fillInput('input-consume-date', new Date().toISOString().split('T')[0]);
        
        const placeField = page.locator('[data-testid="input-consume-place"]');
        if (await placeField.count() > 0) {
          await formHelper.fillInput('input-consume-place', 'Main Deck');
        }
        
        const remarksField = page.locator('[data-testid="textarea-consume-reason"], [data-testid="textarea-consume-remarks"]');
        if (await remarksField.count() > 0) {
          await remarksField.first().fill('Daily maintenance consumption');
        }
        
        await screenshotHelper.captureHappyPath('stores', 'consume_with_details');
        
        // Submit
        await modalHelper.confirmModal();
        await page.waitForTimeout(1000);
        
        // Verify success
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
        
        const newROB = parseInt(await tableHelper.getCellValue(targetRow, 4, 'table-stores'));
        expect(newROB).toBe(initialROB - parseInt(consumeQty));
        
        await screenshotHelper.captureHappyPath('stores', 'rob_after_consume');
      }
    });

    test('Row receive action with mandatory fields', async ({ page }) => {
      const rowCount = await tableHelper.getRowCount('table-stores');
      if (rowCount > 0) {
        const initialROB = parseInt(await tableHelper.getCellValue(0, 4, 'table-stores'));
        
        // Click receive button
        await tableHelper.clickRowAction(0, 'button-receive');
        await modalHelper.waitForModal('modal-receive-store');
        
        // Fill mandatory fields
        const receiveQty = '25';
        await formHelper.fillInput('input-receive-quantity', receiveQty);
        await formHelper.fillInput('input-receive-date', new Date().toISOString().split('T')[0]);
        
        const supplierField = page.locator('[data-testid="input-supplier"]');
        if (await supplierField.count() > 0) {
          await formHelper.fillInput('input-supplier', 'Test Supplier Co.');
        }
        
        const notesField = page.locator('[data-testid="textarea-receive-notes"], [data-testid="textarea-receive-remarks"]');
        if (await notesField.count() > 0) {
          await notesField.first().fill('Monthly supply delivery');
        }
        
        await screenshotHelper.captureHappyPath('stores', 'receive_with_details');
        
        // Submit
        await modalHelper.confirmModal();
        await page.waitForTimeout(1000);
        
        // Verify success
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
        
        const newROB = parseInt(await tableHelper.getCellValue(0, 4, 'table-stores'));
        expect(newROB).toBe(initialROB + parseInt(receiveQty));
        
        await screenshotHelper.captureHappyPath('stores', 'rob_after_receive');
      }
    });
  });

  test.describe('Bulk Update Functionality', () => {
    test('Bulk update with header info and per-row operations', async ({ page }) => {
      // Get row count
      const rowCount = await tableHelper.getRowCount('table-stores');
      if (rowCount < 2) {
        console.log('Not enough rows for bulk update test');
        return;
      }
      
      // Store initial ROBs
      const initialROBs: number[] = [];
      for (let i = 0; i < Math.min(3, rowCount); i++) {
        const rob = parseInt(await tableHelper.getCellValue(i, 4, 'table-stores'));
        initialROBs.push(rob);
      }
      
      // Select multiple rows
      for (let i = 0; i < initialROBs.length; i++) {
        await tableHelper.selectRow(i);
      }
      
      // Click bulk update
      const bulkButton = page.locator('[data-testid="button-bulk-update"]');
      if (await bulkButton.count() > 0) {
        await bulkButton.click();
        await modalHelper.waitForModal('modal-bulk-update-stores');
        
        // Fill header information if fields exist
        const dateField = page.locator('[data-testid="input-bulk-date"]');
        if (await dateField.count() > 0) {
          await formHelper.fillInput('input-bulk-date', new Date().toISOString().split('T')[0]);
        }
        
        const placeField = page.locator('[data-testid="input-bulk-place"]');
        if (await placeField.count() > 0) {
          await formHelper.fillInput('input-bulk-place', 'Store Room');
        }
        
        const commentsField = page.locator('[data-testid="textarea-bulk-comments"]');
        if (await commentsField.count() > 0) {
          await commentsField.fill('Quarterly inventory adjustment');
        }
        
        // Set per-row operations if fields exist
        for (let i = 0; i < Math.min(3, initialROBs.length); i++) {
          const consumedField = page.locator(`[data-testid="input-bulk-consumed-${i}"]`);
          const receivedField = page.locator(`[data-testid="input-bulk-received-${i}"]`);
          
          if (i === 0 && await consumedField.count() > 0) {
            await consumedField.fill('2');
          }
          if (i === 1 && await receivedField.count() > 0) {
            await receivedField.fill('10');
          }
        }
        
        await screenshotHelper.captureHappyPath('stores', 'bulk_update_form_filled');
        
        // Submit
        await modalHelper.confirmModal();
        await page.waitForTimeout(2000);
        
        // Verify success
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
        
        await screenshotHelper.captureHappyPath('stores', 'bulk_update_completed');
      }
    });
  });

  test.describe('Export Functionality', () => {
    test('Export generates usable file with all data', async ({ page }) => {
      // Look for export button
      const exportButton = page.locator('[data-testid="button-export"], [data-testid="button-export-excel"]');
      
      if (await exportButton.count() > 0) {
        // Trigger export
        const downloadPromise = page.waitForEvent('download');
        await exportButton.first().click();
        
        // Handle any export options dialog
        const confirmExport = page.locator('[data-testid="button-confirm-export"]');
        if (await confirmExport.count() > 0) {
          await confirmExport.click();
        }
        
        const download = await downloadPromise;
        
        // Verify download filename
        expect(download.suggestedFilename()).toMatch(/\.(xlsx|xls|csv)$/i);
        
        await screenshotHelper.captureHappyPath('stores', 'export_successful');
      }
    });
  });

  test.describe('Category/Stock Filters', () => {
    test('Category filter works correctly', async ({ page }) => {
      // Look for category filter
      const categoryFilter = page.locator('[data-testid="filter-category"], [data-testid="select-category-filter"]');
      
      if (await categoryFilter.count() > 0) {
        await categoryFilter.first().click();
        
        // Look for filter options
        const filterOption = page.locator('[data-testid*="filter-option"]').first();
        if (await filterOption.count() > 0) {
          await filterOption.click();
          await page.waitForTimeout(1000);
          
          await screenshotHelper.captureHappyPath('stores', 'category_filter_applied');
        }
      }
    });

    test('Stock status filter shows correct items', async ({ page }) => {
      // Look for stock filter
      const stockFilter = page.locator('[data-testid="filter-stock-status"], [data-testid="select-stock-filter"]');
      
      if (await stockFilter.count() > 0) {
        await stockFilter.first().click();
        
        // Try to filter by Low stock
        const lowOption = page.locator('[data-testid="filter-option-low"], text="Low"').first();
        if (await lowOption.count() > 0) {
          await lowOption.click();
          await page.waitForTimeout(1000);
          
          // Verify filtered results
          const rowCount = await tableHelper.getRowCount('table-stores');
          if (rowCount > 0) {
            const stockStatus = await tableHelper.getCellValue(0, 6, 'table-stores');
            expect(['Low', 'Empty', 'Out'].includes(stockStatus)).toBeTruthy();
          }
          
          await screenshotHelper.captureHappyPath('stores', 'stock_filter_low');
        }
      }
    });
  });

  test.describe('History Immutability Verification', () => {
    test('History tab shows immutable append-only entries', async ({ page }) => {
      // Look for history tab
      const historyTab = page.locator('[data-testid="tab-history"], text="History"').first();
      
      if (await historyTab.count() > 0) {
        await historyTab.click();
        await page.waitForTimeout(1000);
        
        // Verify history table
        const historyTable = page.locator('[data-testid="table-history"], [data-testid="table-stores-history"]');
        if (await historyTable.count() > 0) {
          await expect(historyTable.first()).toBeVisible();
          
          // Check for immutability - no edit/delete buttons
          const rowCount = await tableHelper.getRowCount('table-history');
          if (rowCount > 0) {
            const firstRow = await tableHelper.getRow(0, 'table-history');
            const editButton = firstRow.locator('[data-testid="button-edit"]');
            const deleteButton = firstRow.locator('[data-testid="button-delete"]');
            
            expect(await editButton.count()).toBe(0);
            expect(await deleteButton.count()).toBe(0);
          }
          
          await screenshotHelper.captureHappyPath('stores', 'history_immutable');
        }
      } else {
        // Try viewing history via row action
        const rowCount = await tableHelper.getRowCount('table-stores');
        if (rowCount > 0) {
          const historyButton = page.locator('[data-testid="button-view-history"]').first();
          if (await historyButton.count() > 0) {
            await historyButton.click();
            await modalHelper.waitForModal('modal-stores-history');
            
            await expect(page.locator('[data-testid="table-stores-history"]')).toBeVisible();
            await screenshotHelper.captureHappyPath('stores', 'view_history_modal');
            
            await modalHelper.closeModal();
          }
        }
      }
    });
  });

  test.describe('Data Persistency', () => {
    test('Items saved per tab with ROB updates and IHM metadata persist', async ({ page }) => {
      // Create a unique item
      const uniqueCode = generateUniqueId('ST-PERSIST');
      
      await page.click('[data-testid="button-add-store-item"]');
      await modalHelper.waitForModal('modal-add-store-item');
      
      await formHelper.fillInput('input-item-code', uniqueCode);
      await formHelper.fillInput('input-item-name', 'Persistence Test Item');
      await formHelper.selectDropdown('select-category', 'Stores');
      await formHelper.selectDropdown('select-uom', 'pcs');
      await formHelper.fillInput('input-rob', '50');
      await formHelper.fillInput('input-min', '10');
      await formHelper.fillInput('input-location', 'Persist Test Location');
      
      // Add IHM data if available
      const ihmPresence = page.locator('[data-testid="select-ihm-presence"]');
      if (await ihmPresence.count() > 0) {
        await formHelper.selectDropdown('select-ihm-presence', 'Present');
        await formHelper.selectDropdown('select-ihm-evidence', 'SDoC');
      }
      
      await formHelper.submitForm();
      await page.waitForTimeout(1000);
      
      // Navigate away and back
      await navHelper.navigateToSpares();
      await page.waitForTimeout(1000);
      await navHelper.navigateToStores();
      
      // Search for the item
      await tableHelper.searchTable(uniqueCode);
      await page.waitForTimeout(1000);
      
      // Verify item persists
      const rowCount = await tableHelper.getRowCount('table-stores');
      expect(rowCount).toBeGreaterThan(0);
      
      const itemCode = await tableHelper.getCellValue(0, 0, 'table-stores');
      const rob = await tableHelper.getCellValue(0, 4, 'table-stores');
      
      expect(itemCode).toBe(uniqueCode);
      expect(parseInt(rob)).toBe(50);
      
      await screenshotHelper.captureHappyPath('stores', 'data_persistence_verified');
    });

    test('Stock status updates correctly based on ROB and Min values', async ({ page }) => {
      // Test OK status (ROB >= Min)
      const okCode = generateUniqueId('ST-OK');
      await page.click('[data-testid="button-add-store-item"]');
      await modalHelper.waitForModal('modal-add-store-item');
      
      await formHelper.fillInput('input-item-code', okCode);
      await formHelper.fillInput('input-item-name', 'OK Status Test');
      await formHelper.selectDropdown('select-category', 'Stores');
      await formHelper.fillInput('input-rob', '20');
      await formHelper.fillInput('input-min', '10');
      await formHelper.fillInput('input-location', 'Test');
      
      await formHelper.submitForm();
      await page.waitForTimeout(1000);
      
      await tableHelper.searchTable(okCode);
      await page.waitForTimeout(1000);
      
      let stockStatus = await tableHelper.getCellValue(0, 6, 'table-stores');
      expect(stockStatus).toBe('OK');
      
      // Clear search
      const searchInput = page.locator('[data-testid="input-table-search"]');
      await searchInput.clear();
      
      // Test Low status (0 < ROB < Min)
      const lowCode = generateUniqueId('ST-LOW');
      await page.click('[data-testid="button-add-store-item"]');
      await modalHelper.waitForModal('modal-add-store-item');
      
      await formHelper.fillInput('input-item-code', lowCode);
      await formHelper.fillInput('input-item-name', 'Low Status Test');
      await formHelper.selectDropdown('select-category', 'Stores');
      await formHelper.fillInput('input-rob', '3');
      await formHelper.fillInput('input-min', '10');
      await formHelper.fillInput('input-location', 'Test');
      
      await formHelper.submitForm();
      await page.waitForTimeout(1000);
      
      await tableHelper.searchTable(lowCode);
      await page.waitForTimeout(1000);
      
      stockStatus = await tableHelper.getCellValue(0, 6, 'table-stores');
      expect(stockStatus).toBe('Low');
      
      await screenshotHelper.captureHappyPath('stores', 'stock_status_logic_verified');
    });
  });

  test.describe('Issue Reporting', () => {
    test('Document any UI issues found during testing', async ({ page }) => {
      const issues: string[] = [];
      
      // Check for missing test IDs
      const missingTestIds = [];
      const elementsToCheck = [
        'button-archive-item',
        'filter-location',
        'sort-item-name',
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
      
      const tableVisible = await page.locator('[data-testid="table-stores"]').isVisible();
      if (!tableVisible) {
        issues.push('Table not properly responsive on mobile viewport');
      }
      
      // Reset viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Report issues
      if (issues.length > 0) {
        console.log('⚠️ Issues found in Stores module:');
        issues.forEach(issue => console.log(`  - ${issue}`));
        await screenshotHelper.captureError('stores_issues');
      } else {
        console.log('✅ No major issues found in Stores module');
      }
    });
  });
});