import { describe, it, expect } from 'vitest';
import {
  cn, formatCurrency, formatAmount, formatInteger,
  formatDate, formatDateTime, formatDateShort,
  formatThousands, formatPercent,
  calculateAmountWithoutVat, calculateVatAmount,
  pluralize, pluralizeDays,
  isEmpty, safeParseFloat, safeParseInt,
  buildQueryString, stripHtml, truncate,
} from '../utils';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters falsy values', () => {
    expect(cn('a', undefined, null, false, 'b')).toBe('a b');
  });

  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });
});

describe('formatCurrency', () => {
  it('formats number with RUB symbol', () => {
    const result = formatCurrency(1234.56, 'RUB');
    expect(result).toContain('₽');
    // Locale-specific formatting, just check symbol and approximate value
    expect(result).toMatch(/1.*234.*56/);
  });

  it('formats string amounts', () => {
    const result = formatCurrency('999.99', 'USD');
    expect(result).toContain('$');
  });

  it('returns dash for null', () => {
    expect(formatCurrency(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(formatCurrency(undefined)).toBe('—');
  });

  it('returns dash for NaN string', () => {
    expect(formatCurrency('not a number')).toBe('—');
  });
});

describe('formatAmount', () => {
  it('formats number without currency', () => {
    const result = formatAmount(1000);
    expect(result).toMatch(/1.*000.*00/);
  });

  it('returns 0.00 for null', () => {
    expect(formatAmount(null)).toBe('0.00');
  });
});

describe('formatInteger', () => {
  it('formats integer without decimals', () => {
    const result = formatInteger(42);
    expect(result).toBe('42');
  });

  it('returns 0 for null', () => {
    expect(formatInteger(null)).toBe('0');
  });
});

describe('formatDate', () => {
  it('formats ISO date', () => {
    expect(formatDate('2024-01-15')).toMatch(/15/);
  });
  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });
});

describe('formatDateTime', () => {
  it('formats ISO datetime', () => {
    expect(formatDateTime('2024-01-15T10:30:00')).toMatch(/15/);
  });
  it('returns dash for null', () => {
    expect(formatDateTime(null)).toBe('—');
  });
});

describe('formatDateShort', () => {
  it('formats short date', () => {
    expect(formatDateShort('2024-01-15')).toMatch(/15/);
  });
  it('returns dash for null', () => {
    expect(formatDateShort(null)).toBe('—');
  });
});

describe('formatThousands', () => {
  it('divides by 1000 and formats', () => {
    const result = formatThousands(1234567);
    expect(result).toMatch(/1.*235/); // 1234567/1000 ≈ 1235
  });
  it('returns 0 for null', () => {
    expect(formatThousands(null)).toBe('0');
  });
});

describe('formatPercent', () => {
  it('formats percent with % sign', () => {
    const result = formatPercent(42.5);
    expect(result).toContain('%');
  });
  it('returns 0% for null', () => {
    expect(formatPercent(null)).toBe('0%');
  });
});

describe('calculateAmountWithoutVat', () => {
  it('calculates without VAT using multiplier', () => {
    // vatMultiplier=1.2 means 20% VAT: 120/1.2 = 100
    const result = calculateAmountWithoutVat(120, 1.2);
    expect(result).toBeCloseTo(100, 1);
  });
  it('returns amount for multiplier=1', () => {
    expect(calculateAmountWithoutVat(100, 1)).toBeCloseTo(100, 1);
  });
});

describe('calculateVatAmount', () => {
  it('calculates VAT amount using multiplier', () => {
    // 120 - 120/1.2 = 120 - 100 = 20
    const result = calculateVatAmount(120, 1.2);
    expect(result).toBeCloseTo(20, 1);
  });
});

describe('pluralize', () => {
  it('returns correct form for 1 (word only)', () => {
    expect(pluralize(1, ['день', 'дня', 'дней'])).toBe('день');
  });
  it('returns correct form for 2', () => {
    expect(pluralize(2, ['день', 'дня', 'дней'])).toBe('дня');
  });
  it('returns correct form for 5', () => {
    expect(pluralize(5, ['день', 'дня', 'дней'])).toBe('дней');
  });
  it('returns correct form for 21', () => {
    expect(pluralize(21, ['день', 'дня', 'дней'])).toBe('день');
  });
});

describe('pluralizeDays', () => {
  it('returns word form', () => {
    expect(pluralizeDays(1)).toBe('день');
    expect(pluralizeDays(5)).toBe('дней');
  });
});

describe('isEmpty', () => {
  it('returns true for null', () => { expect(isEmpty(null)).toBe(true); });
  it('returns true for undefined', () => { expect(isEmpty(undefined)).toBe(true); });
  it('returns true for empty string', () => { expect(isEmpty('')).toBe(true); });
  it('returns false for non-empty string', () => { expect(isEmpty('a')).toBe(false); });
  it('returns false for 0', () => { expect(isEmpty(0)).toBe(false); });
});

describe('safeParseFloat', () => {
  it('parses number', () => { expect(safeParseFloat(3.14)).toBe(3.14); });
  it('parses string', () => { expect(safeParseFloat('3.14')).toBe(3.14); });
  it('returns 0 for null', () => { expect(safeParseFloat(null)).toBe(0); });
  it('returns 0 for invalid', () => { expect(safeParseFloat('abc')).toBe(0); });
});

describe('safeParseInt', () => {
  it('parses number', () => { expect(safeParseInt(42)).toBe(42); });
  it('parses string', () => { expect(safeParseInt('42')).toBe(42); });
  it('returns 0 for null', () => { expect(safeParseInt(null)).toBe(0); });
});

describe('buildQueryString', () => {
  it('builds from params with ? prefix', () => {
    expect(buildQueryString({ a: '1', b: '2' })).toBe('?a=1&b=2');
  });
  it('skips null/undefined', () => {
    expect(buildQueryString({ a: '1', b: null, c: undefined })).toBe('?a=1');
  });
  it('returns empty for no params', () => {
    expect(buildQueryString({})).toBe('');
  });
});

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    expect(stripHtml('<p>hello <b>world</b></p>')).toBe('hello world');
  });
  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });
});

describe('truncate', () => {
  it('truncates long text with ellipsis', () => {
    const result = truncate('hello world', 5);
    expect(result).toContain('…');
    expect(result.length).toBeLessThanOrEqual(6); // 5 + '…'
  });
  it('keeps short text', () => {
    expect(truncate('hi', 10)).toBe('hi');
  });
});
