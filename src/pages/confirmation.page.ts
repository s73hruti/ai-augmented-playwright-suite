import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './base.page.js';

/**
 * Order confirmation page (demo-app/confirmation.html).
 */
export class ConfirmationPage extends BasePage {
  readonly path = '/confirmation.html';

  constructor(page: Page) {
    super(page);
  }

  async expectOrderNumberVisible(): Promise<void> {
    await expect(this.testId('order-number')).not.toBeEmpty();
  }

  async getOrderNumber(): Promise<string> {
    return (await this.testId('order-number').textContent()) ?? '';
  }

  async startNewOrder(): Promise<void> {
    await this.testId('new-order-button').click();
  }
}