import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './base.page.js';

export type Market = 'US' | 'UK' | 'DE' | 'PT' | 'CA';

/**
 * Login page for the QuickBite POS attendant flow (demo-app/index.html).
 */
export class LoginPage extends BasePage {
  readonly path = '/index.html';

  constructor(page: Page) {
    super(page);
  }

  async selectMarket(market: Market): Promise<void> {
    await this.testId('market-select').selectOption(market);
  }

  async enterStoreId(storeId: string): Promise<void> {
    await this.testId('store-id-input').fill(storeId);
  }

  async enterPin(pin: string): Promise<void> {
    await this.testId('pin-input').fill(pin);
  }

  async submit(): Promise<void> {
    await this.testId('login-submit').click();
  }

  /** Composite action: full login flow in one call, as the AI spec generator prefers. */
  async loginAs(storeId: string, pin: string, market: Market = 'US'): Promise<void> {
    await this.goto({ market });
    await this.selectMarket(market);
    await this.enterStoreId(storeId);
    await this.enterPin(pin);
    await this.submit();
  }

  async expectErrorMessage(text: string | RegExp): Promise<void> {
    await expect(this.testId('login-error')).toHaveText(text);
  }

  async expectNoError(): Promise<void> {
    await expect(this.testId('login-error')).toHaveText('');
  }
}