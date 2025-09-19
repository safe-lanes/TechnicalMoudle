import { Page, expect, Locator } from '@playwright/test';

export class TableHelper {
  constructor(private page: Page) {}

  async getRowCount(tableTestId: string = 'table-main'): Promise<number> {
    const rows = await this.page.locator(`[data-testid="${tableTestId}"] tbody tr`).count();
    return rows;
  }

  async getRow(rowIndex: number, tableTestId: string = 'table-main'): Promise<Locator> {
    return this.page.locator(`[data-testid="${tableTestId}"] tbody tr`).nth(rowIndex);
  }

  async getRowByText(text: string, tableTestId: string = 'table-main'): Promise<Locator> {
    return this.page.locator(`[data-testid="${tableTestId}"] tbody tr`, { hasText: text });
  }

  async getCellValue(rowIndex: number, columnIndex: number, tableTestId: string = 'table-main'): Promise<string> {
    const cell = this.page.locator(`[data-testid="${tableTestId}"] tbody tr`).nth(rowIndex).locator('td').nth(columnIndex);
    return await cell.innerText();
  }

  async clickRowAction(rowIndex: number, actionTestId: string): Promise<void> {
    const row = await this.getRow(rowIndex);
    await row.locator(`[data-testid="${actionTestId}"]`).click();
  }

  async selectRow(rowIndex: number): Promise<void> {
    const row = await this.getRow(rowIndex);
    const checkbox = row.locator('input[type="checkbox"]');
    await checkbox.check();
  }

  async selectAllRows(tableTestId: string = 'table-main'): Promise<void> {
    const selectAll = this.page.locator(`[data-testid="${tableTestId}"] thead input[type="checkbox"]`);
    await selectAll.check();
  }

  async sortColumn(columnName: string): Promise<void> {
    await this.page.click(`[data-testid="sort-${columnName}"]`);
    await this.page.waitForTimeout(500); // Wait for sort to complete
  }

  async filterTable(filterTestId: string, value: string): Promise<void> {
    await this.page.fill(`[data-testid="${filterTestId}"]`, value);
    await this.page.waitForTimeout(500); // Wait for filter debounce
  }

  async searchTable(searchTerm: string): Promise<void> {
    await this.page.fill('[data-testid="input-table-search"]', searchTerm);
    await this.page.waitForTimeout(500); // Wait for search debounce
  }

  async verifyRowContent(rowIndex: number, expectedContent: string[]): Promise<void> {
    const row = await this.getRow(rowIndex);
    for (const content of expectedContent) {
      await expect(row).toContainText(content);
    }
  }

  async verifyEmptyState(message?: string): Promise<void> {
    const emptyState = this.page.locator('[data-testid="table-empty-state"]');
    await expect(emptyState).toBeVisible();
    if (message) {
      await expect(emptyState).toContainText(message);
    }
  }

  async paginate(direction: 'next' | 'previous'): Promise<void> {
    await this.page.click(`[data-testid="pagination-${direction}"]`);
    await this.page.waitForLoadState('networkidle');
  }

  async goToPage(pageNumber: number): Promise<void> {
    await this.page.click(`[data-testid="pagination-page-${pageNumber}"]`);
    await this.page.waitForLoadState('networkidle');
  }

  async setPageSize(size: number): Promise<void> {
    await this.page.click('[data-testid="page-size-selector"]');
    await this.page.click(`[data-testid="page-size-${size}"]`);
    await this.page.waitForLoadState('networkidle');
  }
}