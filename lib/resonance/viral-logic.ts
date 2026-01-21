/**
 * Calculate viral coefficient for a book
 */
export function calculateViralCoefficient(
  shares: number,
  purchases: number,
  reads: number,
  ratings: number
): number {
  // Simple viral coefficient calculation
  // In production, this would be more sophisticated
  const shareWeight = 0.3;
  const purchaseWeight = 0.4;
  const readWeight = 0.2;
  const ratingWeight = 0.1;

  const coefficient =
    shares * shareWeight +
    purchases * purchaseWeight +
    reads * readWeight +
    ratings * ratingWeight;

  return Math.min(coefficient / 100, 1); // Normalize to 0-1
}
