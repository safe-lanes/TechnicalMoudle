import { Page, expect } from '@playwright/test';

export class ComponentTreeHelper {
  constructor(private page: Page) {}

  async expandNode(nodeId: string): Promise<void> {
    const node = this.page.locator(`[data-testid="tree-node-${nodeId}"]`);
    const expandButton = node.locator('[data-testid="expand-button"]');
    
    const isExpanded = await expandButton.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await expandButton.click();
      await this.page.waitForTimeout(300); // Wait for animation
    }
  }

  async collapseNode(nodeId: string): Promise<void> {
    const node = this.page.locator(`[data-testid="tree-node-${nodeId}"]`);
    const expandButton = node.locator('[data-testid="expand-button"]');
    
    const isExpanded = await expandButton.getAttribute('aria-expanded');
    if (isExpanded === 'true') {
      await expandButton.click();
      await this.page.waitForTimeout(300); // Wait for animation
    }
  }

  async selectNode(nodeId: string): Promise<void> {
    await this.page.click(`[data-testid="tree-node-${nodeId}"]`);
    await this.page.waitForTimeout(200); // Wait for selection
  }

  async navigateToPath(path: string[]): Promise<void> {
    for (let i = 0; i < path.length - 1; i++) {
      await this.expandNode(path[i]);
    }
    await this.selectNode(path[path.length - 1]);
  }

  async verifyNodeSelected(nodeId: string): Promise<void> {
    const node = this.page.locator(`[data-testid="tree-node-${nodeId}"]`);
    await expect(node).toHaveClass(/selected/);
  }

  async searchComponent(searchTerm: string): Promise<void> {
    await this.page.fill('[data-testid="input-component-search"]', searchTerm);
    await this.page.waitForTimeout(500); // Wait for debounce
  }

  async verifyNodeVisible(nodeId: string): Promise<void> {
    await expect(this.page.locator(`[data-testid="tree-node-${nodeId}"]`)).toBeVisible();
  }

  async verifyNodeCount(expectedCount: number): Promise<void> {
    const nodes = await this.page.locator('[data-testid^="tree-node-"]').count();
    expect(nodes).toBe(expectedCount);
  }

  async getNodeText(nodeId: string): Promise<string> {
    return await this.page.locator(`[data-testid="tree-node-${nodeId}"]`).innerText();
  }
}