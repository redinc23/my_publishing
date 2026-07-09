/**
 * Unified rate limiting (Finding-1 / Fix C8)
 *
 * Single source of truth for ALL rate limiting:
 *  - Upstash Redis (@upstash/ratelimit) when configured → shared state across
 *    Cloud Run instances.
 *  - FAIL-CLOSED: if Upstash is configured but unreachable/erroring, requests
 *    to protected buckets are REJECTED (reason: 'unavailable'), never silently
 *    allowed.
 *  - In production without Upstash configured → also fail-closed.
 *  - Dev / test / USE_MOCKS=true without Upstash → in-memory sliding-window
 *    fallback so local flows and CI still enforce limits without Redis.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitBucket =
  | "auth"              // middleware: auth endpoints per IP
  | "authAction"        // server actions: login/register per IP/email
  | "passwordReset"     // server action: per email
  | "emailVerification" // server action: per email
  | "upload"            // middleware + upload API per IP
  | "api"               // general API routes (resonance, …)
  | "analytics"         // analytics tracking API
  | "webhook";          // Stripe webhook endpoint

interface BucketConfig {
  limit: number;
  /** Window in seconds */
  windowSec: number;
  prefix: string;
}

const BUCKETS: Record<RateLimitBucket, BucketConfig> = {
  auth: { limit: 5, windowSec: 60, prefix: "ratelimit:auth" },
  authAction: { limit: 5, windowSec: 15 * 60, prefix: "ratelimit:auth-action" },
  passwordReset: { limit: 3, windowSec: 60 * 60, prefix: "ratelimit:password-reset" },
  emailVerification: { limit: 3, windowSec: 60 * 60, prefix: "ratelimit:email-verify" },
  upload: { limit: 30, windowSec: 60, prefix: "ratelimit:upload" },
  api: { limit: 30, windowSec: 60, prefix: "ratelimit:api" },
  analytics: { limit: 100, windowSec: 60, prefix: "ratelimit:analytics" },
  webhook: { limit: 1000, windowSec: 60, prefix: "ratelimit:webhook" },
};

export type RateLimitReason = "ok" | "limited" | "unavailable";

export type RateLimitResult = {
  success: boolean;
  /** Why the request was allowed or rejected. */
  reason: RateLimitReason;
  limit: number;
  remaining: number;
  reset: number;
  headers: Record<string, string>;
};

// ── Upstash configuration detection ─────────────────────────────────────────

const PLACEHOLDER_PATTERN = /(dummy|placeholder|example|change-?me|your[-_])/i;

function isMockMode(): boolean {
  return process.env.USE_MOCKS === "true";
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production" && !isMockMode();
}

/**
 * True when real-looking Upstash credentials are present. Placeholder values
 * (dummy/example URLs, non-upstash hosts) are treated as NOT configured so
 * local/CI placeholder envs fall back to the in-memory limiter instead of
 * hammering a dead endpoint and failing closed in dev.
 */
export function isUpstashConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  if (PLACEHOLDER_PATTERN.test(url) || PLACEHOLDER_PATTERN.test(token)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".upstash.io");
  } catch {
    return false;
  }
}

let redisClient: Redis | null = null;
let warnedNoRedis = false;

function getRedis(): Redis | null {
  if (!isUpstashConfigured()) {
    if (!warnedNoRedis) {
      warnedNoRedis = true;
      console.warn(
        "[rate-limit] Upstash not configured; " +
          (isProduction()
            ? "FAIL-CLOSED — protected requests will be rejected"
            : "using in-memory fallback limiter (dev/test only)")
      );
    }
    return null;
  }
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisClient;
}

// ── Upstash limiters (lazy per bucket) ───────────────────────────────────────

const upstashLimiters = new Map<RateLimitBucket, Ratelimit>();

function getUpstashLimiter(bucket: RateLimitBucket): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  let limiter = upstashLimiters.get(bucket);
  if (!limiter) {
    const cfg = BUCKETS[bucket];
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.limit, `${cfg.windowSec} s`),
      analytics: true,
      prefix: cfg.prefix,
    });
    upstashLimiters.set(bucket, limiter);
  }
  return limiter;
}

// ── In-memory fallback (dev/test/mocks only — NOT distributed) ───────────────

const memoryWindows = new Map<string, number[]>();
const MEMORY_MAX_KEYS = 5000;

function memoryCheck(bucket: RateLimitBucket, identifier: string): RateLimitResult {
  const cfg = BUCKETS[bucket];
  const key = `${cfg.prefix}:${identifier}`;
  const now = Date.now();
  const windowMs = cfg.windowSec * 1000;

  const timestamps = (memoryWindows.get(key) || []).filter((ts) => now - ts < windowMs);
  const reset = timestamps.length > 0 ? timestamps[0] + windowMs : now + windowMs;

  if (timestamps.length >= cfg.limit) {
    memoryWindows.set(key, timestamps);
    return buildResult(false, "limited", cfg.limit, 0, reset);
  }

  timestamps.push(now);
  if (memoryWindows.size > MEMORY_MAX_KEYS) {
    const oldest = memoryWindows.keys().next().value;
    if (oldest !== undefined) memoryWindows.delete(oldest);
  }
  memoryWindows.set(key, timestamps);
  return buildResult(true, "ok", cfg.limit, cfg.limit - timestamps.length, reset);
}

/** Test-only helper: clears in-memory fallback state. */
export function __resetMemoryRateLimit(): void {
  memoryWindows.clear();
}

// ── Result helpers ────────────────────────────────────────────────────────────

function buildResult(
  success: boolean,
  reason: RateLimitReason,
  limit: number,
  remaining: number,
  reset: number
): RateLimitResult {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": limit.toString(),
    "X-RateLimit-Remaining": Math.max(0, remaining).toString(),
    "X-RateLimit-Reset": reset.toString(),
  };
  if (!success) {
    headers["Retry-After"] = Math.max(1, Math.ceil((reset - Date.now()) / 1000)).toString();
  }
  return { success, reason, limit, remaining: Math.max(0, remaining), reset, headers };
}

function unavailableResult(bucket: RateLimitBucket): RateLimitResult {
  const cfg = BUCKETS[bucket];
  // Fail-closed rejection: limiter state unknown → reject.
  return {
    success: false,
    reason: "unavailable",
    limit: cfg.limit,
    remaining: 0,
    reset: Date.now() + 30_000,
    headers: { "Retry-After": "30" },
  };
}

// ── Primary API ───────────────────────────────────────────────────────────────

/**
 * Enforce the rate limit for a bucket. FAIL-CLOSED semantics:
 *  - Upstash configured → enforced via Redis; on runtime error → rejected
 *    (`reason: 'unavailable'`).
 *  - Upstash not configured → production: rejected; dev/test/mocks: in-memory.
 */
export async function enforceRateLimit(
  bucket: RateLimitBucket,
  identifier: string
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(bucket);

  if (!limiter) {
    if (isProduction()) {
      return unavailableResult(bucket);
    }
    return memoryCheck(bucket, identifier);
  }

  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    return buildResult(success, success ? "ok" : "limited", limit, remaining, reset);
  } catch (error) {
    console.error(`[rate-limit] Upstash error for bucket "${bucket}" — failing closed:`, error);
    return unavailableResult(bucket);
  }
}

/**
 * Back-compat wrapper used by middleware/tests. FAIL-CLOSED:
 *  - `limiter` null → production: rejected; dev/test: allowed (callers that
 *    need enforcement without Upstash should use `enforceRateLimit`).
 *  - limiter errors → rejected (`reason: 'unavailable'`).
 */
export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit | null
): Promise<RateLimitResult> {
  if (!limiter) {
    if (isProduction()) {
      return {
        success: false,
        reason: "unavailable",
        limit: 0,
        remaining: 0,
        reset: Date.now() + 30_000,
        headers: { "Retry-After": "30" },
      };
    }
    return { success: true, reason: "ok", limit: 0, remaining: 0, reset: 0, headers: {} };
  }
  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    return buildResult(success, success ? "ok" : "limited", limit, remaining, reset);
  } catch (error) {
    console.error("[rate-limit] limiter error — failing closed:", error);
    return {
      success: false,
      reason: "unavailable",
      limit: 0,
      remaining: 0,
      reset: Date.now() + 30_000,
      headers: { "Retry-After": "30" },
    };
  }
}

/** Legacy accessors (middleware/tests). Null when Upstash isn't configured. */
export function getAuthLimiter(): Ratelimit | null {
  return getUpstashLimiter("auth");
}
export function getUploadLimiter(): Ratelimit | null {
  return getUpstashLimiter("upload");
}
export function getGeneralLimiter(): Ratelimit | null {
  return getUpstashLimiter("api");
}

// ── Identifier extraction ────────────────────────────────────────────────────

/** Extract the client identifier (IP) from a request. */
export function getClientIdentifier(request: Request): string {
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp;

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  return "unknown";
}
