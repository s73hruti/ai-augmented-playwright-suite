import { test, expect } from '@playwright/test';
import { LoginPage } from '../src/pages/login.page.js';
import { MenuPage } from '../src/pages/menu.page.js';
import { CheckoutPage } from '../src/pages/checkout.page.js';
import { ConfirmationPage } from '../src/pages/confirmation.page.js';
import { formatMoney } from '../src/utils/money.js';

test.describe('End-to-end ordering flow', () => {
  test('US customer orders an all-day item and pays by card @smoke', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const menuPage = new MenuPage(page);
    const checkoutPage = new CheckoutPage(page);
    const confirmationPage = new ConfirmationPage(page);

    await test.step('log in as a US store attendant', async () => {
      await loginPage.loginAs('4821', '1234', 'US');
    });

    await test.step('add the classic burger to the order', async () => {
      await menuPage.gotoForMarket('US', { daypart: 'allday' });
      await menuPage.expectDaypartBanner(false);
      await menuPage.addItemToOrder('us-ad-01');
      await menuPage.expectCartTotal(formatMoney(5.79, '$'));
    });

    await test.step('check out with a credit card', async () => {
      await menuPage.proceedToCheckout();
      await checkoutPage.expectTotal(formatMoney(5.79, '$'));
      await checkoutPage.checkoutWith('card');
    });

    await test.step('confirm the order number is shown', async () => {
      await confirmationPage.expectOrderNumberVisible();
      const orderNumber = await confirmationPage.getOrderNumber();
      expect(orderNumber).toMatch(/^QB-\d{6}$/);
    });
  });

  test('breakfast daypart banner shows before 11am and hides the all-day combo badge', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const menuPage = new MenuPage(page);

    await loginPage.loginAs('4821', '1234', 'UK');
    await menuPage.gotoForMarket('UK', { daypart: 'breakfast', comboFlag: true });

    await menuPage.expectDaypartBanner(true);
    await menuPage.expectCartEmpty();
    await menuPage.expectCheckoutEnabled(false);
  });

  test('combo upsell badge appears on all-day items only when the feature flag is enabled', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const menuPage = new MenuPage(page);

    await loginPage.loginAs('9004', '5678', 'DE');
    await menuPage.gotoForMarket('DE', { daypart: 'allday', comboFlag: true });

    await menuPage.expectComboBadgeVisible('de-ad-01', true);
  });
});