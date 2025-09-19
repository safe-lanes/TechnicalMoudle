import { Page, expect, Locator } from '@playwright/test';

export class FormHelper {
  constructor(private page: Page) {}

  async fillInput(testId: string, value: string): Promise<void> {
    const input = this.page.locator(`[data-testid="${testId}"]`);
    await input.clear();
    await input.fill(value);
  }

  async selectOption(testId: string, value: string): Promise<void> {
    await this.page.click(`[data-testid="${testId}"]`);
    await this.page.click(`[data-testid="select-option-${value}"]`);
  }

  async selectDropdown(dropdownTestId: string, optionText: string): Promise<void> {
    await this.page.click(`[data-testid="${dropdownTestId}"]`);
    await this.page.click(`text="${optionText}"`);
  }

  async toggleCheckbox(testId: string, checked: boolean = true): Promise<void> {
    const checkbox = this.page.locator(`[data-testid="${testId}"]`);
    const isChecked = await checkbox.isChecked();
    
    if (isChecked !== checked) {
      await checkbox.click();
    }
  }

  async selectRadio(testId: string, value: string): Promise<void> {
    await this.page.click(`[data-testid="${testId}-${value}"]`);
  }

  async fillDatePicker(testId: string, date: Date): Promise<void> {
    const dateString = date.toISOString().split('T')[0];
    await this.fillInput(testId, dateString);
  }

  async fillTextarea(testId: string, text: string): Promise<void> {
    const textarea = this.page.locator(`[data-testid="${testId}"]`);
    await textarea.clear();
    await textarea.fill(text);
  }

  async submitForm(buttonTestId: string = 'button-submit'): Promise<void> {
    await this.page.click(`[data-testid="${buttonTestId}"]`);
    await this.page.waitForLoadState('networkidle');
  }

  async cancelForm(buttonTestId: string = 'button-cancel'): Promise<void> {
    await this.page.click(`[data-testid="${buttonTestId}"]`);
  }

  async verifyValidationError(fieldTestId: string, errorMessage: string): Promise<void> {
    const errorLocator = this.page.locator(`[data-testid="${fieldTestId}-error"]`);
    await expect(errorLocator).toBeVisible();
    await expect(errorLocator).toContainText(errorMessage);
  }

  async clearValidationErrors(): Promise<void> {
    // Trigger form re-validation by focusing outside
    await this.page.click('body');
  }

  async fillWorkOrderForm(data: any): Promise<void> {
    if (data.component) await this.fillInput('input-component', data.component);
    if (data.taskType) await this.selectDropdown('select-task-type', data.taskType);
    if (data.briefDescription) await this.fillInput('input-description', data.briefDescription);
    if (data.frequency) await this.fillInput('input-frequency', data.frequency);
    if (data.unit) await this.selectDropdown('select-unit', data.unit);
    if (data.responsibleRank) await this.selectDropdown('select-rank', data.responsibleRank);
    if (data.dueDate) await this.fillInput('input-due-date', data.dueDate);
    if (data.estimatedDuration) await this.fillInput('input-duration', data.estimatedDuration);
    if (data.numberOfPeople) await this.fillInput('input-people', data.numberOfPeople.toString());
    if (data.location) await this.fillInput('input-location', data.location);
    if (data.tools) await this.fillTextarea('textarea-tools', data.tools);
    if (data.spares) await this.fillTextarea('textarea-spares', data.spares);
    if (data.permits) await this.fillTextarea('textarea-permits', data.permits);
    if (data.specialNotes) await this.fillTextarea('textarea-notes', data.specialNotes);
  }

  async fillSparePartForm(data: any): Promise<void> {
    if (data.partCode) await this.fillInput('input-part-code', data.partCode);
    if (data.partName) await this.fillInput('input-part-name', data.partName);
    if (data.component) await this.fillInput('input-component', data.component);
    if (data.critical) await this.selectDropdown('select-critical', data.critical);
    if (data.rob) await this.fillInput('input-rob', data.rob.toString());
    if (data.min) await this.fillInput('input-min', data.min.toString());
    if (data.location) await this.fillInput('input-location', data.location);
  }

  async waitForFormSubmission(): Promise<void> {
    await Promise.race([
      this.page.waitForLoadState('networkidle'),
      this.page.waitForSelector('[data-testid="toast-success"]', { timeout: 5000 })
    ]);
  }
}