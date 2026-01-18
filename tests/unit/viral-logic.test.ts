/**
 * Unit tests for Resonance Engine viral logic
 */
import { calculateViralCoefficient } from '@/lib/resonance/viral-logic';

describe('Viral Logic', () => {
  describe('calculateViralCoefficient', () => {
    it('calculates viral coefficient for basic metrics', () => {
      const coefficient = calculateViralCoefficient(10, 20, 30, 5);
      expect(coefficient).toBeGreaterThan(0);
      expect(coefficient).toBeLessThanOrEqual(1);
    });

    it('returns 0 when all metrics are 0', () => {
      const coefficient = calculateViralCoefficient(0, 0, 0, 0);
      expect(coefficient).toBe(0);
    });

    it('weights purchases higher than other metrics', () => {
      const withPurchases = calculateViralCoefficient(0, 100, 0, 0);
      const withReads = calculateViralCoefficient(0, 0, 100, 0);
      const withShares = calculateViralCoefficient(100, 0, 0, 0);
      
      expect(withPurchases).toBeGreaterThan(withReads);
      expect(withPurchases).toBeGreaterThan(withShares);
    });

    it('normalizes coefficient to max value of 1', () => {
      const coefficient = calculateViralCoefficient(1000, 1000, 1000, 1000);
      expect(coefficient).toBe(1);
    });

    it('handles high share counts', () => {
      const coefficient = calculateViralCoefficient(500, 0, 0, 0);
      expect(coefficient).toBeGreaterThan(0);
      expect(coefficient).toBeLessThanOrEqual(1);
    });

    it('gives appropriate weight to ratings', () => {
      const withRatings = calculateViralCoefficient(0, 0, 0, 100);
      const withReads = calculateViralCoefficient(0, 0, 100, 0);
      
      // Ratings have lower weight than reads
      expect(withRatings).toBeLessThan(withReads);
    });

    it('combines multiple metrics proportionally', () => {
      const balanced = calculateViralCoefficient(10, 10, 10, 10);
      const purchaseFocused = calculateViralCoefficient(0, 25, 0, 0);
      
      // Purchase weight is 40%, so 25 purchases ~ 10 of each
      expect(Math.abs(balanced - purchaseFocused)).toBeLessThan(0.1);
    });

    it('handles decimal results correctly', () => {
      const coefficient = calculateViralCoefficient(5, 7, 3, 2);
      expect(typeof coefficient).toBe('number');
      expect(Number.isFinite(coefficient)).toBe(true);
    });
  });
});
