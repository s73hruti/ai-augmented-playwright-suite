import { test, expect } from '@playwright/test';
import { LoginPage } from '../src/pages/login.page.js';
import { MenuPage } from '../src/pages/menu.page.js';

test.describe('POS attendant login', () => {
  test('valid store ID and PIN logs the attendant into the menu screen', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const menuPage = new MenuPage(page);

    await loginPage.loginAs('4821', '1234', 'US');

    await expect(page).toHaveURL(/menu\.html/);
    await menuPage.expectCartEmpty();
  });

  test('rejects a non-numeric or short PIN with an inline error', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.loginAs('4821', 'ab', 'US');

    await loginPage.expectErrorMessage(/valid store id and 4-digit pin/i);
    await expect(page).toHaveURL(/index\.html/);
  });

  test.skip(({ browserName }) => browserName === 'webkit', 'demo-only skip example');
});