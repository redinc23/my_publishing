import { Counter, Histogram, Registry } from 'prom-client';

const register = new Registry();

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

export const recommendationCacheHits = new Counter({
  name: 'recommendation_cache_hits_total',
  help: 'Total number of recommendation cache hits',
  registers: [register]
});

export const recommendationCacheMisses = new Counter({
  name: 'recommendation_cache_misses_total',
  help: 'Total number of recommendation cache misses',
  registers: [register]
});

export async function getMetrics(): Promise<string> {
  return register.metrics();
}
