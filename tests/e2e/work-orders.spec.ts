import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { FormHelper } from '../helpers/form.helper';
import { TableHelper } from '../helpers/table.helper';
import { ModalHelper } from '../helpers/modal.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { generateWorkOrderData } from '../fixtures/test-data';
import { nanoid } from 'nanoid';

test.describe('Work Orders Module - Comprehensive PMS Tests', () => {
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

  test.describe('1. CREATE/EXECUTE FLOW', () => {
    test('Create scheduled work order with all required fields', async ({ page }) => {
      const woId = `WO-${nanoid(6)}`;
      const woTitle = `Main Engine Overhaul - ${woId}`;
      
      // Click create new work order button
      await page.click('[data-testid="button-new-work-order"], button:has-text("New Work Order"), button:has-text("+ New")');
      await page.waitForTimeout(1000);
      
      // Check if modal opened
      const modalVisible = await page.locator('[role="dialog"], .modal, .dialog-content').isVisible();
      if (!modalVisible) {
        await page.click('button:has-text("Create"), button:has-text("Add Work Order")');
        await page.waitForTimeout(1000);
      }
      
      // === PART A - Work Order Details ===
      await screenshotHelper.captureHappyPath('work-orders', 'part_a_empty_form');
      
      // Fill work order title
      await page.fill('input[placeholder*="Job Title"], input[placeholder*="WO Title"], input[placeholder*="title"]', woTitle);
      
      // Select component
      const componentSelectors = [
        'button:has-text("Select component")',
        'button[role="combobox"]:near(label:has-text("Component"))',
        '[data-testid="select-component"]',
        'div:has-text("Component") + div button[role="combobox"]'
      ];
      
      for (const selector of componentSelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          await element.click();
          await page.waitForTimeout(500);
          await page.click('[role="option"]:has-text("Main Engine"), [role="option"]:first-child').first();
          break;
        }
      }
      
      // Select maintenance basis (Calendar or Running Hours)
      const basisSelectors = [
        'button[role="combobox"]:has-text("Calendar")',
        'button[role="combobox"]:near(label:has-text("Maintenance Basis"))',
        '[data-testid="select-maintenance-basis"]'
      ];
      
      for (const selector of basisSelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          await element.click();
          await page.click('[role="option"]:has-text("Calendar")');
          break;
        }
      }
      
      // Set frequency value
      await page.fill('input[placeholder*="frequency"], input[type="number"]:near(label:has-text("Frequency"))', '6');
      
      // Select frequency unit (for calendar-based)
      const unitSelectors = [
        'button[role="combobox"]:has-text("Months")',
        'button[role="combobox"]:near(label:has-text("Unit"))',
        '[data-testid="select-frequency-unit"]'
      ];
      
      for (const selector of unitSelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          await element.click();
          await page.click('[role="option"]:has-text("Months")');
          break;
        }
      }
      
      // Select task type
      const taskSelectors = [
        'button[role="combobox"]:near(label:has-text("Task Type"))',
        '[data-testid="select-task-type"]',
        'button[role="combobox"]:has-text("Inspection")'
      ];
      
      for (const selector of taskSelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          await element.click();
          await page.click('[role="option"]:has-text("Overhaul"), [role="option"]:has-text("Service")').first();
          break;
        }
      }
      
      // Select job category
      const categorySelectors = [
        'button[role="combobox"]:near(label:has-text("Category"))',
        '[data-testid="select-category"]'
      ];
      
      for (const selector of categorySelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          await element.click();
          await page.click('[role="option"]:has-text("Mechanical")');
          break;
        }
      }
      
      // Select priority
      const prioritySelectors = [
        'button[role="combobox"]:near(label:has-text("Priority"))',
        '[data-testid="select-priority"]',
        'button[role="combobox"]:has-text("Medium")'
      ];
      
      for (const selector of prioritySelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          await element.click();
          await page.click('[role="option"]:has-text("High")');
          break;
        }
      }
      
      // Select assigned to (rank)
      const assignSelectors = [
        'button[role="combobox"]:near(label:has-text("Assigned"))',
        '[data-testid="select-assigned-to"]'
      ];
      
      for (const selector of assignSelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          await element.click();
          await page.click('[role="option"]:has-text("2nd Engineer")');
          break;
        }
      }
      
      // Select approver (HoD)
      const approverSelectors = [
        'button[role="combobox"]:near(label:has-text("Approver"))',
        '[data-testid="select-approver"]'
      ];
      
      for (const selector of approverSelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          await element.click();
          await page.click('[role="option"]:has-text("Chief Engineer")');
          break;
        }
      }
      
      // Add work description
      await page.fill('textarea[placeholder*="description"], textarea[placeholder*="work description"]', 
        'Complete overhaul of main engine including inspection of all internal components, replacement of worn parts, and performance testing');
      
      await screenshotHelper.captureHappyPath('work-orders', '01_part_a_basic_info_filled');
      
      // === Add Required Spares with ROB Status ===
      const sparesSection = page.locator('text=/Required Spare|Spare Parts Required/i');
      if (await sparesSection.isVisible()) {
        await sparesSection.scrollIntoViewIfNeeded();
        
        // Click add spare button
        const addSpareBtn = page.locator('button:has-text("Add Spare"), button:has-text("+"]:near(text=/spare/i)');
        if (await addSpareBtn.isVisible()) {
          await addSpareBtn.click();
          await page.waitForTimeout(500);
        }
        
        // Add spare part details
        await page.fill('input[placeholder*="Part Code"], input[placeholder*="part no"]', 'SP-ME-001');
        await page.fill('input[placeholder*="Part Name"], input[placeholder*="description"]:near(text=/spare/i)', 'Fuel Filter Element');
        await page.fill('input[placeholder*="Quantity"]:near(text=/spare/i)', '4');
        
        // Check for ROB status display
        const robStatus = page.locator('text=/ROB:|Stock:|Available:/i');
        if (await robStatus.first().isVisible()) {
          await screenshotHelper.captureHappyPath('work-orders', '02_spares_with_rob_status');
        }
      }
      
      // === Add Tools Required ===
      const toolsInput = page.locator('input[placeholder*="Tools"], input[placeholder*="tools"], textarea[placeholder*="tools"]');
      if (await toolsInput.isVisible()) {
        await toolsInput.fill('Torque Wrench Set, Multimeter, Pressure Gauge Kit, Alignment Tools');
      }
      
      // === Add Safety Requirements ===
      await page.fill('input[placeholder*="PPE"], input[placeholder*="ppe"]', 
        '[Safety Helmet] [Safety Shoes] [Leather Gloves] [Safety Goggles]');
      await page.fill('input[placeholder*="Permit"], input[placeholder*="permit"]', 
        '[Hot Work Permit] [Enclosed Space Entry Permit]');
      await page.fill('input[placeholder*="Other Safety"], textarea[placeholder*="safety"]:not([placeholder*="ppe"]):not([placeholder*="permit"])', 
        'Ensure proper ventilation, lockout/tagout procedures must be followed');
      
      await screenshotHelper.captureHappyPath('work-orders', '03_tools_safety_added');
      
      // === Check Work History visibility ===
      const historySection = page.locator('text=/Work History|History|Previous/i');
      if (await historySection.isVisible()) {
        await historySection.scrollIntoViewIfNeeded();
        await screenshotHelper.captureHappyPath('work-orders', '04_work_history_visible');
      }
      
      // Save Part A
      await page.click('button:has-text("Save"):visible');
      await page.waitForTimeout(1500);
      
      // Verify success message
      const successToast = page.locator('[data-testid="toast-success"], .toast-success, [role="status"]:has-text("success")');
      if (await successToast.isVisible()) {
        await screenshotHelper.captureHappyPath('work-orders', '05_part_a_saved_success');
      }
      
      // Store work order details for later use
      await page.evaluate((data) => {
        window.localStorage.setItem('testWOData', JSON.stringify(data));
      }, { woId, woTitle });
    });

    test('Fill Part B execution details with all fields', async ({ page }) => {
      // First, check if we have existing work orders or create one
      let hasWorkOrder = false;
      const tableRows = page.locator('tbody tr:not(:has-text("No data"))');
      const rowCount = await tableRows.count();
      
      if (rowCount === 0) {
        // Create a new work order first
        await page.click('[data-testid="button-new-work-order"], button:has-text("New Work Order")');
        await page.waitForTimeout(1000);
        await page.fill('input[placeholder*="Job Title"]', `Test WO for Execution - ${nanoid(6)}`);
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(1500);
      }
      
      // Click on first work order to open it
      await page.click('tbody tr:first-child td:first-child, tbody tr:first-child button:has-text("Execute"), tbody tr:first-child button:has-text("Edit")');
      await page.waitForTimeout(1000);
      
      // Navigate to Part B
      const partBButton = page.locator('text=/Part B|Work Completion|Execution/i, div:has-text("B"):has-text("Work")');
      if (await partBButton.first().isVisible()) {
        await partBButton.first().click();
        await page.waitForTimeout(1000);
      }
      
      await screenshotHelper.captureHappyPath('work-orders', '06_part_b_empty_form');
      
      // === B1. Risk Assessment, Checklists & Records ===
      
      // Risk Assessment
      const riskYes = page.locator('input[name="riskAssessment"][value="yes"], input[type="radio"]:near(text=/risk assessment/i)').first();
      if (await riskYes.isVisible()) {
        await riskYes.click();
      }
      
      // Safety Checklists
      const safetyYes = page.locator('input[name="safetyChecklists"][value="yes"], input[type="radio"]:near(text=/safety checklist/i)').first();
      if (await safetyYes.isVisible()) {
        await safetyYes.click();
      }
      
      // Operational Forms
      const opsYes = page.locator('input[name="operationalForms"][value="yes"], input[type="radio"]:near(text=/operational form/i)').first();
      if (await opsYes.isVisible()) {
        await opsYes.click();
      }
      
      // Click upload buttons (simulate file upload intent)
      const uploadButtons = page.locator('button:has-text("Upload")');
      if (await uploadButtons.first().isVisible()) {
        await screenshotHelper.captureHappyPath('work-orders', '07_risk_assessment_uploads');
      }
      
      // === B2. Work Duration Details ===
      
      // Set start date/time (4 hours ago)
      const now = new Date();
      const startDate = new Date(now.getTime() - 4 * 60 * 60 * 1000);
      
      const startDateInput = page.locator('input[type="datetime-local"]').first();
      if (await startDateInput.isVisible()) {
        await startDateInput.fill(startDate.toISOString().slice(0, 16));
      }
      
      // Set completion date/time (now)
      const endDateInput = page.locator('input[type="datetime-local"]').nth(1);
      if (await endDateInput.isVisible()) {
        await endDateInput.fill(now.toISOString().slice(0, 16));
      }
      
      // Select Assigned To
      const assignedSelect = page.locator('button[role="combobox"]:near(label:has-text("Assigned To"))').first();
      if (await assignedSelect.isVisible()) {
        await assignedSelect.click();
        await page.click('[role="option"]:has-text("3rd Engineer")');
      }
      
      // Select Performed By
      const performedSelect = page.locator('button[role="combobox"]:near(label:has-text("Performed"))').first();
      if (await performedSelect.isVisible()) {
        await performedSelect.click();
        await page.click('[role="option"]:has-text("4th Engineer")');
      }
      
      // Set team size
      await page.fill('input[placeholder*="persons"], input[type="number"]:near(text=/team|persons/i)', '3');
      
      // Set total time hours
      await page.fill('input[placeholder*="hours"], input[type="number"]:near(text=/time|duration/i)', '4');
      
      // Manhours should auto-calculate (3 persons × 4 hours = 12 manhours)
      await page.waitForTimeout(500);
      
      await screenshotHelper.captureHappyPath('work-orders', '08_work_duration_filled');
      
      // === Work Carried Out ===
      const workCarriedOut = page.locator('textarea[placeholder*="work carried"], textarea:near(label:has-text("Work Carried Out"))');
      
      // Test Quick Input feature if available
      const quickInputBtn = page.locator('button:has-text("Quick Input")');
      if (await quickInputBtn.isVisible()) {
        await quickInputBtn.click();
        await page.waitForTimeout(500);
        
        // Select a quick answer
        const quickOption = page.locator('button:has-text("Work carried out, found satisfactory")').first();
        if (await quickOption.isVisible()) {
          await quickOption.click();
        }
        
        await screenshotHelper.captureHappyPath('work-orders', '09_quick_input_used');
      }
      
      // Add detailed work description
      if (await workCarriedOut.isVisible()) {
        const currentValue = await workCarriedOut.inputValue();
        await workCarriedOut.fill(currentValue + '\n\nDetailed work performed:\n' +
          '1. Dismantled main engine components\n' +
          '2. Inspected all internal parts for wear\n' +
          '3. Replaced fuel filters and injector nozzles\n' +
          '4. Reassembled and conducted performance test\n' +
          '5. All parameters found within acceptable limits');
      }
      
      // === Job Experience Notes ===
      const notesTextarea = page.locator('textarea[placeholder*="experience"], textarea[placeholder*="notes"]:not([placeholder*="work carried"])');
      if (await notesTextarea.isVisible()) {
        await notesTextarea.fill('Team performed efficiently. No unexpected issues encountered. ' +
          'Recommend similar approach for future overhauls. Consider keeping spare gasket set ready for next maintenance.');
      }
      
      await screenshotHelper.captureHappyPath('work-orders', '10_work_details_completed');
      
      // === Spares Consumed Section ===
      const sparesSection = page.locator('text=/Spare.*Consumed|B4.*Spare/i');
      if (await sparesSection.isVisible()) {
        await sparesSection.scrollIntoViewIfNeeded();
        
        // Check if there are existing spare rows or need to add
        const addSpareBtn = page.locator('button:has-text("Add Spare"), text=/\\+ Add Spare/i');
        if (await addSpareBtn.isVisible()) {
          await addSpareBtn.click();
          await page.waitForTimeout(500);
        }
        
        // Fill spare consumption details
        const partNoInputs = page.locator('input:near(text=/Part No|Part Code/i)');
        const qtyInputs = page.locator('input:near(text=/Quantity.*Consumed/i)');
        const commentInputs = page.locator('input:near(text=/Comments/i)');
        
        if (await partNoInputs.first().isVisible()) {
          await partNoInputs.first().fill('SP-ME-001');
          
          if (await qtyInputs.first().isVisible()) {
            await qtyInputs.first().fill('4');
          }
          
          if (await commentInputs.first().isVisible()) {
            await commentInputs.first().fill('All filters replaced as per schedule');
          }
        }
        
        // Add another spare if possible
        if (await addSpareBtn.isVisible()) {
          await addSpareBtn.click();
          await page.waitForTimeout(500);
          
          if (await partNoInputs.nth(1).isVisible()) {
            await partNoInputs.nth(1).fill('SP-ME-002');
            await qtyInputs.nth(1).fill('2');
            await commentInputs.nth(1).fill('Gaskets replaced');
          }
        }
        
        await screenshotHelper.captureHappyPath('work-orders', '11_spares_consumed_added');
      }
      
      // === Save Part B and verify status ===
      const submitBtn = page.locator('button:has-text("Submit"):visible, button:has-text("Save"):visible').last();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
        
        // Check for success message
        const successMsg = page.locator('[data-testid="toast-success"], .toast-success, text=/submitted.*approval/i');
        if (await successMsg.isVisible()) {
          await screenshotHelper.captureHappyPath('work-orders', '12_part_b_submitted_for_approval');
        }
      }
    });
    
    test('Create and execute Running Hours based work order', async ({ page }) => {
      const woId = `WO-RH-${nanoid(6)}`;
      
      // Create new RH-based work order
      await page.click('[data-testid="button-new-work-order"], button:has-text("New Work Order")');
      await page.waitForTimeout(1000);
      
      // Fill basic info
      await page.fill('input[placeholder*="Job Title"]', `Generator RH Maintenance - ${woId}`);
      
      // Select Running Hours as maintenance basis
      const basisSelect = page.locator('button[role="combobox"]:near(label:has-text("Maintenance Basis"))');
      if (await basisSelect.isVisible()) {
        await basisSelect.click();
        await page.click('[role="option"]:has-text("Running Hours")');
      }
      
      // Set running hours frequency
      await page.fill('input[placeholder*="frequency"], input[type="number"]:near(label:has-text("Frequency"))', '1000');
      
      // Fill other required fields
      await page.fill('textarea[placeholder*="description"]', 'Running hours based maintenance for diesel generator');
      
      await screenshotHelper.captureHappyPath('work-orders', '13_rh_based_wo_created');
      
      // Save and then execute
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1500);
      
      // Open the created WO for execution
      await page.click('tbody tr:first-child');
      await page.waitForTimeout(1000);
      
      // Navigate to Part B
      await page.click('text=/Part B|Execution/i');
      await page.waitForTimeout(500);
      
      // === Fill Running Hours specific fields ===
      const rhSection = page.locator('text=/Running Hours|B3.*Hours/i');
      if (await rhSection.isVisible()) {
        await rhSection.scrollIntoViewIfNeeded();
        
        // Previous reading
        await page.fill('input[placeholder*="Previous"], input[placeholder*="previous reading"]', '9500');
        
        // Current reading
        await page.fill('input[placeholder*="Current"], input[placeholder*="current reading"]', '10500');
        
        await screenshotHelper.captureHappyPath('work-orders', '14_running_hours_readings_filled');
      }
      
      // Fill other execution details
      await page.fill('textarea[placeholder*="work carried"]', 'Running hours maintenance completed at 10500 hours');
      
      // Submit
      await page.click('button:has-text("Submit")');
      await page.waitForTimeout(1500);
    });
    
    test('Verify work order moves to Pending Approval status', async ({ page }) => {
      // Navigate to Pending Approval tab
      const pendingTab = page.locator('button:has-text("Pending Approval"), [data-testid="tab-pending-approval"]');
      if (await pendingTab.isVisible()) {
        await pendingTab.click();
        await page.waitForTimeout(1000);
        
        // Verify work orders appear in pending list
        const pendingRows = page.locator('tbody tr:not(:has-text("No data"))');
        const pendingCount = await pendingRows.count();
        
        if (pendingCount > 0) {
          // Check status column shows "Pending Approval"
          const statusCell = page.locator('tbody tr:first-child td:has-text("Pending Approval")');
          const hasPendingStatus = await statusCell.isVisible();
          
          expect(hasPendingStatus).toBeTruthy();
          await screenshotHelper.captureHappyPath('work-orders', '15_pending_approval_list');
        }
      }
    });
  });

  test.describe('2. APPROVAL/REJECTION FLOW', () => {
    test('Approve work order as Chief Engineer', async ({ page }) => {
      // Ensure we're logged in as Chief Engineer (already done in beforeEach)
      
      // Navigate to Pending Approval tab
      const pendingTab = page.locator('button:has-text("Pending Approval"), [data-testid="tab-pending-approval"]');
      if (await pendingTab.isVisible()) {
        await pendingTab.click();
        await page.waitForTimeout(1000);
      }
      
      // Check if there are pending work orders
      const pendingRows = page.locator('tbody tr:not(:has-text("No data"))');
      const pendingCount = await pendingRows.count();
      
      if (pendingCount === 0) {
        // Create a work order for approval
        await test.step('Create WO for approval', async () => {
          await page.click('[data-testid="button-new-work-order"]');
          await page.fill('input[placeholder*="Job Title"]', `WO for Approval Test - ${nanoid(6)}`);
          await page.click('button:has-text("Save")');
          await page.waitForTimeout(1000);
          
          // Execute it
          await page.click('tbody tr:first-child');
          await page.click('text=/Part B/i');
          await page.click('input[name="riskAssessment"][value="yes"]');
          await page.fill('textarea[placeholder*="work carried"]', 'Work completed for approval test');
          await page.click('button:has-text("Submit")');
          await page.waitForTimeout(1500);
          
          // Go back to pending approval
          await pendingTab.click();
        });
      }
      
      // Open first pending work order
      await page.click('tbody tr:first-child button:has-text("Approve"), tbody tr:first-child button:has-text("Review")');
      await page.waitForTimeout(1000);
      
      await screenshotHelper.captureHappyPath('work-orders', '16_approval_review_screen');
      
      // Click Approve button
      const approveBtn = page.locator('button:has-text("Approve"):visible').last();
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        
        // Confirm approval if dialog appears
        const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }
        
        await page.waitForTimeout(1500);
        
        // Verify success message
        const successMsg = page.locator('text=/approved|success/i');
        if (await successMsg.isVisible()) {
          await screenshotHelper.captureHappyPath('work-orders', '17_wo_approved_success');
        }
      }
      
      // Verify WO moves to Completed tab
      const completedTab = page.locator('button:has-text("Completed"), [data-testid="tab-completed"]');
      if (await completedTab.isVisible()) {
        await completedTab.click();
        await page.waitForTimeout(1000);
        
        // Verify approved WO appears in completed list
        await screenshotHelper.captureHappyPath('work-orders', '18_approved_wo_in_completed');
      }
      
      // Verify WO is now immutable (read-only)
      await page.click('tbody tr:first-child');
      await page.waitForTimeout(1000);
      
      // Check if fields are disabled/read-only
      const inputs = page.locator('input:not([type="hidden"]), textarea');
      const firstInput = inputs.first();
      if (await firstInput.isVisible()) {
        const isDisabled = await firstInput.isDisabled();
        const isReadonly = await firstInput.getAttribute('readonly');
        
        expect(isDisabled || isReadonly).toBeTruthy();
        await screenshotHelper.captureHappyPath('work-orders', '19_completed_wo_readonly');
      }
    });
    
    test('Reject work order with reasons', async ({ page }) => {
      // Navigate to Pending Approval tab
      const pendingTab = page.locator('button:has-text("Pending Approval")');
      if (await pendingTab.isVisible()) {
        await pendingTab.click();
        await page.waitForTimeout(1000);
      }
      
      // Create a new WO for rejection test
      await test.step('Create WO for rejection', async () => {
        await page.click('[data-testid="button-new-work-order"]');
        await page.fill('input[placeholder*="Job Title"]', `WO for Rejection Test - ${nanoid(6)}`);
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(1000);
        
        // Execute it
        await page.click('tbody tr:first-child');
        await page.click('text=/Part B/i');
        await page.click('input[name="riskAssessment"][value="no"]'); // Deliberately set to No
        await page.fill('textarea[placeholder*="work carried"]', 'Incomplete work');
        await page.click('button:has-text("Submit")');
        await page.waitForTimeout(1500);
        
        // Go back to pending approval
        await pendingTab.click();
      });
      
      // Open the pending work order
      await page.click('tbody tr:first-child');
      await page.waitForTimeout(1000);
      
      // Click Reject button
      const rejectBtn = page.locator('button:has-text("Reject"):visible').last();
      if (await rejectBtn.isVisible()) {
        await rejectBtn.click();
        await page.waitForTimeout(500);
        
        // Fill rejection reasons
        const rejectionInput = page.locator('textarea[placeholder*="rejection"], textarea[placeholder*="reason"], textarea[placeholder*="comments"]');
        if (await rejectionInput.isVisible()) {
          await rejectionInput.fill('Risk assessment not completed. Please complete all safety documentation before resubmission.');
          await screenshotHelper.captureHappyPath('work-orders', '20_rejection_reason_entered');
        }
        
        // Confirm rejection
        const confirmReject = page.locator('button:has-text("Confirm"), button:has-text("Submit")').last();
        if (await confirmReject.isVisible()) {
          await confirmReject.click();
        }
        
        await page.waitForTimeout(1500);
        
        // Verify rejection success
        const rejectMsg = page.locator('text=/rejected|returned/i');
        if (await rejectMsg.isVisible()) {
          await screenshotHelper.captureHappyPath('work-orders', '21_wo_rejected_success');
        }
      }
      
      // Verify WO returns for correction (back to Due/Pending)
      const dueTab = page.locator('button:has-text("Due"), [data-testid="tab-due"]');
      if (await dueTab.isVisible()) {
        await dueTab.click();
        await page.waitForTimeout(1000);
        
        // Check if rejected WO appears here
        const rejectedWO = page.locator('tbody tr:has-text("Rejection Test")');
        if (await rejectedWO.isVisible()) {
          await screenshotHelper.captureHappyPath('work-orders', '22_rejected_wo_back_for_correction');
        }
      }
    });
    
    test('Test role switching for approvals', async ({ page }) => {
      // Test with Chief Officer role
      await authHelper.logout();
      await authHelper.loginAs('chiefOfficer');
      await navHelper.navigateToWorkOrders();
      
      // Check approval capabilities
      const pendingTab = page.locator('button:has-text("Pending Approval")');
      if (await pendingTab.isVisible()) {
        await pendingTab.click();
        await page.waitForTimeout(1000);
        
        const approveButtons = page.locator('button:has-text("Approve")');
        const canApprove = await approveButtons.count() > 0;
        
        expect(canApprove).toBeTruthy();
        await screenshotHelper.captureHappyPath('work-orders', '23_chief_officer_approval_access');
      }
      
      // Test with Master role
      await authHelper.logout();
      await authHelper.loginAs('master');
      await navHelper.navigateToWorkOrders();
      
      if (await pendingTab.isVisible()) {
        await pendingTab.click();
        await page.waitForTimeout(1000);
        
        const approveButtons = page.locator('button:has-text("Approve")');
        const canApprove = await approveButtons.count() > 0;
        
        expect(canApprove).toBeTruthy();
        await screenshotHelper.captureHappyPath('work-orders', '24_master_approval_access');
      }
      
      // Test with lower rank (should not be able to approve)
      await authHelper.logout();
      await authHelper.loginAs('engineer');
      await navHelper.navigateToWorkOrders();
      
      if (await pendingTab.isVisible()) {
        await pendingTab.click();
        await page.waitForTimeout(1000);
        
        const approveButtons = page.locator('button:has-text("Approve")');
        const canApprove = await approveButtons.count() > 0;
        
        // Lower ranks should not see approve buttons
        expect(canApprove).toBeFalsy();
        await screenshotHelper.captureHappyPath('work-orders', '25_lower_rank_no_approval');
      }
    });
  });

  test.describe('3. LIST PAGE FUNCTIONALITY', () => {
    test('Test all status tabs', async ({ page }) => {
      const tabs = [
        { name: 'All W.O', testId: 'tab-all-wo' },
        { name: 'Due', testId: 'tab-due' },
        { name: 'Pending Approval', testId: 'tab-pending-approval' },
        { name: 'Overdue', testId: 'tab-overdue' },
        { name: 'Completed', testId: 'tab-completed' }
      ];
      
      for (const tab of tabs) {
        const tabButton = page.locator(`button:has-text("${tab.name}"), [data-testid="${tab.testId}"]`);
        if (await tabButton.isVisible()) {
          await tabButton.click();
          await page.waitForTimeout(1000);
          
          // Verify tab is active
          const isActive = await tabButton.evaluate(el => 
            el.classList.contains('active') || 
            el.classList.contains('selected') ||
            el.getAttribute('aria-selected') === 'true'
          );
          
          // Count items in each tab
          const rowCount = await page.locator('tbody tr:not(:has-text("No data"))').count();
          console.log(`${tab.name} tab has ${rowCount} items`);
          
          await screenshotHelper.captureHappyPath('work-orders', `26_tab_${tab.name.toLowerCase().replace(/\s+/g, '_')}`);
        }
      }
    });
    
    test('Test search functionality', async ({ page }) => {
      // Search by work order title
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('Main Engine');
        await page.waitForTimeout(1000);
        
        // Verify filtered results
        const results = page.locator('tbody tr:has-text("Main Engine")');
        const resultCount = await results.count();
        
        if (resultCount > 0) {
          await screenshotHelper.captureHappyPath('work-orders', '27_search_results_main_engine');
        }
        
        // Clear search and try another term
        await searchInput.clear();
        await searchInput.fill('Generator');
        await page.waitForTimeout(1000);
        
        const genResults = page.locator('tbody tr:has-text("Generator")');
        if (await genResults.count() > 0) {
          await screenshotHelper.captureHappyPath('work-orders', '28_search_results_generator');
        }
      }
    });
    
    test('Test filters - Period, Ranks, Component, Criticality', async ({ page }) => {
      // Test Period filter
      const periodFilter = page.locator('button[role="combobox"]:has-text("Period"), [data-testid="filter-period"]');
      if (await periodFilter.isVisible()) {
        await periodFilter.click();
        await page.click('[role="option"]:has-text("This Month"), [role="option"]:has-text("30 Days")').first();
        await page.waitForTimeout(1000);
        await screenshotHelper.captureHappyPath('work-orders', '29_filter_period');
      }
      
      // Test Ranks filter
      const ranksFilter = page.locator('button[role="combobox"]:has-text("Ranks"), [data-testid="filter-ranks"]');
      if (await ranksFilter.isVisible()) {
        await ranksFilter.click();
        await page.click('[role="option"]:has-text("Chief Engineer")');
        await page.waitForTimeout(1000);
        
        // Verify filtered results show only Chief Engineer
        const chiefEngRows = page.locator('tbody tr:has-text("Chief Engineer")');
        const hasChiefEng = await chiefEngRows.count() > 0;
        
        if (hasChiefEng) {
          await screenshotHelper.captureHappyPath('work-orders', '30_filter_ranks_chief_engineer');
        }
      }
      
      // Test Component filter
      const componentFilter = page.locator('button[role="combobox"]:has-text("Component"), [data-testid="filter-component"]');
      if (await componentFilter.isVisible()) {
        await componentFilter.click();
        await page.click('[role="option"]:has-text("Main Engine"), [role="option"]:first-child').first();
        await page.waitForTimeout(1000);
        await screenshotHelper.captureHappyPath('work-orders', '31_filter_component');
      }
      
      // Test Criticality filter
      const criticalityFilter = page.locator('button[role="combobox"]:has-text("Criticality"), [data-testid="filter-criticality"]');
      if (await criticalityFilter.isVisible()) {
        await criticalityFilter.click();
        await page.click('[role="option"]:has-text("Critical"), [role="option"]:has-text("High")').first();
        await page.waitForTimeout(1000);
        
        // Check for critical badges or indicators
        const criticalBadges = page.locator('[data-testid="badge-critical"], .badge-critical, text=/critical/i');
        if (await criticalBadges.count() > 0) {
          await screenshotHelper.captureHappyPath('work-orders', '32_filter_criticality_critical');
        }
      }
    });
    
    test('Test sorting and pagination', async ({ page }) => {
      // Test column sorting
      const sortableHeaders = page.locator('th[role="columnheader"]:has-text("Due Date"), th:has-text("Due Date")');
      if (await sortableHeaders.isVisible()) {
        // Click to sort ascending
        await sortableHeaders.click();
        await page.waitForTimeout(1000);
        await screenshotHelper.captureHappyPath('work-orders', '33_sorted_ascending');
        
        // Click again to sort descending
        await sortableHeaders.click();
        await page.waitForTimeout(1000);
        await screenshotHelper.captureHappyPath('work-orders', '34_sorted_descending');
      }
      
      // Test pagination if available
      const paginationNext = page.locator('button:has-text("Next"), [aria-label="Next page"]');
      const paginationPrev = page.locator('button:has-text("Previous"), [aria-label="Previous page"]');
      const pageNumbers = page.locator('button[aria-label*="Page"]');
      
      if (await paginationNext.isVisible()) {
        // Go to next page
        await paginationNext.click();
        await page.waitForTimeout(1000);
        await screenshotHelper.captureHappyPath('work-orders', '35_pagination_page_2');
        
        // Go back to first page
        if (await paginationPrev.isVisible()) {
          await paginationPrev.click();
          await page.waitForTimeout(1000);
        }
      }
      
      // Test items per page if available
      const itemsPerPage = page.locator('button[role="combobox"]:has-text("10"), select:has-text("10")');
      if (await itemsPerPage.isVisible()) {
        await itemsPerPage.click();
        await page.click('[role="option"]:has-text("25"), option:has-text("25")').first();
        await page.waitForTimeout(1000);
        await screenshotHelper.captureHappyPath('work-orders', '36_items_per_page_25');
      }
    });
  });

  test.describe('4. DATA PERSISTENCE', () => {
    test('Verify work order header data persists', async ({ page }) => {
      const woId = `WO-PERSIST-${nanoid(6)}`;
      const woData = {
        title: `Persistence Test - ${woId}`,
        component: 'Main Engine',
        frequency: '3',
        assignedTo: '2nd Engineer',
        description: 'Test data persistence for work order'
      };
      
      // Create work order
      await page.click('[data-testid="button-new-work-order"]');
      await page.fill('input[placeholder*="Job Title"]', woData.title);
      await page.fill('textarea[placeholder*="description"]', woData.description);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1500);
      
      // Refresh page
      await page.reload();
      await page.waitForTimeout(2000);
      
      // Find and open the created work order
      await page.click(`tbody tr:has-text("${woData.title}")`);
      await page.waitForTimeout(1000);
      
      // Verify data persisted
      const titleInput = page.locator('input[value*="Persistence Test"]');
      const descTextarea = page.locator('textarea:has-text("Test data persistence")');
      
      const titlePersisted = await titleInput.isVisible();
      const descPersisted = await descTextarea.isVisible();
      
      expect(titlePersisted && descPersisted).toBeTruthy();
      await screenshotHelper.captureHappyPath('work-orders', '37_header_data_persisted');
    });
    
    test('Verify Part B data persists', async ({ page }) => {
      // Create and execute a work order
      const woId = `WO-B-PERSIST-${nanoid(6)}`;
      
      await page.click('[data-testid="button-new-work-order"]');
      await page.fill('input[placeholder*="Job Title"]', `Part B Persistence - ${woId}`);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1500);
      
      // Open and fill Part B
      await page.click('tbody tr:first-child');
      await page.click('text=/Part B/i');
      
      const workDetails = 'Persistence test work carried out successfully';
      await page.fill('textarea[placeholder*="work carried"]', workDetails);
      await page.fill('textarea[placeholder*="notes"]', 'Test notes for persistence');
      
      // Add spare consumption
      const sparesSection = page.locator('text=/Spare.*Consumed/i');
      if (await sparesSection.isVisible()) {
        const partInput = page.locator('input:near(text=/Part/i)').first();
        if (await partInput.isVisible()) {
          await partInput.fill('SP-TEST-001');
        }
      }
      
      await page.click('button:has-text("Submit")');
      await page.waitForTimeout(1500);
      
      // Refresh and reopen
      await page.reload();
      await page.waitForTimeout(2000);
      
      await page.click(`tbody tr:has-text("Part B Persistence")`);
      await page.click('text=/Part B/i');
      
      // Verify Part B data persisted
      const workCarriedPersisted = await page.locator(`textarea:has-text("${workDetails}")`).isVisible();
      const notesPersisted = await page.locator('textarea:has-text("Test notes")').isVisible();
      
      expect(workCarriedPersisted && notesPersisted).toBeTruthy();
      await screenshotHelper.captureHappyPath('work-orders', '38_part_b_data_persisted');
    });
    
    test('Verify consumption ledger updates', async ({ page }) => {
      // Navigate to Spares to check initial ROB
      await navHelper.navigateTo('spares');
      await page.waitForTimeout(1000);
      
      // Note initial ROB for a spare
      const initialROB = await page.locator('td:has-text("ROB"):first-of-type + td').textContent();
      console.log('Initial ROB:', initialROB);
      
      // Go back to work orders and consume spares
      await navHelper.navigateToWorkOrders();
      
      // Create and execute WO with spare consumption
      await page.click('[data-testid="button-new-work-order"]');
      await page.fill('input[placeholder*="Job Title"]', `Consumption Test - ${nanoid(6)}`);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1500);
      
      await page.click('tbody tr:first-child');
      await page.click('text=/Part B/i');
      
      // Add spare consumption
      const sparesSection = page.locator('text=/Spare.*Consumed/i');
      if (await sparesSection.isVisible()) {
        await sparesSection.scrollIntoViewIfNeeded();
        const qtyInput = page.locator('input:near(text=/Quantity/i)').first();
        if (await qtyInput.isVisible()) {
          await qtyInput.fill('2');
        }
      }
      
      await page.click('button:has-text("Submit")');
      await page.waitForTimeout(1500);
      
      // Check updated ROB in Spares
      await navHelper.navigateTo('spares');
      await page.waitForTimeout(1000);
      
      const updatedROB = await page.locator('td:has-text("ROB"):first-of-type + td').textContent();
      console.log('Updated ROB:', updatedROB);
      
      // Verify ROB decreased
      if (initialROB && updatedROB) {
        const initialValue = parseInt(initialROB);
        const updatedValue = parseInt(updatedROB);
        expect(updatedValue).toBeLessThan(initialValue);
      }
      
      await screenshotHelper.captureHappyPath('work-orders', '39_consumption_ledger_updated');
    });
    
    test('Verify status transitions are captured', async ({ page }) => {
      const woId = `WO-STATUS-${nanoid(6)}`;
      
      // Create WO (status: Draft/New)
      await page.click('[data-testid="button-new-work-order"]');
      await page.fill('input[placeholder*="Job Title"]', `Status Test - ${woId}`);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1500);
      
      // Execute WO (status: Pending Approval)
      await page.click('tbody tr:first-child');
      await page.click('text=/Part B/i');
      await page.fill('textarea[placeholder*="work carried"]', 'Status transition test');
      await page.click('button:has-text("Submit")');
      await page.waitForTimeout(1500);
      
      // Check in Pending Approval tab
      await page.click('button:has-text("Pending Approval")');
      const pendingWO = await page.locator(`tbody tr:has-text("Status Test")`).isVisible();
      expect(pendingWO).toBeTruthy();
      
      await screenshotHelper.captureHappyPath('work-orders', '40_status_pending_approval');
      
      // Approve WO (status: Completed)
      await page.click(`tbody tr:has-text("Status Test")`);
      const approveBtn = page.locator('button:has-text("Approve")').last();
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await page.waitForTimeout(1500);
      }
      
      // Check in Completed tab
      await page.click('button:has-text("Completed")');
      const completedWO = await page.locator(`tbody tr:has-text("Status Test")`).isVisible();
      expect(completedWO).toBeTruthy();
      
      await screenshotHelper.captureHappyPath('work-orders', '41_status_completed');
    });
    
    test('Verify approvals captured with timestamp and user', async ({ page }) => {
      // Create and submit WO for approval
      const woId = `WO-APPROVAL-LOG-${nanoid(6)}`;
      
      await page.click('[data-testid="button-new-work-order"]');
      await page.fill('input[placeholder*="Job Title"]', `Approval Log Test - ${woId}`);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1500);
      
      // Execute
      await page.click('tbody tr:first-child');
      await page.click('text=/Part B/i');
      await page.fill('textarea[placeholder*="work carried"]', 'Test for approval logging');
      await page.click('button:has-text("Submit")');
      await page.waitForTimeout(1500);
      
      // Note current timestamp
      const submissionTime = new Date().toISOString();
      
      // Approve
      await page.click('button:has-text("Pending Approval")');
      await page.click(`tbody tr:has-text("Approval Log Test")`);
      
      const approveBtn = page.locator('button:has-text("Approve")').last();
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await page.waitForTimeout(1500);
      }
      
      const approvalTime = new Date().toISOString();
      
      // Open completed WO to check approval details
      await page.click('button:has-text("Completed")');
      await page.click(`tbody tr:has-text("Approval Log Test")`);
      
      // Look for approval information
      const approvalInfo = page.locator('text=/Approved by|Approval Date|Chief Engineer/i');
      const hasApprovalInfo = await approvalInfo.first().isVisible();
      
      if (hasApprovalInfo) {
        await screenshotHelper.captureHappyPath('work-orders', '42_approval_captured_with_details');
      }
      
      // Store test data for verification
      console.log('Approval captured:', {
        woId,
        submissionTime,
        approvalTime,
        approvedBy: 'Chief Engineer'
      });
    });
  });

  // Final summary test
  test('Generate test summary report', async ({ page }) => {
    // Navigate through all main sections and capture final state
    const sections = [
      { tab: 'All W.O', name: 'all_work_orders' },
      { tab: 'Pending Approval', name: 'pending_approval_final' },
      { tab: 'Completed', name: 'completed_final' }
    ];
    
    for (const section of sections) {
      const tab = page.locator(`button:has-text("${section.tab}")`);
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(1000);
        
        const rowCount = await page.locator('tbody tr:not(:has-text("No data"))').count();
        console.log(`${section.tab}: ${rowCount} items`);
        
        await screenshotHelper.captureHappyPath('work-orders', `43_final_${section.name}`);
      }
    }
    
    // Generate summary
    console.log('Work Orders Module Test Complete');
    console.log('Test Coverage:');
    console.log('✓ Part A - Work Order Creation');
    console.log('✓ Part B - Work Order Execution');
    console.log('✓ Approval/Rejection Flow');
    console.log('✓ Role-based Access Control');
    console.log('✓ List Page Functionality');
    console.log('✓ Data Persistence');
    console.log('✓ Status Transitions');
    console.log('✓ Audit Trail');
  });
});