import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

class ConnectionPool {
  private static instance: ConnectionPool;
  private pool: ReturnType<typeof createClient<Database>>[] = [];
  private readonly maxConnections = 10;

  private constructor() {
    for (let i = 0; i < this.maxConnections; i++) {
      this.pool.push(
        createClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
      );
    }
  }

  static getInstance(): ConnectionPool {
    if (!this.instance) this.instance = new ConnectionPool();
    return this.instance;
  }

  getConnection() {
    return this.pool[Math.floor(Math.random() * this.maxConnections)];
  }
}

export const pool = ConnectionPool.getInstance();
