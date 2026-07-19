/**
 * MongoDB Atlas client for Next.js / Vercel.
 *
 * Uses a process-global client promise in development (HMR-safe) and
 * attachDatabasePool on Vercel Fluid Compute so idle connections are
 * released before freeze.
 *
 * Server-only — do not import from Client Components.
 */

import { MongoClient, type Db, type MongoClientOptions } from 'mongodb';
import { assertMongoUri, getMongoDbName } from '@/lib/mongodb-config';

export { getMongoDbName, isMongoConfigured } from '@/lib/mongodb-config';

const globalForMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoPoolAttached?: boolean;
};

const options: MongoClientOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
};

function createClientPromise(): Promise<MongoClient> {
  const client = new MongoClient(assertMongoUri(), options);

  // Soft-attach for Fluid Compute when @vercel/functions is available.
  // Dynamic import keeps local/unit paths working without a Vercel runtime.
  if (!globalForMongo._mongoPoolAttached) {
    globalForMongo._mongoPoolAttached = true;
    void import('@vercel/functions')
      .then(({ attachDatabasePool }) => {
        attachDatabasePool(client);
      })
      .catch(() => {
        // Non-Vercel / missing package — connection still works.
      });
  }

  return client.connect();
}

/**
 * Shared MongoClient promise (one per process).
 */
export function getMongoClientPromise(): Promise<MongoClient> {
  if (!globalForMongo._mongoClientPromise) {
    globalForMongo._mongoClientPromise = createClientPromise();
  }
  return globalForMongo._mongoClientPromise;
}

export async function getDb(dbName?: string): Promise<Db> {
  const client = await getMongoClientPromise();
  return client.db(dbName ?? getMongoDbName());
}

export interface MongoPingResult {
  ok: boolean;
  latency_ms: number;
  message?: string;
}

/**
 * Ping the cluster (admin command). Used by readiness when MONGODB_URI is set.
 */
export async function pingMongo(): Promise<MongoPingResult> {
  const start = Date.now();
  try {
    const client = await getMongoClientPromise();
    await client.db('admin').command({ ping: 1 });
    const latency_ms = Date.now() - start;
    return {
      ok: true,
      latency_ms,
      message: latency_ms > 1000 ? 'Ping slow (>1s)' : undefined,
    };
  } catch (error) {
    const latency_ms = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, latency_ms, message };
  }
}

/** Test-only: clear cached client (does not close live sockets). */
export function __resetMongoClientForTests(): void {
  delete globalForMongo._mongoClientPromise;
  delete globalForMongo._mongoPoolAttached;
}
