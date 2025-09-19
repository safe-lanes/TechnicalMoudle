import { Page, expect } from '@playwright/test';

export class NavigationHelper {
  constructor(private page: Page) {}

  async navigateToModule(moduleName: string): Promise<void> {
    await this.page.click(`[data-testid="nav-${moduleName.toLowerCase().replace(/\s+/g, '-')}"]`);
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToPMS(): Promise<void> {
    await this.page.click('[data-testid="nav-pms"]');
    await this.page.waitForURL('**/pms/**');
  }

  async navigateToComponents(): Promise<void> {
    await this.navigateToPMS();
    await this.page.click('[data-testid="nav-components"]');
    await this.page.waitForURL('**/pms/components');
  }

  async navigateToWorkOrders(): Promise<void> {
    await this.navigateToPMS();
    await this.page.click('[data-testid="nav-work-orders"]');
    await this.page.waitForURL('**/pms/work-orders');
  }

  async navigateToRunningHours(): Promise<void> {
    await this.navigateToPMS();
    await this.page.click('[data-testid="nav-running-hours"]');
    await this.page.waitForURL('**/pms/running-hours');
  }

  async navigateToSpares(): Promise<void> {
    await this.page.click('[data-testid="nav-spares"]');
    await this.page.waitForURL('**/spares');
  }

  async navigateToStores(): Promise<void> {
    await this.page.click('[data-testid="nav-stores"]');
    await this.page.waitForURL('**/stores');
  }

  async navigateToModifyPMS(): Promise<void> {
    await this.page.click('[data-testid="nav-modify-pms"]');
    await this.page.waitForURL('**/modify-pms');
  }

  async navigateToAdmin(): Promise<void> {
    await this.page.click('[data-testid="nav-admin"]');
    await this.page.waitForURL('**/admin');
  }

  async verifyBreadcrumb(expectedPath: string[]): Promise<void> {
    for (let i = 0; i < expectedPath.length; i++) {
      await expect(this.page.locator(`[data-testid="breadcrumb-${i}"]`)).toContainText(expectedPath[i]);
    }
  }

  async clickBackButton(): Promise<void> {
    await this.page.click('[data-testid="button-back"]');
    await this.page.waitForLoadState('networkidle');
  }
}