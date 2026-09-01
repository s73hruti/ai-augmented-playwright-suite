import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './base.page.js';
import type { Market } from './login.page.js';

export type Daypart = 'breakfast' | 'allday';

/**
 * Menu / ordering page for the QuickBite POS and Kiosk flow (demo-app/menu.html).
 *
 * Supports the market-specific menu configuration, daypart-driven UI, and
 * feature-flagged combo upsell described in the framework's real-world
 * counterpart (CyPost's Sesame/Kiosk screens).
 */
export class MenuPage extends BasePage {
  readonly path = '/menu.html';

  constructor(page: Page) {
    super(page);
  }

  async gotoForMarket(
    market: Market,
    opts: { daypart?: Daypart; comboFlag?: boolean } = {},
  ): Promise<void> {
    const query: Record<string, string> = { market };
    if (opts.daypart) query.daypart = opts.daypart;
    if (opts.comboFlag !== undefined) query.ff_combo = String(opts.comboFlag);
    await this.goto(query);
  }

  menuItemCard(itemId: string) {
    return this.testId(`menu-item-${itemId}`);
  }

  async addItemToOrder(itemId: string): Promise<void> {
    await this.testId(`add-item-${itemId}`).click();
  }

  async cartLine(itemId: string) {
    return this.testId(`cart-line-${itemId}`);
  }

  async expectCartEmpty(): Promise<void> {
    await expect(this.testId('cart-empty')).toBeVisible();
  }

  async expectCartTotal(formattedTotal: string): Promise<void> {
    await expect(this.page.locator('#cart-total-amount')).toHaveText(formattedTotal);
  }

  async expectDaypartBanner(visible: boolean): Promise<void> {
    if (visible) {
      await expect(this.testId('daypart-banner')).toBeVisible();
    } else {
      await expect(this.testId('daypart-banner')).toBeHidden();
    }
  }

  async expectComboBadgeVisible(itemId: string, visible: boolean): Promise<void> {
    const badge = this.menuItemCard(itemId).locator('.combo-badge');
    if (visible) {
      await expect(badge).toBeVisible();
    } else {
      await expect(badge).toHaveCount(0);
    }
  }

  async proceedToCheckout(): Promise<void> {
    await this.testId('checkout-button').click();
  }

  async expectCheckoutEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      await expect(this.testId('checkout-button')).toBeEnabled();
    } else {
      await expect(this.testId('checkout-button')).toBeDisabled();
    }
  }
}