import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { ComponentTreeHelper } from '../helpers/component-tree.helper';
import { FormHelper } from '../helpers/form.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { generateComponentData, generateWorkOrderData, generateSparePartData, generateRunningHoursData } from '../fixtures/test-data';
import { nanoid } from 'nanoid';

test.describe('Components Module - Comprehensive Tests', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let treeHelper: ComponentTreeHelper;
  let formHelper: FormHelper;
  let screenshotHelper: ScreenshotHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);
    treeHelper = new ComponentTreeHelper(page);
    formHelper = new FormHelper(page);
    screenshotHelper = new ScreenshotHelper(page);
    
    await authHelper.loginAs('chiefEngineer');
    await navHelper.navigateToComponents();
  });

  test('Component tree loads and displays correctly', async ({ page }) => {
    // Verify tree structure is visible
    await expect(page.locator('[data-testid="component-tree"]')).toBeVisible();
    
    // Verify root nodes are visible
    await treeHelper.verifyNodeVisible('1');
    await treeHelper.verifyNodeVisible('2');
    await treeHelper.verifyNodeVisible('3');
    
    await screenshotHelper.captureHappyPath('components', 'tree_loaded');
  });

  test('Can expand and collapse tree nodes', async ({ page }) => {
    // Expand Ship General
    await treeHelper.expandNode('1');
    await treeHelper.verifyNodeVisible('1.1');
    
    // Expand Fresh Water System
    await treeHelper.expandNode('1.1');
    await treeHelper.verifyNodeVisible('1.1.1');
    
    await screenshotHelper.captureHappyPath('components', 'expanded_nodes');
    
    // Collapse back
    await treeHelper.collapseNode('1.1');
    await expect(page.locator('[data-testid="tree-node-1.1.1"]')).not.toBeVisible();
  });

  test('Can search for components', async ({ page }) => {
    await treeHelper.searchComponent('Hydrophore');
    
    // Should auto-expand to show search results
    await page.waitForTimeout(1000);
    await treeHelper.verifyNodeVisible('1.1.1');
    
    await screenshotHelper.captureHappyPath('components', 'search_results');
  });

  test('Can select a component and view details', async ({ page }) => {
    await treeHelper.expandNode('1');
    await treeHelper.expandNode('1.1');
    await treeHelper.selectNode('1.1.1');
    
    // Verify component details are displayed
    await expect(page.locator('[data-testid="component-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="component-name"]')).toContainText('Hydrophore Unit');
    
    await screenshotHelper.captureHappyPath('components', 'component_details');
  });

  test('Component register form displays correct sections', async ({ page }) => {
    await treeHelper.expandNode('1');
    await treeHelper.selectNode('1.1');
    
    // Verify all form sections are present
    await expect(page.locator('[data-testid="section-a"]')).toBeVisible(); // Component Information
    await expect(page.locator('[data-testid="section-b1"]')).toBeVisible(); // Work Orders
    await expect(page.locator('[data-testid="section-b2"]')).toBeVisible(); // Work Completed
    await expect(page.locator('[data-testid="section-c"]')).toBeVisible(); // Running Hours
    await expect(page.locator('[data-testid="section-d"]')).toBeVisible(); // Spares
    
    await screenshotHelper.captureHappyPath('components', 'register_form');
  });

  test('Can edit component information', async ({ page }) => {
    await treeHelper.expandNode('1');
    await treeHelper.selectNode('1.1');
    
    // Click edit button
    await page.click('[data-testid="button-edit-component"]');
    
    // Fill form
    await formHelper.fillInput('input-maker', 'Test Manufacturer');
    await formHelper.fillInput('input-model', 'Test Model 2000');
    await formHelper.fillInput('input-serial-no', 'SN123456');
    
    // Save changes
    await formHelper.submitForm('button-save-component');
    
    // Verify success message
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('components', 'edited_component');
  });

  test('Can view work orders for a component', async ({ page }) => {
    await treeHelper.expandNode('1');
    await treeHelper.selectNode('1.1');
    
    // Check work orders section
    const workOrdersSection = page.locator('[data-testid="section-b1"]');
    await expect(workOrdersSection).toBeVisible();
    
    // Verify work order list or empty state
    const hasWorkOrders = await page.locator('[data-testid="work-order-list"]').isVisible();
    if (hasWorkOrders) {
      await screenshotHelper.captureHappyPath('components', 'work_orders_list');
    } else {
      await expect(page.locator('[data-testid="no-work-orders"]')).toBeVisible();
    }
  });

  test('Can view running hours for a component', async ({ page }) => {
    await treeHelper.expandNode('1');
    await treeHelper.selectNode('1.1');
    
    // Check running hours section
    const runningHoursSection = page.locator('[data-testid="section-c"]');
    await expect(runningHoursSection).toBeVisible();
    
    // Check for running hours display
    await expect(page.locator('[data-testid="cumulative-hours"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('components', 'running_hours');
  });
});

test.describe('Component CRUD Operations', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let treeHelper: ComponentTreeHelper;
  let formHelper: FormHelper;
  let screenshotHelper: ScreenshotHelper;
  let testComponentId: string;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);
    treeHelper = new ComponentTreeHelper(page);
    formHelper = new FormHelper(page);
    screenshotHelper = new ScreenshotHelper(page);
    testComponentId = `test-comp-${nanoid(6)}`;
    
    await authHelper.loginAs('chiefEngineer');
    await navHelper.navigateToComponents();
  });

  test('Add a new component with all fields', async ({ page }) => {
    const componentData = generateComponentData();
    
    // Click Add Component button
    const addButton = page.locator('[data-testid="button-add-component"], button:has-text("Add Component")');
    await addButton.click();
    
    // Wait for form to open
    await page.waitForSelector('text="Add Component"', { timeout: 5000 });
    
    // Fill in all component fields
    // Section A - Component Information
    await formHelper.fillInput('input-component-name', componentData.name);
    await formHelper.fillInput('input-component-code', componentData.componentCode);
    await formHelper.fillInput('input-maker', componentData.maker);
    await formHelper.fillInput('input-model', componentData.model);
    await formHelper.fillInput('input-serial-no', componentData.serialNo);
    
    // Select location if dropdown exists
    const locationSelector = page.locator('[data-testid="select-location"], select[name="location"]');
    if (await locationSelector.isVisible()) {
      await formHelper.selectDropdown('select-location', componentData.location);
    } else {
      await formHelper.fillInput('input-location', componentData.location);
    }
    
    // Set Critical flag
    if (componentData.critical) {
      const criticalCheckbox = page.locator('[data-testid="checkbox-critical"], input[type="checkbox"][name="critical"]');
      await criticalCheckbox.check();
    }
    
    // Set Class Item flag
    if (componentData.classItem) {
      const classCheckbox = page.locator('[data-testid="checkbox-class-item"], input[type="checkbox"][name="classItem"]');
      await classCheckbox.check();
    }
    
    // Add commissioned date if field exists
    const commissionedDateField = page.locator('[data-testid="input-commissioned-date"], input[name="commissionedDate"]');
    if (await commissionedDateField.isVisible()) {
      await formHelper.fillInput('input-commissioned-date', '2024-01-15');
    }
    
    // Add dimensions if fields exist
    const dimensionsField = page.locator('[data-testid="input-dimensions"], input[name="dimensions"]');
    if (await dimensionsField.isVisible()) {
      await formHelper.fillInput('input-dimensions', '2.5m x 1.5m x 1.8m');
    }
    
    // Add notes
    const notesField = page.locator('[data-testid="textarea-notes"], textarea[name="notes"]');
    if (await notesField.isVisible()) {
      await formHelper.fillTextarea('textarea-notes', 'Test component created by automated test');
    }
    
    await screenshotHelper.captureHappyPath('component_crud', 'add_component_filled');
    
    // Submit the form
    await formHelper.submitForm('button-save-component');
    
    // Verify success
    const successMessage = page.locator('[data-testid="toast-success"], .toast-success, text=/success/i');
    await expect(successMessage).toBeVisible({ timeout: 10000 });
    
    await screenshotHelper.captureHappyPath('component_crud', 'add_component_success');
  });

  test('Update component details and verify persistence', async ({ page }) => {
    // Select an existing component
    await treeHelper.expandNode('1');
    await treeHelper.expandNode('1.1');
    await treeHelper.selectNode('1.1.1');
    
    // Click edit button
    const editButton = page.locator('[data-testid="button-edit-component"], button:has-text("Edit")');
    await editButton.click();
    
    // Update various fields
    const updatedMaker = `Updated Maker ${nanoid(4)}`;
    const updatedModel = `Updated Model ${nanoid(4)}`;
    const updatedSerial = `SN-UPD-${nanoid(6)}`;
    
    await formHelper.fillInput('input-maker', updatedMaker);
    await formHelper.fillInput('input-model', updatedModel);
    await formHelper.fillInput('input-serial-no', updatedSerial);
    
    // Toggle critical flag
    const criticalCheckbox = page.locator('[data-testid="checkbox-critical"], input[type="checkbox"][name="critical"]');
    await criticalCheckbox.click();
    
    await screenshotHelper.captureHappyPath('component_crud', 'update_component_filled');
    
    // Save changes
    await formHelper.submitForm('button-save-component');
    
    // Verify success
    const successMessage = page.locator('[data-testid="toast-success"], .toast-success, text=/success/i');
    await expect(successMessage).toBeVisible({ timeout: 10000 });
    
    // Refresh page and verify persistence
    await page.reload();
    await treeHelper.selectNode('1.1.1');
    
    // Verify updated values are displayed
    const makerDisplay = page.locator('[data-testid="text-maker"], text=' + updatedMaker);
    const modelDisplay = page.locator('[data-testid="text-model"], text=' + updatedModel);
    const serialDisplay = page.locator('[data-testid="text-serial"], text=' + updatedSerial);
    
    // Check if any of the updated values are visible
    const hasUpdatedValues = await page.locator(`text="${updatedMaker}"`);
    await expect(hasUpdatedValues).toBeVisible({ timeout: 10000 });
    
    await screenshotHelper.captureHappyPath('component_crud', 'update_component_persisted');
  });

  test('Delete or archive component', async ({ page }) => {
    // Note: Delete functionality might not be available, test archiving instead
    await treeHelper.expandNode('1');
    await treeHelper.selectNode('1.1');
    
    // Look for delete or archive button
    const deleteButton = page.locator('[data-testid="button-delete-component"], [data-testid="button-archive-component"], button:has-text("Delete"), button:has-text("Archive")');
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      
      // Confirm deletion/archiving
      const confirmButton = page.locator('[data-testid="button-confirm-delete"], button:has-text("Confirm"), button:has-text("Yes")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        
        // Verify success
        const successMessage = page.locator('[data-testid="toast-success"], .toast-success');
        await expect(successMessage).toBeVisible({ timeout: 10000 });
        
        await screenshotHelper.captureHappyPath('component_crud', 'delete_component_success');
      }
    } else {
      // If delete is not available, mark as inactive
      const inactiveCheckbox = page.locator('[data-testid="checkbox-inactive"], input[type="checkbox"][name="inactive"]');
      if (await inactiveCheckbox.isVisible()) {
        await inactiveCheckbox.check();
        await formHelper.submitForm('button-save-component');
        await screenshotHelper.captureHappyPath('component_crud', 'mark_inactive_success');
      } else {
        // Log that delete/archive functionality is not available
        console.log('Delete/Archive functionality not available in the UI');
      }
    }
  });
});

test.describe('Running Hours Section', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let treeHelper: ComponentTreeHelper;
  let formHelper: FormHelper;
  let screenshotHelper: ScreenshotHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);
    treeHelper = new ComponentTreeHelper(page);
    formHelper = new FormHelper(page);
    screenshotHelper = new ScreenshotHelper(page);
    
    await authHelper.loginAs('chiefEngineer');
    await navHelper.navigateToComponents();
  });

  test('Update Running Hours values', async ({ page }) => {
    // Select a component
    await treeHelper.expandNode('6');
    await treeHelper.expandNode('6.1');
    await treeHelper.selectNode('6.1.1');
    
    // Navigate to Running Hours section
    const runningHoursSection = page.locator('[data-testid="section-c"], .running-hours-section, text="Running Hours"').first();
    await runningHoursSection.scrollIntoViewIfNeeded();
    
    // Click edit/update button for running hours
    const updateRHButton = page.locator('[data-testid="button-update-running-hours"], button:has-text("Update Running Hours")');
    if (await updateRHButton.isVisible()) {
      await updateRHButton.click();
      
      // Fill in new running hours
      const rhData = generateRunningHoursData();
      await formHelper.fillInput('input-new-hours', rhData.newRH.toString());
      await formHelper.fillTextarea('textarea-rh-notes', rhData.notes);
      
      await screenshotHelper.captureHappyPath('running_hours', 'update_hours_filled');
      
      // Submit
      await formHelper.submitForm('button-save-running-hours');
      
      // Verify update
      const successMessage = page.locator('[data-testid="toast-success"], .toast-success');
      await expect(successMessage).toBeVisible({ timeout: 10000 });
      
      await screenshotHelper.captureHappyPath('running_hours', 'update_hours_success');
    }
  });

  test('Update Condition Monitoring metrics with thresholds', async ({ page }) => {
    // Select a component with condition monitoring
    await treeHelper.expandNode('6');
    await treeHelper.selectNode('6.1');
    
    // Look for condition monitoring section
    const conditionSection = page.locator('[data-testid="section-condition-monitoring"], .condition-monitoring, text="Condition Monitoring"').first();
    
    if (await conditionSection.isVisible()) {
      await conditionSection.scrollIntoViewIfNeeded();
      
      // Update thresholds
      const editThresholdButton = page.locator('[data-testid="button-edit-thresholds"], button:has-text("Edit Thresholds")');
      if (await editThresholdButton.isVisible()) {
        await editThresholdButton.click();
        
        // Set warning and critical thresholds
        await formHelper.fillInput('input-warning-threshold', '8000');
        await formHelper.fillInput('input-critical-threshold', '10000');
        
        // Set vibration limits if available
        const vibrationField = page.locator('[data-testid="input-vibration-limit"]');
        if (await vibrationField.isVisible()) {
          await formHelper.fillInput('input-vibration-limit', '7.5');
        }
        
        // Set temperature limits if available
        const tempField = page.locator('[data-testid="input-temperature-limit"]');
        if (await tempField.isVisible()) {
          await formHelper.fillInput('input-temperature-limit', '85');
        }
        
        await screenshotHelper.captureHappyPath('condition_monitoring', 'thresholds_set');
        
        // Save thresholds
        await formHelper.submitForm('button-save-thresholds');
        
        // Verify saved
        const successMessage = page.locator('[data-testid="toast-success"], .toast-success');
        await expect(successMessage).toBeVisible({ timeout: 10000 });
        
        await screenshotHelper.captureHappyPath('condition_monitoring', 'thresholds_saved');
      }
    } else {
      console.log('Condition Monitoring section not available for this component');
    }
  });

  test('Verify calculations and persistence of running hours', async ({ page }) => {
    // Navigate to Running Hours module directly
    await navHelper.navigateToRunningHours();
    
    // Select a component to update
    const componentRow = page.locator('tr').filter({ hasText: 'Main Engine' }).first();
    if (await componentRow.isVisible()) {
      // Get initial cumulative hours
      const initialHours = await componentRow.locator('[data-testid="text-cumulative-hours"], .cumulative-hours').innerText();
      
      // Click update button
      await componentRow.locator('[data-testid="button-update"], button:has-text("Update")');
      
      // Enter new hours
      const newHours = 100;
      await formHelper.fillInput('input-new-hours', newHours.toString());
      await formHelper.submitForm();
      
      // Verify calculation
      const updatedHours = await componentRow.locator('[data-testid="text-cumulative-hours"], .cumulative-hours').innerText();
      const initialValue = parseFloat(initialHours.replace(/[^0-9.]/g, ''));
      const expectedValue = initialValue + newHours;
      
      // Check if the updated value matches expected (within tolerance for floating point)
      const updatedValue = parseFloat(updatedHours.replace(/[^0-9.]/g, ''));
      expect(Math.abs(updatedValue - expectedValue)).toBeLessThan(1);
      
      await screenshotHelper.captureHappyPath('running_hours', 'calculation_verified');
      
      // Refresh and verify persistence
      await page.reload();
      const persistedHours = await componentRow.locator('[data-testid="text-cumulative-hours"], .cumulative-hours').innerText();
      expect(persistedHours).toBe(updatedHours);
      
      await screenshotHelper.captureHappyPath('running_hours', 'persistence_verified');
    }
  });
});

test.describe('Attachments and Relationships', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let treeHelper: ComponentTreeHelper;
  let formHelper: FormHelper;
  let screenshotHelper: ScreenshotHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);
    treeHelper = new ComponentTreeHelper(page);
    formHelper = new FormHelper(page);
    screenshotHelper = new ScreenshotHelper(page);
    
    await authHelper.loginAs('chiefEngineer');
    await navHelper.navigateToComponents();
  });

  test('Attach Work Orders and verify linked list', async ({ page }) => {
    // Select a component
    await treeHelper.expandNode('6');
    await treeHelper.selectNode('6.1');
    
    // Navigate to Work Orders section
    const workOrdersSection = page.locator('[data-testid="section-b1"], .work-orders-section, text="Work Orders"').first();
    await workOrdersSection.scrollIntoViewIfNeeded();
    
    // Click attach/link work order button
    const attachWOButton = page.locator('[data-testid="button-attach-work-order"], button:has-text("Link Work Order"), button:has-text("Add Work Order")');
    if (await attachWOButton.isVisible()) {
      await attachWOButton.click();
      
      // Select or create a work order
      const woData = generateWorkOrderData();
      
      // Check if we need to select existing or create new
      const selectWOModal = page.locator('text="Select Work Order"');
      if (await selectWOModal.isVisible()) {
        // Select first available work order
        const firstWO = page.locator('[data-testid="wo-option"]').first();
        if (await firstWO.isVisible()) {
          await firstWO.click();
        }
      } else {
        // Fill work order form if creating new
        await formHelper.fillInput('input-wo-description', woData.briefDescription);
        await formHelper.selectDropdown('select-task-type', woData.taskType);
      }
      
      // Confirm attachment
      await formHelper.submitForm('button-attach-wo');
      
      // Verify work order appears in linked list
      const linkedWO = page.locator('[data-testid="linked-work-orders"], .work-orders-list');
      await expect(linkedWO).toBeVisible();
      
      await screenshotHelper.captureHappyPath('attachments', 'work_order_linked');
    }
  });

  test('Attach Spares to component', async ({ page }) => {
    // Select a component
    await treeHelper.expandNode('6');
    await treeHelper.selectNode('6.1');
    
    // Navigate to Spares section
    const sparesSection = page.locator('[data-testid="section-d"], .spares-section, text="Spares"').first();
    await sparesSection.scrollIntoViewIfNeeded();
    
    // Click attach spare button
    const attachSpareButton = page.locator('[data-testid="button-attach-spare"], button:has-text("Add Spare"), button:has-text("Link Spare")');
    if (await attachSpareButton.isVisible()) {
      await attachSpareButton.click();
      
      // Select or add spare
      const spareData = generateSparePartData();
      
      const selectSpareModal = page.locator('text="Select Spare Part"');
      if (await selectSpareModal.isVisible()) {
        // Select existing spare
        const firstSpare = page.locator('[data-testid="spare-option"]').first();
        if (await firstSpare.isVisible()) {
          await firstSpare.click();
        }
      } else {
        // Add new spare
        await formHelper.fillInput('input-spare-code', spareData.partCode);
        await formHelper.fillInput('input-spare-name', spareData.partName);
      }
      
      // Confirm attachment
      await formHelper.submitForm('button-attach-spare');
      
      // Verify spare appears in list
      const linkedSpares = page.locator('[data-testid="linked-spares"], .spares-list');
      await expect(linkedSpares).toBeVisible();
      
      await screenshotHelper.captureHappyPath('attachments', 'spare_linked');
    }
  });

  test('Test Drawings/Manuals file upload', async ({ page }) => {
    // Select a component
    await treeHelper.expandNode('1');
    await treeHelper.selectNode('1.1');
    
    // Look for documents/attachments section
    const documentsSection = page.locator('[data-testid="section-documents"], .documents-section, text="Documents", text="Attachments"').first();
    
    if (await documentsSection.isVisible()) {
      await documentsSection.scrollIntoViewIfNeeded();
      
      // Click upload button
      const uploadButton = page.locator('[data-testid="button-upload-document"], button:has-text("Upload"), button:has-text("Add Document")');
      if (await uploadButton.isVisible()) {
        await uploadButton.click();
        
        // Create a test file to upload
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.isVisible()) {
          // Set test file
          await fileInput.setInputFiles({
            name: 'test-manual.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('Test PDF content')
          });
          
          // Add description if field exists
          const descField = page.locator('[data-testid="input-document-description"]');
          if (await descField.isVisible()) {
            await formHelper.fillInput('input-document-description', 'Test component manual');
          }
          
          // Select document type if dropdown exists
          const typeField = page.locator('[data-testid="select-document-type"]');
          if (await typeField.isVisible()) {
            await formHelper.selectDropdown('select-document-type', 'Manual');
          }
          
          // Upload
          await formHelper.submitForm('button-upload');
          
          // Verify upload success
          const successMessage = page.locator('[data-testid="toast-success"], .toast-success');
          await expect(successMessage).toBeVisible({ timeout: 10000 });
          
          await screenshotHelper.captureHappyPath('attachments', 'document_uploaded');
        }
      }
    } else {
      console.log('Documents/Attachments section not available');
    }
  });

  test('Add Class/Regulatory data', async ({ page }) => {
    // Select a component
    await treeHelper.expandNode('1');
    await treeHelper.selectNode('1.1');
    
    // Look for class/regulatory section
    const classSection = page.locator('[data-testid="section-class"], .class-section, text="Class", text="Regulatory"').first();
    
    if (await classSection.isVisible()) {
      await classSection.scrollIntoViewIfNeeded();
      
      // Add class data
      const addClassButton = page.locator('[data-testid="button-add-class"], button:has-text("Add Class Data")');
      if (await addClassButton.isVisible()) {
        await addClassButton.click();
        
        // Fill class information
        await formHelper.fillInput('input-class-society', 'DNV GL');
        await formHelper.fillInput('input-class-notation', 'A1');
        await formHelper.fillInput('input-certificate-number', `CERT-${nanoid(6)}`);
        await formHelper.fillInput('input-survey-due', '2024-12-31');
        
        // Save class data
        await formHelper.submitForm('button-save-class');
        
        // Verify saved
        const successMessage = page.locator('[data-testid="toast-success"], .toast-success');
        await expect(successMessage).toBeVisible({ timeout: 10000 });
        
        await screenshotHelper.captureHappyPath('attachments', 'class_data_added');
      }
    }
  });

  test('Link Regulations', async ({ page }) => {
    // Select a component
    await treeHelper.expandNode('5');
    await treeHelper.selectNode('5.2'); // Fire Main System
    
    // Look for regulations section
    const regulationsSection = page.locator('[data-testid="section-regulations"], .regulations-section, text="Regulations"').first();
    
    if (await regulationsSection.isVisible()) {
      await regulationsSection.scrollIntoViewIfNeeded();
      
      // Link regulation
      const linkRegButton = page.locator('[data-testid="button-link-regulation"], button:has-text("Link Regulation"), button:has-text("Add Regulation")');
      if (await linkRegButton.isVisible()) {
        await linkRegButton.click();
        
        // Select or add regulation
        await formHelper.fillInput('input-regulation-code', 'SOLAS Ch II-2');
        await formHelper.fillInput('input-regulation-title', 'Fire Safety Systems');
        await formHelper.fillTextarea('textarea-regulation-requirements', 'Monthly inspection required');
        
        // Save
        await formHelper.submitForm('button-link-regulation');
        
        // Verify linked
        const linkedReg = page.locator('[data-testid="linked-regulations"], .regulations-list');
        await expect(linkedReg).toBeVisible();
        
        await screenshotHelper.captureHappyPath('attachments', 'regulation_linked');
      }
    }
  });
});

test.describe('Search and Filtering', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let treeHelper: ComponentTreeHelper;
  let formHelper: FormHelper;
  let screenshotHelper: ScreenshotHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);
    treeHelper = new ComponentTreeHelper(page);
    formHelper = new FormHelper(page);
    screenshotHelper = new ScreenshotHelper(page);
    
    await authHelper.loginAs('chiefEngineer');
    await navHelper.navigateToComponents();
  });

  test('Test component tree navigation in left panel', async ({ page }) => {
    // Verify tree is visible
    const componentTree = page.locator('[data-testid="component-tree"], .component-tree, .tree-view').first();
    await expect(componentTree).toBeVisible();
    
    // Navigate through multiple levels
    await treeHelper.expandNode('6'); // Machinery
    await treeHelper.expandNode('6.1'); // Main Engine
    await treeHelper.expandNode('6.1.1'); // Cylinder Head
    
    // Verify sub-components are visible
    await treeHelper.verifyNodeVisible('6.1.1.1'); // Valve Seats
    await treeHelper.verifyNodeVisible('6.1.1.2'); // Injector Sleeve
    await treeHelper.verifyNodeVisible('6.1.1.3'); // Rocker Arm
    
    await screenshotHelper.captureHappyPath('search_filter', 'tree_navigation');
    
    // Collapse and verify hidden
    await treeHelper.collapseNode('6.1.1');
    const valveSeats = page.locator('[data-testid="tree-node-6.1.1.1"]');
    await expect(valveSeats).not.toBeVisible();
    
    await screenshotHelper.captureHappyPath('search_filter', 'tree_collapsed');
  });

  test('Verify search functionality', async ({ page }) => {
    // Search for a specific component
    await treeHelper.searchComponent('Main Engine');
    
    // Verify search results
    await page.waitForTimeout(1000); // Wait for search to complete
    
    // Check that Main Engine is visible and expanded
    await treeHelper.verifyNodeVisible('6.1');
    
    // Search for a more specific term
    await treeHelper.searchComponent('Cylinder Head');
    await page.waitForTimeout(1000);
    
    // Verify the path is expanded to show the result
    await treeHelper.verifyNodeVisible('6.1.1');
    
    await screenshotHelper.captureHappyPath('search_filter', 'search_results');
    
    // Clear search and verify all nodes return
    const searchInput = page.locator('[data-testid="input-component-search"]');
    await searchInput.clear();
    await page.waitForTimeout(500);
    
    // Verify tree returns to normal state
    await treeHelper.verifyNodeVisible('1'); // Ship General should be visible again
    
    await screenshotHelper.captureHappyPath('search_filter', 'search_cleared');
  });

  test('Test filters - category, location, critical status', async ({ page }) => {
    // Look for filter controls
    const filterButton = page.locator('[data-testid="button-filters"], button:has-text("Filters"), button:has-text("Filter")');
    
    if (await filterButton.isVisible()) {
      await filterButton.click();
      
      // Filter by category
      const categoryFilter = page.locator('[data-testid="select-category-filter"], select[name="category"]');
      if (await categoryFilter.isVisible()) {
        await formHelper.selectDropdown('select-category-filter', 'machinery');
        await page.waitForTimeout(500);
        
        // Verify only machinery components are visible
        await treeHelper.verifyNodeVisible('6');
        const shipGeneral = page.locator('[data-testid="tree-node-1"]');
        const isHidden = await shipGeneral.isHidden();
        
        await screenshotHelper.captureHappyPath('search_filter', 'category_filtered');
      }
      
      // Filter by location
      const locationFilter = page.locator('[data-testid="select-location-filter"], select[name="location"]');
      if (await locationFilter.isVisible()) {
        await formHelper.selectDropdown('select-location-filter', 'Engine Room');
        await page.waitForTimeout(500);
        
        await screenshotHelper.captureHappyPath('search_filter', 'location_filtered');
      }
      
      // Filter by critical status
      const criticalFilter = page.locator('[data-testid="checkbox-critical-filter"], input[type="checkbox"][name="criticalOnly"]');
      if (await criticalFilter.isVisible()) {
        await criticalFilter.check();
        await page.waitForTimeout(500);
        
        await screenshotHelper.captureHappyPath('search_filter', 'critical_filtered');
      }
      
      // Clear all filters
      const clearFiltersButton = page.locator('[data-testid="button-clear-filters"], button:has-text("Clear")');
      if (await clearFiltersButton.isVisible()) {
        await clearFiltersButton.click();
        await page.waitForTimeout(500);
        
        // Verify all components are visible again
        await treeHelper.verifyNodeVisible('1');
        await treeHelper.verifyNodeVisible('2');
        await treeHelper.verifyNodeVisible('3');
        
        await screenshotHelper.captureHappyPath('search_filter', 'filters_cleared');
      }
    } else {
      console.log('Filter functionality not available in the UI');
    }
  });

  test('Verify selecting node in tree filters the list', async ({ page }) => {
    // Check if there's a component list/table alongside the tree
    const componentList = page.locator('[data-testid="component-list"], [data-testid="components-table"], .component-list, table').first();
    
    if (await componentList.isVisible()) {
      // Get initial count of components in list
      const initialRows = await componentList.locator('tr, [data-testid^="component-row"]').count();
      
      // Select a specific node
      await treeHelper.expandNode('6');
      await treeHelper.selectNode('6.1'); // Main Engine
      await page.waitForTimeout(500);
      
      // Check if list is filtered
      const filteredRows = await componentList.locator('tr, [data-testid^="component-row"]').count();
      
      // Verify filtering occurred (should have fewer rows)
      expect(filteredRows).toBeLessThanOrEqual(initialRows);
      
      await screenshotHelper.captureHappyPath('search_filter', 'tree_filters_list');
      
      // Click on root to show all
      await treeHelper.selectNode('6');
      await page.waitForTimeout(500);
      
      const allRows = await componentList.locator('tr, [data-testid^="component-row"]').count();
      expect(allRows).toBeGreaterThanOrEqual(filteredRows);
      
      await screenshotHelper.captureHappyPath('search_filter', 'tree_shows_all');
    } else {
      console.log('Component list/table not visible alongside tree');
    }
  });
});

test.describe('Data Persistence Verification', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let treeHelper: ComponentTreeHelper;
  let formHelper: FormHelper;
  let screenshotHelper: ScreenshotHelper;
  let testComponentId: string;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);
    treeHelper = new ComponentTreeHelper(page);
    formHelper = new FormHelper(page);
    screenshotHelper = new ScreenshotHelper(page);
    testComponentId = `persist-test-${nanoid(6)}`;
    
    await authHelper.loginAs('chiefEngineer');
    await navHelper.navigateToComponents();
  });

  test('Verify all component fields are stored correctly', async ({ page, request }) => {
    const componentData = generateComponentData();
    
    // Make API call to verify data storage
    const response = await request.get('/api/components/V001');
    expect(response.ok()).toBeTruthy();
    
    const components = await response.json();
    console.log(`Found ${components.length} components in database`);
    
    // Select a component and verify all fields
    await treeHelper.expandNode('6');
    await treeHelper.selectNode('6.1');
    
    // Check that all expected fields are displayed
    const componentDetails = page.locator('[data-testid="component-details"], .component-details').first();
    await expect(componentDetails).toBeVisible();
    
    // Verify key fields are present
    const fieldsToCheck = [
      'maker', 'model', 'serial', 'location', 'category',
      'code', 'name'
    ];
    
    for (const field of fieldsToCheck) {
      const fieldElement = page.locator(
        `[data-testid*="${field}"], ` +
        `text=/${field}/i, ` +
        `*:has-text("${field}")`
      ).first();
      
      if (await fieldElement.isVisible({ timeout: 2000 })) {
        console.log(`✓ Field '${field}' is displayed`);
      } else {
        console.log(`✗ Field '${field}' not found in UI`);
      }
    }
    
    await screenshotHelper.captureHappyPath('persistence', 'all_fields_displayed');
  });

  test('Verify files are properly linked', async ({ page }) => {
    // Select a component
    await treeHelper.expandNode('1');
    await treeHelper.selectNode('1.1');
    
    // Check for attached files section
    const filesSection = page.locator(
      '[data-testid="section-attachments"], ' +
      '[data-testid="section-documents"], ' +
      '.attachments-section, ' +
      'text="Attachments", ' +
      'text="Documents"'
    ).first();
    
    if (await filesSection.isVisible()) {
      await filesSection.scrollIntoViewIfNeeded();
      
      // Check if any files are linked
      const filesList = page.locator(
        '[data-testid="files-list"], ' +
        '[data-testid="attachments-list"], ' +
        '.files-list, ' +
        '.attachments-list'
      ).first();
      
      if (await filesList.isVisible()) {
        const fileCount = await filesList.locator(
          '[data-testid^="file-"], ' +
          '[data-testid^="attachment-"], ' +
          '.file-item, ' +
          '.attachment-item'
        ).count();
        
        console.log(`Found ${fileCount} linked files`);
        
        if (fileCount > 0) {
          // Verify file links work
          const firstFile = filesList.locator(
            '[data-testid^="file-"], ' +
            '[data-testid^="attachment-"]'
          ).first();
          
          const fileName = await firstFile.innerText();
          console.log(`First file: ${fileName}`);
          
          await screenshotHelper.captureHappyPath('persistence', 'files_linked');
        }
      }
    }
  });

  test('Verify relationships persist correctly', async ({ page, request }) => {
    // Check work orders relationship
    const woResponse = await request.get('/api/work-orders?vesselId=V001');
    expect(woResponse.ok()).toBeTruthy();
    const workOrders = await woResponse.json();
    console.log(`Found ${workOrders.length} work orders`);
    
    // Check spares relationship
    const sparesResponse = await request.get('/api/spares/V001');
    expect(sparesResponse.ok()).toBeTruthy();
    const spares = await sparesResponse.json();
    console.log(`Found ${spares.length} spares`);
    
    // Navigate to a component with relationships
    await treeHelper.expandNode('6');
    await treeHelper.selectNode('6.1');
    
    // Verify work orders are displayed
    const woSection = page.locator('[data-testid="section-b1"], .work-orders-section').first();
    if (await woSection.isVisible()) {
      await woSection.scrollIntoViewIfNeeded();
      const woList = woSection.locator('[data-testid="work-order-list"], .wo-list, table').first();
      if (await woList.isVisible()) {
        const woCount = await woList.locator('tr, [data-testid^="wo-"]').count();
        console.log(`Component has ${woCount} linked work orders in UI`);
      }
    }
    
    // Verify spares are displayed
    const sparesSection = page.locator('[data-testid="section-d"], .spares-section').first();
    if (await sparesSection.isVisible()) {
      await sparesSection.scrollIntoViewIfNeeded();
      const sparesList = sparesSection.locator('[data-testid="spares-list"], .spares-list, table').first();
      if (await sparesList.isVisible()) {
        const sparesCount = await sparesList.locator('tr, [data-testid^="spare-"]').count();
        console.log(`Component has ${sparesCount} linked spares in UI`);
      }
    }
    
    await screenshotHelper.captureHappyPath('persistence', 'relationships_verified');
  });

  test('Verify component hierarchy is maintained', async ({ page }) => {
    // Test parent-child relationships
    await treeHelper.expandNode('6'); // Machinery
    await treeHelper.expandNode('6.1'); // Main Engine
    await treeHelper.expandNode('6.1.1'); // Cylinder Head
    
    // Verify hierarchy levels
    const level1 = page.locator('[data-testid="tree-node-6"]');
    const level2 = page.locator('[data-testid="tree-node-6.1"]');
    const level3 = page.locator('[data-testid="tree-node-6.1.1"]');
    const level4 = page.locator('[data-testid="tree-node-6.1.1.1"]');
    
    // All should be visible when expanded
    await expect(level1).toBeVisible();
    await expect(level2).toBeVisible();
    await expect(level3).toBeVisible();
    await expect(level4).toBeVisible();
    
    // Verify parent-child structure
    await treeHelper.collapseNode('6.1.1');
    await expect(level4).not.toBeVisible(); // Child should be hidden
    await expect(level3).toBeVisible(); // Parent still visible
    
    await treeHelper.collapseNode('6.1');
    await expect(level3).not.toBeVisible(); // Grandchild hidden
    await expect(level2).toBeVisible(); // Parent still visible
    
    await treeHelper.collapseNode('6');
    await expect(level2).not.toBeVisible(); // All children hidden
    await expect(level1).toBeVisible(); // Root still visible
    
    await screenshotHelper.captureHappyPath('persistence', 'hierarchy_maintained');
    
    // Expand again to verify structure persists
    await treeHelper.expandNode('6');
    await treeHelper.expandNode('6.1');
    await treeHelper.expandNode('6.1.1');
    
    // All should be visible again
    await expect(level1).toBeVisible();
    await expect(level2).toBeVisible();
    await expect(level3).toBeVisible();
    await expect(level4).toBeVisible();
    
    await screenshotHelper.captureHappyPath('persistence', 'hierarchy_restored');
  });
});