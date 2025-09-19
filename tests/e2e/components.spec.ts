import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { NavigationHelper } from '../helpers/navigation.helper';
import { ComponentTreeHelper } from '../helpers/component-tree.helper';
import { FormHelper } from '../helpers/form.helper';
import { ScreenshotHelper } from '../helpers/screenshot.helper';
import { generateComponentData } from '../fixtures/test-data';

test.describe('Components Module Tests', () => {
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

  test('Can view spares for a component', async ({ page }) => {
    await treeHelper.expandNode('1');
    await treeHelper.selectNode('1.1');
    
    // Check spares section
    const sparesSection = page.locator('[data-testid="section-d"]');
    await expect(sparesSection).toBeVisible();
    
    // Check for spares list or empty state
    const hasSpares = await page.locator('[data-testid="spares-list"]').isVisible();
    if (hasSpares) {
      await screenshotHelper.captureHappyPath('components', 'spares_list');
    } else {
      await expect(page.locator('[data-testid="no-spares"]')).toBeVisible();
    }
  });

  test('Component tree navigation with keyboard', async ({ page }) => {
    // Focus on tree
    await page.locator('[data-testid="component-tree"]').focus();
    
    // Navigate with arrow keys
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight'); // Expand
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter'); // Select
    
    // Verify selection
    await expect(page.locator('[data-testid="component-details"]')).toBeVisible();
    
    await screenshotHelper.captureHappyPath('components', 'keyboard_navigation');
  });

  test('Component criticality badge displays correctly', async ({ page }) => {
    await treeHelper.expandNode('1');
    await treeHelper.selectNode('1.1');
    
    // Check for critical/non-critical badge
    const criticalBadge = page.locator('[data-testid="badge-critical"], [data-testid="badge-non-critical"]');
    await expect(criticalBadge).toBeVisible();
    
    await screenshotHelper.captureHappyPath('components', 'criticality_badge');
  });
});