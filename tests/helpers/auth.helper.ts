import { Page, expect } from '@playwright/test';
import { TEST_USERS, TestUser } from '../fixtures/users';

export class AuthHelper {
  constructor(private page: Page) {}

  async login(user: TestUser): Promise<void> {
    await this.page.goto('/login');
    await this.page.fill('[data-testid="input-username"]', user.username);
    await this.page.fill('[data-testid="input-password"]', user.password);
    await this.page.click('[data-testid="button-login"]');
    
    // Wait for navigation after login
    await this.page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Verify user is logged in
    await expect(this.page.locator('[data-testid="text-username"]')).toContainText(user.displayName);
  }

  async loginAs(role: keyof typeof TEST_USERS): Promise<void> {
    const user = TEST_USERS[role];
    await this.login(user);
  }

  async logout(): Promise<void> {
    await this.page.click('[data-testid="button-user-menu"]');
    await this.page.click('[data-testid="button-logout"]');
    await this.page.waitForURL('**/login');
  }

  async verifyLoggedInAs(user: TestUser): Promise<void> {
    await expect(this.page.locator('[data-testid="text-username"]')).toContainText(user.displayName);
  }

  async ensureLoggedOut(): Promise<void> {
    const currentUrl = this.page.url();
    if (!currentUrl.includes('/login')) {
      try {
        await this.logout();
      } catch {
        // Already logged out or on login page
      }
    }
  }
}