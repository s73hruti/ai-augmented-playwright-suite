import { describe, it, expect } from 'vitest';
import { sumCartTotal, formatMoney } from './money.js';

describe('sumCartTotal', () => {
  it('returns 0 for an empty cart', () => {
    expect(sumCartTotal([])).toBe(0);
  });

  it('multiplies price by quantity for a single line', () => {
    expect(sumCartTotal([{ price: 5.79, qty: 2 }])).toBeCloseTo(11.58);
  });

  it('sums multiple lines', () => {
    const total = sumCartTotal([
      { price: 5.79, qty: 1 },
      { price: 2.99, qty: 2 },
    ]);
    expect(total).toBeCloseTo(11.77);
  });
});

describe('formatMoney', () => {
  it('always shows two decimal places', () => {
    expect(formatMoney(5, '$')).toBe('$5.00');
  });

  it('rounds to two decimal places', () => {
    expect(formatMoney(5.999, '$')).toBe('$6.00');
  });

  it('prefixes whatever currency symbol is given, not just $', () => {
    expect(formatMoney(4.99, '€')).toBe('€4.99');
  });
});