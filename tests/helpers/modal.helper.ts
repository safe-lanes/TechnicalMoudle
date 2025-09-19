import { Page, expect } from '@playwright/test';

export class ModalHelper {
  constructor(private page: Page) {}

  async waitForModal(modalTestId: string = 'modal-dialog'): Promise<void> {
    await this.page.waitForSelector(`[data-testid="${modalTestId}"]`, { state: 'visible' });
    await this.page.waitForTimeout(300); // Wait for animation
  }

  async closeModal(buttonTestId: string = 'button-close-modal'): Promise<void> {
    await this.page.click(`[data-testid="${buttonTestId}"]`);
    await this.page.waitForTimeout(300); // Wait for animation
  }

  async confirmModal(buttonTestId: string = 'button-confirm'): Promise<void> {
    await this.page.click(`[data-testid="${buttonTestId}"]`);
    await this.page.waitForLoadState('networkidle');
  }

  async cancelModal(buttonTestId: string = 'button-cancel'): Promise<void> {
    await this.page.click(`[data-testid="${buttonTestId}"]`);
    await this.page.waitForTimeout(300); // Wait for animation
  }

  async verifyModalTitle(expectedTitle: string): Promise<void> {
    await expect(this.page.locator('[data-testid="modal-title"]')).toContainText(expectedTitle);
  }

  async verifyModalContent(expectedContent: string): Promise<void> {
    await expect(this.page.locator('[data-testid="modal-content"]')).toContainText(expectedContent);
  }

  async fillModalInput(inputTestId: string, value: string): Promise<void> {
    const input = this.page.locator(`[data-testid="${inputTestId}"]`);
    await input.clear();
    await input.fill(value);
  }

  async isModalVisible(modalTestId: string = 'modal-dialog'): Promise<boolean> {
    return await this.page.locator(`[data-testid="${modalTestId}"]`).isVisible();
  }

  async waitForModalToClose(modalTestId: string = 'modal-dialog'): Promise<void> {
    await this.page.waitForSelector(`[data-testid="${modalTestId}"]`, { state: 'hidden' });
  }
}