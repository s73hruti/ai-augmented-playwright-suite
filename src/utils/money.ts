/**
 * Pure, framework-agnostic pricing helpers shared by the test suite.
 *
 * These mirror the formatting/summing logic in demo-app/js/app.js, but live
 * here as plain TypeScript so they can be unit tested in isolation (no
 * browser, no localStorage) and imported directly by Playwright specs that
 * want to compute an expected total from raw menu data instead of
 * hardcoding a price string.
 */

export interface CartLine {
  price: number;
  qty: number;
}

/** Sums price * qty across every line in a cart. */
export function sumCartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.qty, 0);
}

/** Formats an amount with a currency symbol, always to two decimal places. */
export function formatMoney(amount: number, currency: string): string {
  return `${currency}${amount.toFixed(2)}`;
}