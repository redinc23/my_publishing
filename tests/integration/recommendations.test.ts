import { describe, it, expect } from 'vitest';
import { recommendationEngine } from '@/lib/ai/recommendation-engine';

describe('Recommendation Engine Integration', () => {
  it('should return recommendations for a user', async () => {
    const result = await recommendationEngine.getRecommendations({
      userId: 'test-user-id',
      limit: 5
    });

    expect(result.recommendations).toHaveLength(5);
    expect(result.recommendations[0]).toHaveProperty('score');
    expect(result.recommendations[0].score).toBeGreaterThan(0);
  });

  it('should handle cache correctly', async () => {
    const first = await recommendationEngine.getRecommendations({
      userId: 'test-user-id'
    });

    const second = await recommendationEngine.getRecommendations({
      userId: 'test-user-id'
    });

    expect(first.metadata.cached).toBe(false);
    expect(second.metadata.cached).toBe(true);
  });
});
