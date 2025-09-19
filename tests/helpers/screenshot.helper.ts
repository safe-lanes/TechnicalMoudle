import { Page } from '@playwright/test';
import { nanoid } from 'nanoid';

export class ScreenshotHelper {
  constructor(private page: Page) {}

  async captureScreenshot(name: string, fullPage: boolean = false): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}_${nanoid(4)}.png`;
    
    await this.page.screenshot({
      path: `test-results/screenshots/${filename}`,
      fullPage,
    });
  }

  async captureElement(selector: string, name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_element_${timestamp}_${nanoid(4)}.png`;
    
    const element = this.page.locator(selector);
    await element.screenshot({
      path: `test-results/screenshots/${filename}`,
    });
  }

  async captureWorkflow(workflowName: string, step: string): Promise<void> {
    await this.captureScreenshot(`${workflowName}_${step}`);
  }

  async captureError(errorName: string): Promise<void> {
    await this.captureScreenshot(`error_${errorName}`, true);
  }

  async captureHappyPath(moduleName: string, action: string): Promise<void> {
    await this.captureScreenshot(`happy_${moduleName}_${action}`);
  }
}