/**
 * JSON-safe serialization for Mongo documents returned from API routes.
 * Converts ObjectId → string and Date → ISO string (recursively).
 */

import { ObjectId } from 'mongodb';

export function serializeMongoValue(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof ObjectId) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeMongoValue);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeMongoValue(v);
    }
    return out;
  }
  return value;
}

export function serializeMongoDoc<T>(doc: T): T {
  return serializeMongoValue(doc) as T;
}
