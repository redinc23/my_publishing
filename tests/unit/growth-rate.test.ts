/**
 * Unit tests for period growth-rate calculation (Fix C6).
 */
import {
  calculatePeriodGrowthRate,
  calculatePercentageChange,
} from '@/lib/utils/analytics-helpers';

describe('calculatePeriodGrowthRate', () => {
  it('returns positive growth', () => {
    expect(calculatePeriodGrowthRate(150, 100)).toBe(50);
  });

  it('returns negative growth', () => {
    expect(calculatePeriodGrowthRate(50, 100)).toBe(-50);
  });

  it('returns 0 for flat periods', () => {
    expect(calculatePeriodGrowthRate(100, 100)).toBe(0);
  });

  it('returns null when previous period has no data', () => {
    expect(calculatePeriodGrowthRate(100, 0)).toBeNull();
    expect(calculatePeriodGrowthRate(0, 0)).toBeNull();
  });

  it('rounds to whole percent', () => {
    expect(calculatePeriodGrowthRate(110, 300)).toBe(-63);
    expect(calculatePeriodGrowthRate(101, 300)).toBe(-66);
  });
});

describe('calculatePercentageChange (legacy behavior preserved)', () => {
  it('returns 100 when growing from zero', () => {
    expect(calculatePercentageChange(50, 0)).toBe(100);
  });

  it('returns 0 for zero on zero', () => {
    expect(calculatePercentageChange(0, 0)).toBe(0);
  });
});
