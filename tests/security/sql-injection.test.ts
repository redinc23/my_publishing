import { describe, it, expect } from 'vitest';
import { recommendationEngine } from '@/lib/ai/recommendation-engine';

describe('SQL Injection Prevention', () => {
  it('should sanitize malicious input in excludeIds', async () => {
    const maliciousInput = ["1'; DROP TABLE books; --"];

    await expect(
      recommendationEngine.getRecommendations({
        userId: 'test-user',
        excludeIds: maliciousInput
      })
    ).rejects.toThrow();
  });

  it('should reject non-UUID book IDs', async () => {
    await expect(
      recommendationEngine.getRecommendations({
        bookId: 'not-a-uuid'
      })
    ).rejects.toThrow();
  });
});
