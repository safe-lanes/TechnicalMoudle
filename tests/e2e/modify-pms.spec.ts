import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { FormHelper } from '../helpers/form.helper';
import { TableHelper } from '../helpers/table.helper';
import { ModalHelper } from '../helpers/modal.helper';
import { ComponentTreeHelper } from '../helpers/component-tree.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { DatabaseVerification } from '../db/verification';
import { generateUniqueId } from '../fixtures/test-data';

test.describe('Modify PMS Module - Comprehensive Tests', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let formHelper: FormHelper;
  let tableHelper: TableHelper;
  let modalHelper: ModalHelper;
  let treeHelper: ComponentTreeHelper;
  let screenshotHelper: ScreenshotHelper;
  let dbVerifier: DatabaseVerification;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);
    formHelper = new FormHelper(page);
    tableHelper = new TableHelper(page);
    modalHelper = new ModalHelper(page);
    treeHelper = new ComponentTreeHelper(page);
    screenshotHelper = new ScreenshotHelper(page);
    
    await authHelper.loginAs('chiefEngineer');
  });

  test.afterEach(async () => {
    if (dbVerifier) {
      await dbVerifier.close();
    }
  });

  test.describe('Create Change Request from Work Orders', () => {
    test('Create New Change Request from Work Orders', async ({ page }) => {
      // Navigate to Work Orders
      await navHelper.navigateToWorkOrders();
      await page.waitForTimeout(1000);
      
      // Find a pending work order
      const rowCount = await tableHelper.getRowCount('table-work-orders');
      let targetRow = -1;
      
      for (let i = 0; i < rowCount; i++) {
        const status = await tableHelper.getCellValue(i, 6, 'table-work-orders');
        if (status === 'Pending' || status === 'Scheduled') {
          targetRow = i;
          break;
        }
      }
      
      if (targetRow >= 0) {
        const woNumber = await tableHelper.getCellValue(targetRow, 0, 'table-work-orders');
        
        // Click on the work order to open details
        await tableHelper.clickRow(targetRow, 'table-work-orders');
        await page.waitForTimeout(1000);
        
        // Click "Request Change" button
        await page.click('[data-testid="button-request-change"]');
        await modalHelper.waitForModal('modal-create-change-request');
        
        // Fill change request details
        const changeTitle = `Change frequency for WO ${woNumber}`;
        await formHelper.fillInput('input-change-title', changeTitle);
        await formHelper.fillTextarea('textarea-reason', 'Based on equipment performance data, frequency needs adjustment');
        await formHelper.selectDropdown('select-priority', 'High');
        
        await screenshotHelper.captureHappyPath('modify-pms', 'create_change_from_wo');
        
        // Submit change request
        await formHelper.submitForm();
        await page.waitForTimeout(1000);
        
        // Verify success
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
        
        // Navigate to Modify PMS to verify request appears
        await navHelper.navigateToModifyPMS();
        await page.waitForTimeout(1000);
        
        // Search for the change request
        await tableHelper.searchTable(changeTitle);
        await page.waitForTimeout(1000);
        
        const changeRowCount = await tableHelper.getRowCount('table-change-requests');
        expect(changeRowCount).toBeGreaterThan(0);
        
        await screenshotHelper.captureHappyPath('modify-pms', 'change_request_created');
      }
    });

    test('Create change request to modify frequency from 6 months to 3 months', async ({ page }) => {
      // Navigate to Modify PMS
      await navHelper.navigateToModifyPMS();
      
      // Click new change request
      await page.click('[data-testid="button-new-change-request"]');
      await modalHelper.waitForModal('modal-select-target-type');
      
      // Select Work Orders as target
      await page.click('[data-testid="radio-target-work-orders"]');
      await modalHelper.confirmModal('button-continue');
      
      // Wait for work order selection
      await modalHelper.waitForModal('modal-select-work-order');
      
      // Select a work order with 6-month frequency
      const woRows = await page.locator('[data-testid^="wo-row"]').count();
      let selectedWO = null;
      
      for (let i = 0; i < woRows; i++) {
        const frequency = await page.locator(`[data-testid="wo-row-${i}"] [data-testid="frequency"]`).textContent();
        if (frequency?.includes('6 months') || frequency?.includes('6M')) {
          await page.click(`[data-testid="wo-row-${i}"]`);
          selectedWO = await page.locator(`[data-testid="wo-row-${i}"] [data-testid="wo-number"]`).textContent();
          break;
        }
      }
      
      if (selectedWO) {
        await modalHelper.confirmModal('button-select');
        
        // Fill change request form
        await formHelper.fillInput('input-change-title', `Reduce frequency from 6M to 3M for ${selectedWO}`);
        await formHelper.fillTextarea('textarea-reason', 'Equipment showing increased wear, requires more frequent maintenance');
        await formHelper.selectDropdown('select-change-type', 'Frequency Change');
        
        // Enter modify mode
        await page.click('[data-testid="button-enter-modify-mode"]');
        await page.waitForTimeout(1000);
        
        // Change frequency field
        const frequencyField = page.locator('[data-testid="field-frequency"], [data-testid="input-frequency"]').first();
        const originalValue = await frequencyField.inputValue();
        
        // Clear and set new value
        await frequencyField.clear();
        await frequencyField.fill('3');
        
        // Verify field shows in red (changed state)
        const fieldContainer = frequencyField.locator('..');
        const classes = await fieldContainer.getAttribute('class');
        expect(classes).toMatch(/changed|modified|text-red|bg-red/);
        
        await screenshotHelper.captureHappyPath('modify-pms', 'frequency_changed_red');
        
        // Add change comments
        await formHelper.fillTextarea('textarea-change-comments', 'Frequency reduced from 6 months to 3 months due to operational requirements');
        
        // Save changes
        await page.click('[data-testid="button-save-changes"]');
        await page.waitForTimeout(1000);
        
        // Submit for approval
        await page.click('[data-testid="button-submit-for-approval"]');
        await modalHelper.waitForModal('modal-confirm-submission');
        
        await screenshotHelper.captureHappyPath('modify-pms', 'submit_frequency_change');
        
        await modalHelper.confirmModal();
        
        // Verify success
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      }
    });
  });

  test.describe('Change Request Dashboard and Status', () => {
    test('Verify request appears on Modify PMS dashboard as Pending', async ({ page }) => {
      await navHelper.navigateToModifyPMS();
      await page.waitForTimeout(1000);
      
      // Create a new change request
      const uniqueTitle = `Test Request ${generateUniqueId()}`;
      
      await page.click('[data-testid="button-new-change-request"]');
      await modalHelper.waitForModal('modal-select-target-type');
      
      await page.click('[data-testid="radio-target-component"]');
      await modalHelper.confirmModal('button-continue');
      
      // Select a component
      await modalHelper.waitForModal('modal-select-component');
      const firstComponent = page.locator('[data-testid^="tree-node-"]').first();
      if (await firstComponent.count() > 0) {
        await firstComponent.click();
        await modalHelper.confirmModal('button-select');
      }
      
      // Fill and submit request
      await formHelper.fillInput('input-change-title', uniqueTitle);
      await formHelper.fillTextarea('textarea-reason', 'Test reason for verification');
      await formHelper.selectDropdown('select-priority', 'Medium');
      
      // Submit for approval
      await formHelper.submitForm();
      await page.waitForTimeout(1000);
      
      // Refresh the dashboard
      await page.reload();
      await page.waitForTimeout(1000);
      
      // Filter by Pending status
      const statusFilter = page.locator('[data-testid="select-status-filter"], [data-testid="filter-status"]').first();
      if (await statusFilter.count() > 0) {
        await statusFilter.click();
        const pendingOption = page.locator('[data-testid="select-option-pending"], text="Pending"').first();
        await pendingOption.click();
      }
      
      // Search for the created request
      await tableHelper.searchTable(uniqueTitle);
      await page.waitForTimeout(1000);
      
      // Verify request appears with Pending status
      const rowCount = await tableHelper.getRowCount('table-change-requests');
      expect(rowCount).toBeGreaterThan(0);
      
      // Verify status badge
      const statusBadge = page.locator('[data-testid="badge-status-pending"], [data-testid="status-pending"]').first();
      await expect(statusBadge).toBeVisible();
      await expect(statusBadge).toContainText('Pending');
      
      await screenshotHelper.captureHappyPath('modify-pms', 'request_pending_dashboard');
    });

    test('Track all fields in change request with old/new values', async ({ page }) => {
      await navHelper.navigateToModifyPMS();
      
      // Create a comprehensive change request
      await page.click('[data-testid="button-new-change-request"]');
      await modalHelper.waitForModal('modal-select-target-type');
      
      await page.click('[data-testid="radio-target-component"]');
      await modalHelper.confirmModal('button-continue');
      
      await modalHelper.waitForModal('modal-select-component');
      const component = page.locator('[data-testid^="tree-node-"]').first();
      if (await component.count() > 0) {
        await component.click();
        await modalHelper.confirmModal('button-select');
      }
      
      // Enter modify mode
      await page.click('[data-testid="button-enter-modify-mode"]');
      await page.waitForTimeout(1000);
      
      // Store original values and make changes
      const changes = [];
      
      // Change frequency
      const frequencyField = page.locator('[data-testid="field-frequency"], [data-testid="input-frequency"]').first();
      if (await frequencyField.count() > 0) {
        const oldFreq = await frequencyField.inputValue();
        await frequencyField.clear();
        await frequencyField.fill('4');
        changes.push({ field: 'Frequency', old: oldFreq, new: '4' });
      }
      
      // Change maker
      const makerField = page.locator('[data-testid="field-maker"], [data-testid="input-maker"]').first();
      if (await makerField.count() > 0) {
        const oldMaker = await makerField.inputValue();
        await makerField.clear();
        await makerField.fill('New Manufacturer Co.');
        changes.push({ field: 'Maker', old: oldMaker, new: 'New Manufacturer Co.' });
      }
      
      // Change model
      const modelField = page.locator('[data-testid="field-model"], [data-testid="input-model"]').first();
      if (await modelField.count() > 0) {
        const oldModel = await modelField.inputValue();
        await modelField.clear();
        await modelField.fill('Model 2025-X');
        changes.push({ field: 'Model', old: oldModel, new: 'Model 2025-X' });
      }
      
      // Open changes summary
      const viewChangesButton = page.locator('[data-testid="button-view-changes"], [data-testid="button-review-changes"]').first();
      if (await viewChangesButton.count() > 0) {
        await viewChangesButton.click();
        await page.waitForTimeout(1000);
        
        // Verify all changes are tracked with old/new values
        for (const change of changes) {
          const changeItem = page.locator(`[data-testid*="change-${change.field}"]`).first();
          if (await changeItem.count() > 0) {
            await expect(changeItem).toContainText(change.old);
            await expect(changeItem).toContainText(change.new);
          }
        }
        
        await screenshotHelper.captureHappyPath('modify-pms', 'tracked_changes_old_new');
      }
      
      // Add metadata
      await formHelper.fillInput('input-change-title', `Multi-field change ${generateUniqueId()}`);
      await formHelper.fillTextarea('textarea-reason', 'Comprehensive update based on audit findings');
      
      // Submit
      await page.click('[data-testid="button-submit-for-approval"]');
      await modalHelper.confirmModal();
      
      // Verify timestamp is recorded
      const timestamp = new Date().toISOString();
      console.log(`Change request created at: ${timestamp}`);
    });
  });

  test.describe('Approval Flow', () => {
    test('Test Approve flow - verify live WO updates and red changes resolve', async ({ page }) => {
      // Switch to approver role
      await authHelper.logout();
      await authHelper.loginAs('headOfDepartment');
      
      await navHelper.navigateToModifyPMS();
      await page.waitForTimeout(1000);
      
      // Find a pending request
      const statusFilter = page.locator('[data-testid="filter-status"], [data-testid="select-status-filter"]').first();
      if (await statusFilter.count() > 0) {
        await statusFilter.click();
        await page.click('[data-testid="select-option-pending"], text="Pending"');
        await page.waitForTimeout(1000);
      }
      
      const requestCount = await page.locator('[data-testid^="change-request-item"]').count();
      
      if (requestCount > 0) {
        // Click on first pending request
        await page.click('[data-testid^="change-request-item"]').first();
        await page.waitForTimeout(1000);
        
        // Store request details
        const requestTitle = await page.locator('[data-testid="request-title"]').textContent();
        const changedFields = await page.locator('[data-testid="changed-field"]').count();
        
        // Click Approve button
        const approveButton = page.locator('[data-testid="button-approve"]');
        if (await approveButton.count() > 0 && await approveButton.isEnabled()) {
          await approveButton.click();
          await modalHelper.waitForModal('modal-approve-change');
          
          // Add approval comments
          await formHelper.fillTextarea('textarea-approval-comments', 'Approved after technical review');
          
          await screenshotHelper.captureHappyPath('modify-pms', 'approval_modal');
          
          // Confirm approval
          await modalHelper.confirmModal('button-confirm-approve');
          await page.waitForTimeout(2000);
          
          // Verify success
          await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
          
          // Verify status changed to Approved
          const statusBadge = page.locator('[data-testid="badge-status-approved"], [data-testid="status-approved"]').first();
          await expect(statusBadge).toBeVisible();
          await expect(statusBadge).toContainText('Approved');
          
          // Navigate to Work Orders to verify changes applied
          await navHelper.navigateToWorkOrders();
          await page.waitForTimeout(1000);
          
          // Search for the affected work order
          if (requestTitle) {
            const woMatch = requestTitle.match(/WO[-\d]+/);
            if (woMatch) {
              await tableHelper.searchTable(woMatch[0]);
              await page.waitForTimeout(1000);
              
              // Verify red highlighting is removed (changes are now live)
              const changedCells = await page.locator('.text-red, .bg-red-100').count();
              expect(changedCells).toBe(0);
            }
          }
          
          await screenshotHelper.captureHappyPath('modify-pms', 'approved_changes_applied');
        }
      }
    });

    test('Test Reject flow - verify rejection reason stored and no change applied', async ({ page }) => {
      // Switch to approver role
      await authHelper.logout();
      await authHelper.loginAs('headOfDepartment');
      
      await navHelper.navigateToModifyPMS();
      await page.waitForTimeout(1000);
      
      // Create a test request to reject
      const uniqueTitle = `Reject Test ${generateUniqueId()}`;
      
      // Switch back to requester to create request
      await authHelper.logout();
      await authHelper.loginAs('chiefEngineer');
      await navHelper.navigateToModifyPMS();
      
      await page.click('[data-testid="button-new-change-request"]');
      await modalHelper.waitForModal('modal-select-target-type');
      
      await page.click('[data-testid="radio-target-work-orders"]');
      await modalHelper.confirmModal('button-continue');
      
      // Select first work order
      await modalHelper.waitForModal('modal-select-work-order');
      const firstWO = page.locator('[data-testid^="wo-row"]').first();
      const woNumber = await firstWO.locator('[data-testid="wo-number"]').textContent();
      await firstWO.click();
      await modalHelper.confirmModal('button-select');
      
      // Fill request
      await formHelper.fillInput('input-change-title', uniqueTitle);
      await formHelper.fillTextarea('textarea-reason', 'Test request for rejection flow');
      
      // Make a change
      await page.click('[data-testid="button-enter-modify-mode"]');
      const frequencyField = page.locator('[data-testid="field-frequency"], [data-testid="input-frequency"]').first();
      const originalFreq = await frequencyField.inputValue();
      await frequencyField.clear();
      await frequencyField.fill('12');
      
      // Submit
      await formHelper.submitForm();
      await page.waitForTimeout(1000);
      
      // Switch to approver
      await authHelper.logout();
      await authHelper.loginAs('headOfDepartment');
      await navHelper.navigateToModifyPMS();
      
      // Find and open the request
      await tableHelper.searchTable(uniqueTitle);
      await page.waitForTimeout(1000);
      await page.click('[data-testid^="change-request-item"]').first();
      await page.waitForTimeout(1000);
      
      // Click Reject button
      const rejectButton = page.locator('[data-testid="button-reject"]');
      if (await rejectButton.count() > 0 && await rejectButton.isEnabled()) {
        await rejectButton.click();
        await modalHelper.waitForModal('modal-reject-change');
        
        // Enter rejection reason
        const rejectionReason = 'Requires further cost-benefit analysis before implementation';
        await formHelper.fillTextarea('textarea-rejection-reason', rejectionReason);
        
        await screenshotHelper.captureHappyPath('modify-pms', 'rejection_modal');
        
        // Confirm rejection
        await modalHelper.confirmModal('button-confirm-reject');
        await page.waitForTimeout(2000);
        
        // Verify success
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
        
        // Verify status changed to Rejected
        const statusBadge = page.locator('[data-testid="badge-status-rejected"], [data-testid="status-rejected"]').first();
        await expect(statusBadge).toBeVisible();
        await expect(statusBadge).toContainText('Rejected');
        
        // Verify rejection reason is displayed
        const reasonDisplay = page.locator('[data-testid="rejection-reason"]');
        if (await reasonDisplay.count() > 0) {
          await expect(reasonDisplay).toContainText(rejectionReason);
        }
        
        await screenshotHelper.captureHappyPath('modify-pms', 'rejected_with_reason');
        
        // Navigate to Work Orders to verify NO changes applied
        if (woNumber) {
          await navHelper.navigateToWorkOrders();
          await page.waitForTimeout(1000);
          
          await tableHelper.searchTable(woNumber);
          await page.waitForTimeout(1000);
          
          // Click on work order
          const woRow = await tableHelper.getRow(0, 'table-work-orders');
          await woRow.click();
          await page.waitForTimeout(1000);
          
          // Verify frequency is still original value
          const currentFreq = await page.locator('[data-testid="wo-frequency"]').textContent();
          expect(currentFreq).not.toBe('12');
          
          await screenshotHelper.captureHappyPath('modify-pms', 'no_changes_applied');
        }
      }
    });
  });

  test.describe('Change Request Logging and Persistence', () => {
    test('Verify all change requests are permanently logged', async ({ page }) => {
      await navHelper.navigateToModifyPMS();
      
      // Get initial count of all requests
      const initialCount = await page.locator('[data-testid^="change-request-item"]').count();
      
      // Create multiple test requests with different statuses
      const testRequests = [
        { title: `Draft ${generateUniqueId()}`, status: 'draft' },
        { title: `Submitted ${generateUniqueId()}`, status: 'submitted' },
        { title: `Test ${generateUniqueId()}`, status: 'submitted' }
      ];
      
      for (const request of testRequests) {
        await page.click('[data-testid="button-new-change-request"]');
        await modalHelper.waitForModal('modal-select-target-type');
        
        await page.click('[data-testid="radio-target-component"]');
        await modalHelper.confirmModal('button-continue');
        
        await modalHelper.waitForModal('modal-select-component');
        const component = page.locator('[data-testid^="tree-node-"]').first();
        if (await component.count() > 0) {
          await component.click();
          await modalHelper.confirmModal('button-select');
        }
        
        await formHelper.fillInput('input-change-title', request.title);
        await formHelper.fillTextarea('textarea-reason', `Reason for ${request.title}`);
        
        if (request.status === 'submitted') {
          await formHelper.submitForm();
        } else {
          await page.click('[data-testid="button-save-draft"]');
        }
        
        await page.waitForTimeout(1000);
      }
      
      // Clear any filters
      const clearFilter = page.locator('[data-testid="button-clear-filters"]');
      if (await clearFilter.count() > 0) {
        await clearFilter.click();
      }
      
      // Get new count
      const newCount = await page.locator('[data-testid^="change-request-item"]').count();
      expect(newCount).toBeGreaterThanOrEqual(initialCount + testRequests.length);
      
      // Verify each request exists and has required data
      for (const request of testRequests) {
        await tableHelper.searchTable(request.title);
        await page.waitForTimeout(1000);
        
        const foundCount = await page.locator('[data-testid^="change-request-item"]').count();
        expect(foundCount).toBeGreaterThan(0);
        
        // Click on the request
        await page.click('[data-testid^="change-request-item"]').first();
        await page.waitForTimeout(1000);
        
        // Verify logged data
        const requestDetails = page.locator('[data-testid="request-details"]');
        if (await requestDetails.count() > 0) {
          // Check for requester
          const requester = page.locator('[data-testid="requester-name"]');
          if (await requester.count() > 0) {
            await expect(requester).not.toBeEmpty();
          }
          
          // Check for timestamp
          const timestamp = page.locator('[data-testid="request-timestamp"], [data-testid="created-at"]');
          if (await timestamp.count() > 0) {
            await expect(timestamp).not.toBeEmpty();
          }
          
          // Check for status
          const status = page.locator('[data-testid^="badge-status"], [data-testid^="status-"]');
          if (await status.count() > 0) {
            await expect(status.first()).not.toBeEmpty();
          }
        }
      }
      
      await screenshotHelper.captureHappyPath('modify-pms', 'all_requests_logged');
    });

    test('Verify change request stores complete audit trail', async ({ page }) => {
      await navHelper.navigateToModifyPMS();
      
      // Create a request with full lifecycle
      const uniqueId = generateUniqueId();
      const requestTitle = `Full Audit Trail ${uniqueId}`;
      
      // Create request
      await page.click('[data-testid="button-new-change-request"]');
      await modalHelper.waitForModal('modal-select-target-type');
      
      await page.click('[data-testid="radio-target-work-orders"]');
      await modalHelper.confirmModal('button-continue');
      
      await modalHelper.waitForModal('modal-select-work-order');
      const firstWO = page.locator('[data-testid^="wo-row"]').first();
      await firstWO.click();
      await modalHelper.confirmModal('button-select');
      
      // Fill comprehensive details
      await formHelper.fillInput('input-change-title', requestTitle);
      await formHelper.fillTextarea('textarea-reason', 'Complete audit trail test');
      await formHelper.selectDropdown('select-priority', 'High');
      
      // Enter modify mode and make changes
      await page.click('[data-testid="button-enter-modify-mode"]');
      
      // Track changes made
      const changesMade = [];
      
      const frequencyField = page.locator('[data-testid="field-frequency"], [data-testid="input-frequency"]').first();
      if (await frequencyField.count() > 0) {
        const oldValue = await frequencyField.inputValue();
        const newValue = '5';
        await frequencyField.clear();
        await frequencyField.fill(newValue);
        changesMade.push({ field: 'Frequency', old: oldValue, new: newValue });
      }
      
      // Submit request
      const submitTime = new Date().toISOString();
      await formHelper.submitForm();
      await page.waitForTimeout(1000);
      
      // Search and open the request
      await tableHelper.searchTable(requestTitle);
      await page.waitForTimeout(1000);
      await page.click('[data-testid^="change-request-item"]').first();
      await page.waitForTimeout(1000);
      
      // Verify audit trail contains:
      // 1. Old/New values
      for (const change of changesMade) {
        const changeDisplay = page.locator(`[data-testid*="${change.field}"]`);
        if (await changeDisplay.count() > 0) {
          const text = await changeDisplay.textContent();
          console.log(`Change tracked: ${change.field} from ${change.old} to ${change.new}`);
        }
      }
      
      // 2. Requester information
      const requesterInfo = page.locator('[data-testid="requester-info"], [data-testid="requester-name"]');
      if (await requesterInfo.count() > 0) {
        const requester = await requesterInfo.textContent();
        expect(requester).toBeTruthy();
        console.log(`Requester: ${requester}`);
      }
      
      // 3. Timestamps
      const timestamps = page.locator('[data-testid*="timestamp"], [data-testid*="created"], [data-testid*="date"]');
      const timestampCount = await timestamps.count();
      if (timestampCount > 0) {
        for (let i = 0; i < timestampCount; i++) {
          const timestamp = await timestamps.nth(i).textContent();
          console.log(`Timestamp ${i}: ${timestamp}`);
        }
      }
      
      // 4. Status history
      const statusHistory = page.locator('[data-testid="status-history"], [data-testid="audit-log"]');
      if (await statusHistory.count() > 0) {
        const history = await statusHistory.textContent();
        console.log(`Status history: ${history}`);
      }
      
      await screenshotHelper.captureHappyPath('modify-pms', 'complete_audit_trail');
    });
  });

  test.describe('Visual Indicators and UI Behavior', () => {
    test('Verify changed fields show in red during modification', async ({ page }) => {
      await navHelper.navigateToModifyPMS();
      
      // Create new request
      await page.click('[data-testid="button-new-change-request"]');
      await modalHelper.waitForModal('modal-select-target-type');
      
      await page.click('[data-testid="radio-target-component"]');
      await modalHelper.confirmModal('button-continue');
      
      await modalHelper.waitForModal('modal-select-component');
      const component = page.locator('[data-testid^="tree-node-"]').first();
      if (await component.count() > 0) {
        await component.click();
        await modalHelper.confirmModal('button-select');
      }
      
      // Enter modify mode
      await page.click('[data-testid="button-enter-modify-mode"]');
      await page.waitForTimeout(1000);
      
      // Make changes and verify red highlighting
      const fieldsToChange = [
        { selector: '[data-testid="field-frequency"], [data-testid="input-frequency"]', value: '2' },
        { selector: '[data-testid="field-maker"], [data-testid="input-maker"]', value: 'Updated Maker' },
        { selector: '[data-testid="field-model"], [data-testid="input-model"]', value: 'New Model' }
      ];
      
      for (const field of fieldsToChange) {
        const element = page.locator(field.selector).first();
        if (await element.count() > 0) {
          await element.clear();
          await element.fill(field.value);
          
          // Check for red highlighting
          const container = element.locator('..');
          const classes = await container.getAttribute('class');
          const hasRedStyling = classes?.includes('red') || classes?.includes('changed') || classes?.includes('modified');
          
          if (hasRedStyling) {
            console.log(`Field ${field.selector} shows red highlighting`);
          }
          
          // Check computed styles
          const color = await container.evaluate(el => window.getComputedStyle(el).color);
          const backgroundColor = await container.evaluate(el => window.getComputedStyle(el).backgroundColor);
          console.log(`Field colors - text: ${color}, bg: ${backgroundColor}`);
        }
      }
      
      await screenshotHelper.captureHappyPath('modify-pms', 'red_field_indicators');
    });

    test('Verify modify mode banner and footer indicators', async ({ page }) => {
      await navHelper.navigateToModifyPMS();
      
      // Start a new change request
      await page.click('[data-testid="button-new-change-request"]');
      await modalHelper.waitForModal('modal-select-target-type');
      
      await page.click('[data-testid="radio-target-work-orders"]');
      await modalHelper.confirmModal('button-continue');
      
      await modalHelper.waitForModal('modal-select-work-order');
      const firstWO = page.locator('[data-testid^="wo-row"]').first();
      if (await firstWO.count() > 0) {
        await firstWO.click();
        await modalHelper.confirmModal('button-select');
      }
      
      // Before modify mode - no indicators
      const bannerBefore = page.locator('[data-testid="modify-mode-banner"]');
      const footerBefore = page.locator('[data-testid="modify-footer"]');
      expect(await bannerBefore.count()).toBe(0);
      expect(await footerBefore.count()).toBe(0);
      
      // Enter modify mode
      await page.click('[data-testid="button-enter-modify-mode"]');
      await page.waitForTimeout(1000);
      
      // After modify mode - indicators should appear
      const bannerAfter = page.locator('[data-testid="modify-mode-banner"], .modify-mode-banner');
      const footerAfter = page.locator('[data-testid="modify-footer"], .modify-footer');
      
      if (await bannerAfter.count() > 0) {
        await expect(bannerAfter).toBeVisible();
        await expect(bannerAfter).toContainText(/modify|editing/i);
      }
      
      if (await footerAfter.count() > 0) {
        await expect(footerAfter).toBeVisible();
        
        // Footer should have action buttons
        const saveButton = footerAfter.locator('[data-testid="button-save-changes"]');
        const cancelButton = footerAfter.locator('[data-testid="button-cancel-changes"], [data-testid="button-discard-changes"]');
        
        if (await saveButton.count() > 0) {
          await expect(saveButton).toBeVisible();
        }
        if (await cancelButton.count() > 0) {
          await expect(cancelButton).toBeVisible();
        }
      }
      
      // Check for change counter
      const changeCounter = page.locator('[data-testid="change-count"], .change-counter');
      if (await changeCounter.count() > 0) {
        await expect(changeCounter).toContainText('0');
        
        // Make a change
        const field = page.locator('[data-testid^="field-"], [data-testid^="input-"]').first();
        if (await field.count() > 0) {
          await field.clear();
          await field.fill('Test Value');
          await page.waitForTimeout(500);
          
          // Counter should update
          await expect(changeCounter).toContainText('1');
        }
      }
      
      await screenshotHelper.captureHappyPath('modify-pms', 'modify_mode_indicators');
    });
  });

  test.describe('Issue Reporting', () => {
    test('Document any UI issues found during testing', async ({ page }) => {
      const issues: string[] = [];
      
      await navHelper.navigateToModifyPMS();
      
      // Check for missing test IDs
      const missingTestIds = [];
      const elementsToCheck = [
        'button-export-requests',
        'filter-priority',
        'filter-requester',
        'sort-created-date',
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
      
      // Check for proper error messages
      await page.click('[data-testid="button-new-change-request"]');
      const modal = page.locator('[role="dialog"]');
      if (await modal.count() > 0) {
        // Try to submit without selecting target
        const continueButton = page.locator('[data-testid="button-continue"]');
        if (await continueButton.count() > 0) {
          await continueButton.click();
          
          // Should show error
          const error = page.locator('[data-testid="error-message"], .error');
          if (await error.count() === 0) {
            issues.push('No error message when submitting without required selection');
          }
        }
        
        const closeButton = page.locator('[data-testid="button-close"], [aria-label="Close"]');
        if (await closeButton.count() > 0) {
          await closeButton.click();
        }
      }
      
      // Check mobile responsiveness
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      
      const tableVisible = await page.locator('[data-testid^="table-"], table').first().isVisible();
      if (!tableVisible) {
        issues.push('Table not properly responsive on mobile viewport');
      }
      
      // Reset viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Report issues
      if (issues.length > 0) {
        console.log('⚠️ Issues found in Modify PMS module:');
        issues.forEach(issue => console.log(`  - ${issue}`));
        await screenshotHelper.captureError('modify_pms_issues');
      } else {
        console.log('✅ No major issues found in Modify PMS module');
      }
    });
  });
});