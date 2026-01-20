
import { AnalyticsOptimizer } from '../../lib/utils/analytics-optimizer';

describe('AnalyticsOptimizer', () => {
  describe('batchRequests', () => {
    it('should process requests in batches', async () => {
      const requests = [
        () => Promise.resolve(1),
        () => Promise.resolve(2),
        () => Promise.resolve(3),
        () => Promise.resolve(4),
        () => Promise.resolve(5),
      ];

      const results = await AnalyticsOptimizer.batchRequests(requests, 2);
      expect(results).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle errors gracefully', async () => {
        const requests = [
            () => Promise.resolve(1),
            () => Promise.reject(new Error('Failed')),
            () => Promise.resolve(3),
        ];

        // Mock console.error to avoid cluttering test output
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const results = await AnalyticsOptimizer.batchRequests(requests, 2);

        expect(results).toEqual([1, 3]);
        expect(consoleSpy).toHaveBeenCalledWith('Batch request failed:', expect.any(Error));

        consoleSpy.mockRestore();
    });

    it('should filter out falsy values (existing behavior)', async () => {
         const requests = [
            () => Promise.resolve(1),
            () => Promise.resolve(0),
            () => Promise.resolve(null as any),
            () => Promise.resolve(false as any),
            () => Promise.resolve(3),
        ];

        const results = await AnalyticsOptimizer.batchRequests(requests, 5);
        // Current behavior filters out 0, null, false
        expect(results).toEqual([1, 3]);
    });

    it('should handle empty requests array', async () => {
        const results = await AnalyticsOptimizer.batchRequests([], 5);
        expect(results).toEqual([]);
    });

    it('should respect batch size', async () => {
        let concurrent = 0;
        let maxConcurrent = 0;

        const createRequest = (id: number) => async () => {
            concurrent++;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            await new Promise(resolve => setTimeout(resolve, 10));
            concurrent--;
            return id;
        };

        const requests = Array.from({ length: 10 }, (_, i) => createRequest(i));

        await AnalyticsOptimizer.batchRequests(requests, 3);

        // Since JS is single threaded event loop, we can't perfectly measure concurrency this way without shared array buffers or similar,
        // but since we await Promise.all inside the loop, the next batch won't start until current batch finishes.
        // So concurrent should not exceed batch size.
        // Wait, Promise.all runs them "in parallel".

        // This test logic is a bit flawed for checking "batching" behavior strictly in unit tests without mocking timers or Promise.all.
        // However, the implementation clearly awaits each batch.

        // Let's stick to functional correctness.
        expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });
});
