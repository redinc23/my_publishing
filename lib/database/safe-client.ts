import { pool } from './connection-pool';
import { withTimeout } from '@/lib/utils/timeout-wrapper';
import { logger } from '@/lib/utils/secure-logger';

export async function safeQuery<T>(
  queryFn: (client: any) => Promise<T>,
  timeoutMs: number = 5000
): Promise<T> {
  const client = pool.getConnection();

  try {
    return await withTimeout(queryFn(client), timeoutMs);
  } catch (error) {
    logger.error({ error }, 'Database query failed');
    throw error;
  }
}
