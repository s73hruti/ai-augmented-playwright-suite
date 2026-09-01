import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './base.page.js';

export type PaymentMethod = 'card' | 'cash' | 'mobile';

/**
 * Checkout page for the QuickBite POS/Kiosk flow (demo-app/checkout.html).
 */
export class CheckoutPage extends BasePage {
  readonly path = '/checkout.html';

  constructor(page: Page) {
    super(page);
  }

  async selectPaymentMethod(method: PaymentMethod): Promise<void> {
    await this.testId(`payment-${method}`).check();
  }

  async placeOrder(): Promise<void> {
    await this.testId('place-order-button').click();
  }

  async expectTotal(formattedTotal: string): Promise<void> {
    await expect(this.page.locator('#summary-total')).toHaveText(formattedTotal);
  }

  async expectError(text: string | RegExp): Promise<void> {
    await expect(this.testId('checkout-error')).toHaveText(text);
  }

  /** Composite action combining payment selection and order placement. */
  async checkoutWith(method: PaymentMethod): Promise<void> {
    await this.selectPaymentMethod(method);
    await this.placeOrder();
  }
}