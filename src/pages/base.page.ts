import type { Locator, Page } from '@playwright/test';

/**
 * Base class for all Page Objects in the framework.
 *
 * Every concrete page extends this so the AI spec-generation layer can rely
 * on a consistent shape (constructor takes a Playwright `Page`, navigation
 * helpers, and a `testId` convenience) when it introspects the framework's
 * Page Object classes to ground generated test specs.
 */
export abstract class BasePage {
  protected readonly page: Page;

  /** Path relative to baseURL that this page lives at, e.g. "/menu.html". */
  abstract readonly path: string;

  constructor(page: Page) {
    this.page = page;
  }

  /** Navigate directly to this page, optionally with query params. */
  async goto(query: Record<string, string> = {}): Promise<void> {
    const search = new URLSearchParams(query).toString();
    const url = search ? `${this.path}?${search}` : this.path;
    await this.page.goto(url);
  }

  /** Convenience wrapper around the data-testid selector convention used across demo-app. */
  protected testId(id: string): Locator {
    return this.page.getByTestId(id);
  }

  /** Wait for the page to be considered loaded (network idle by default). */
  async waitUntilLoaded(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }
}