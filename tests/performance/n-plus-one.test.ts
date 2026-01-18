import { describe, it, expect, beforeEach } from 'vitest';
import { embeddingsService } from '@/lib/ai/embeddings-service';
import { pool } from '@/lib/database/connection-pool';

describe('N+1 Query Prevention', () => {
  it('should batch similarity calculations', async () => {
    const client = pool.getConnection();
    let queryCount = 0;

    const originalFrom = client.from.bind(client);
    client.from = (...args: any[]) => {
      queryCount++;
      return originalFrom(...args);
    };

    await embeddingsService.batchCalculateSimilarity(['id1', 'id2', 'id3']);

    expect(queryCount).toBeLessThan(3); // Should be 1 batch query
  });
});
