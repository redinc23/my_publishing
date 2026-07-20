/**
 * Serialize Mongo documents for JSON API responses (ObjectId → string, Date → ISO).
 */
export function serializeMongo<T>(value: T): unknown {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && '_bsontype' in value) {
    // ObjectId and other BSON types
    return String(value);
  }
  if (Array.isArray(value)) return value.map((v) => serializeMongo(v));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeMongo(v);
    }
    return out;
  }
  return value;
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
