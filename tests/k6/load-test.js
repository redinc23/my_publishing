// load-test.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import exec from 'k6/execution';

/**
 * Mangu Publishers — Production-Grade k6 Load Test
 * ================================================
 * Version: 2.0 — Dual executor (vus + arrival), canary, auth support,
 * weighted scenarios, custom metrics, configurable probabilities
 *
 * Next.js 14 (App Router) + Supabase. Runs identically against localhost,
 * staging (Vercel), or production (Cloud Run).
 *
 * TWO EXECUTORS (select with EXECUTOR=vus|arrival, default vus):
 *   vus      → ramping-vus. Models concurrent USERS walking full journeys
 *              (homepage → catalog → detail → recommend). Best for finding the
 *              concurrency ceiling and realistic correlated load.
 *   arrival  → ramping-arrival-rate. Models a target REQUEST RATE (req/s)
 *              independent of how fast the server responds. Best for SLO/RPS
 *              capacity testing. Each arrival fires ONE weighted random request
 *              (NOT the full journey) so the rate you set is the rate you get.
 *
 * RUN EXAMPLES
 *   # Smoke test before a full run
 *   BASE_URL=http://localhost:3000 k6 run --vus 1 --duration 30s load-test.js
 *
 *   # Concurrency / spike test (default)
 *   BASE_URL=https://staging.mangupublishers.com k6 run load-test.js
 *
 *   # Spread load across many books (avoids cache-warming one hot path)
 *   BASE_URL=... \
 *     SAMPLE_BOOK_SLUGS="slug-a,slug-b,slug-c" \
 *     SAMPLE_BOOK_IDS="uuid-a,uuid-b,uuid-c" \
 *     k6 run load-test.js
 *
 *   # True RPS capacity test, ramping 50→200 req/s
 *   EXECUTOR=arrival ARRIVAL_SUSTAINED=50 ARRIVAL_PEAK=200 BASE_URL=... k6 run load-test.js
 *
 *   # Authenticated flow (protected routes)
 *   BASE_URL=... AUTH_TOKEN=<supabase_jwt> k6 run load-test.js
 *
 * HOW TO GET AN AUTH_TOKEN FOR TESTING
 *   1. Log in to the app in a browser.
 *   2. DevTools → Application → LocalStorage → supabase.auth.token
 *   3. Copy the "access_token" value.
 *   4. BASE_URL=... AUTH_TOKEN="eyJhbG..." k6 run load-test.js
 *   For CI, extend setup() to mint a token via Supabase's admin (service_role) API.
 *
 * OPTIONAL ENVIRONMENT VARIABLES
 *   BASE_URL            Target origin (default: http://localhost:3000)
 *   EXECUTOR            "vus" | "arrival"            (default: vus)
 *   AUTH_TOKEN          Supabase JWT — enables authenticated flow group
 *   SAMPLE_BOOK_ID(S)   Real book UUID(s)   — singular or comma-separated list
 *   SAMPLE_BOOK_SLUG(S) Real book slug(s)   — singular or comma-separated list
 *   SAMPLE_AUTHOR_ID(S) Real author UUID(s) — singular or comma-separated list
 *   RAMP_PEAK           Peak VUs (vus mode)          (default: 120)
 *   SUSTAINED_VUS       Sustained VUs (vus mode)     (default: 60)
 *   ARRIVAL_PEAK        Peak req/s (arrival mode)    (default: 100)
 *   ARRIVAL_SUSTAINED   Sustained req/s (arrival)    (default: 50)
 *   ARRIVAL_MAX_VUS     VU ceiling (arrival mode)    (default: 300)
 *   ENVIRONMENT         Free-text tag for outputs    (default: derived from URL)
 *   REQUEST_TIMEOUT     Per-request timeout          (default: 20s)
 *   PAGE_THINK_MIN/MAX  Page think-time seconds      (default: 1 / 3)
 *   API_THINK_MIN/MAX   API think-time seconds       (default: 0.5 / 1)
 *   DETAIL_PROBABILITY  Arrival-mode book detail hit  (default: 0.20)
 *   SIMILAR_PROBABILITY Arrival-mode similar API hit   (default: 0.15)
 *   SKIP_PREFLIGHT=1    Bypass the setup() reachability check
 */

// ---------------------------------------------------------------------------
// Env parsing helpers (validated, so a typo never silently becomes NaN VUs)
// ---------------------------------------------------------------------------
function envString(name, fallback = '') {
  const raw = __ENV[name];
  return raw === undefined || raw === null || raw === '' ? fallback : String(raw);
}

function envInt(name, fallback) {
  const raw = __ENV[name];
  if (raw === undefined || raw === '') return fallback;
  const value = parseInt(raw, 10);
  if (Number.isNaN(value) || value < 0) {
    console.warn(`[config] ${name}="${raw}" is invalid; using ${fallback}`);
    return fallback;
  }
  return value;
}

function envFloat(name, fallback) {
  const raw = __ENV[name];
  if (raw === undefined || raw === '') return fallback;
  const value = parseFloat(raw);
  if (Number.isNaN(value) || value < 0) {
    console.warn(`[config] ${name}="${raw}" is invalid; using ${fallback}`);
    return fallback;
  }
  return value;
}

function envBool(name, fallback = false) {
  const raw = envString(name, '');
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function envEnum(name, allowed, fallback) {
  const raw = envString(name, '').toLowerCase();
  if (!raw) return fallback;
  if (!allowed.includes(raw)) {
    console.warn(`[config] ${name}="${raw}" not in [${allowed.join(', ')}]; using ${fallback}`);
    return fallback;
  }
  return raw;
}

function envList(...names) {
  const values = [];
  for (const name of names) {
    const raw = envString(name, '');
    if (!raw) continue;
    for (const part of raw.split(',')) {
      const value = part.trim();
      if (value && !values.includes(value)) values.push(value);
    }
  }
  return values;
}

function pickRandom(items) {
  if (!items || items.length === 0) return '';
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(min, max) {
  if (max <= min) return min;
  return Math.random() * (max - min) + min;
}

function sleepBetween(min, max) {
  sleep(randomBetween(min, max));
}

function parseDurationSeconds(value) {
  let total = 0;
  const regex = /(\d+)(h|m|s)/g;
  let match;
  while ((match = regex.exec(value)) !== null) {
    const n = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 'h') total += n * 3600;
    else if (unit === 'm') total += n * 60;
    else total += n;
  }
  return total;
}

function deriveEnvironment(baseUrl, explicit) {
  if (explicit) return explicit;
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) return 'local';
  if (baseUrl.includes('staging')) return 'staging';
  return 'production';
}

function getContentType(headers) {
  return (headers['Content-Type'] || headers['content-type'] || '').toLowerCase();
}

function isHtmlResponse(response) {
  return getContentType(response.headers).includes('text/html');
}

function isJsonResponse(response) {
  return getContentType(response.headers).includes('application/json');
}

function safeJson(response) {
  try {
    return response.json();
  } catch (_error) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Single source of truth for configuration
// ---------------------------------------------------------------------------
const CONFIG = (() => {
  const baseUrl = envString('BASE_URL', 'http://localhost:3000').replace(/\/+$/, '');
  return {
    baseUrl,
    executor: envEnum('EXECUTOR', ['vus', 'arrival'], 'vus'),
    authToken: envString('AUTH_TOKEN', ''),
    skipPreflight: envBool('SKIP_PREFLIGHT', false),
    requestTimeout: envString('REQUEST_TIMEOUT', '20s'),
    environment: deriveEnvironment(baseUrl, envString('ENVIRONMENT', '')),

    // vus-mode profile
    rampPeak: envInt('RAMP_PEAK', 120),
    sustainedVus: envInt('SUSTAINED_VUS', 60),

    // arrival-mode profile (requests/second)
    arrivalPeak: envInt('ARRIVAL_PEAK', 100),
    arrivalSustained: envInt('ARRIVAL_SUSTAINED', 50),
    arrivalMaxVus: envInt('ARRIVAL_MAX_VUS', 300),

    think: {
      pageMin: envFloat('PAGE_THINK_MIN', 1),
      pageMax: envFloat('PAGE_THINK_MAX', 3),
      apiMin: envFloat('API_THINK_MIN', 0.5),
      apiMax: envFloat('API_THINK_MAX', 1),
      loopMin: 2,
      loopMax: 4,
    },

    // Probabilities for arrival-mode dynamic endpoint exercises
    detailProbability: envFloat('DETAIL_PROBABILITY', 0.20),
    similarProbability: envFloat('SIMILAR_PROBABILITY', 0.15),

    samples: {
      bookSlugs: envList('SAMPLE_BOOK_SLUGS', 'SAMPLE_BOOK_SLUG'),
      bookIds: envList('SAMPLE_BOOK_IDS', 'SAMPLE_BOOK_ID'),
      authorIds: envList('SAMPLE_AUTHOR_IDS', 'SAMPLE_AUTHOR_ID'),
    },
  };
})();

// ---------------------------------------------------------------------------
// Stage profiles. Durations are identical across executors so the canary
// duration (derived below) always brackets the run regardless of mode.
// ---------------------------------------------------------------------------
const STAGE_DURATIONS = ['1m', '2m', '3m', '30s', '1m', '1m', '1m'];

// vus mode: stage.target = concurrent VUs
const VUS_STAGES = [
  { duration: '1m', target: 20 },                  // warm-up: caches, JIT, DB pools
  { duration: '2m', target: CONFIG.sustainedVus }, // ramp to baseline
  { duration: '3m', target: CONFIG.sustainedVus }, // sustained "normal busy"
  { duration: '30s', target: CONFIG.rampPeak },    // SPIKE (~2x baseline)
  { duration: '1m', target: CONFIG.rampPeak },     // hold the spike
  { duration: '1m', target: CONFIG.sustainedVus }, // recovery
  { duration: '1m', target: 0 },                   // graceful ramp-down
];

// arrival mode: stage.target = requests/second
const ARRIVAL_STAGES = [
  { duration: '1m', target: Math.round(CONFIG.arrivalSustained * 0.4) },
  { duration: '2m', target: CONFIG.arrivalSustained },
  { duration: '3m', target: CONFIG.arrivalSustained },
  { duration: '30s', target: CONFIG.arrivalPeak },
  { duration: '1m', target: CONFIG.arrivalPeak },
  { duration: '1m', target: CONFIG.arrivalSustained },
  { duration: '1m', target: 0 },
];

const MAIN_TOTAL_SECONDS = STAGE_DURATIONS.reduce((sum, d) => sum + parseDurationSeconds(d), 0);
const CANARY_DURATION = `${MAIN_TOTAL_SECONDS + 30}s`;

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const metrics = {
  businessErrors: new Rate('business_errors'),        // logical/content failures
  unexpected5xxRate: new Rate('unexpected_5xx_rate'), // 5xx on a request we didn't allow it on
  pageLatency: new Trend('page_latency', true),
  apiLatency: new Trend('api_latency', true),
  requestsTotal: new Counter('requests_total'),
  pageRequests: new Counter('page_requests_total'),
  apiRequests: new Counter('api_requests_total'),
  authRequests: new Counter('auth_requests_total'),
  anonRequests: new Counter('anon_requests_total'),
  status1xx: new Counter('http_status_1xx'),
  status2xx: new Counter('http_status_2xx'),
  status3xx: new Counter('http_status_3xx'),
  status4xx: new Counter('http_status_4xx'),
  status5xx: new Counter('http_status_5xx'),
  unexpected4xx: new Counter('unexpected_4xx'),
  unexpected5xx: new Counter('unexpected_5xx'),
  criticalEndpointFailures: new Rate('critical_endpoint_failures'),
  rateLimited429: new Counter('rate_limited_429'),
};

const COMMON_HEADERS = {
  'User-Agent': 'k6-loadtest/3.1 (+https://github.com/redinc23/my_publishing)',
  Accept: 'text/html,application/json',
};

// ---------------------------------------------------------------------------
// Core request engine — every page/api/auth call funnels through here so
// tags, timeouts, metrics, and checks are applied identically everywhere.
// ---------------------------------------------------------------------------
function baseParams(tags, extraHeaders = {}) {
  return {
    headers: { ...COMMON_HEADERS, ...extraHeaders },
    tags,
    timeout: CONFIG.requestTimeout,
  };
}

function classifyStatus(status) {
  if (status >= 100 && status < 200) metrics.status1xx.add(1);
  else if (status >= 200 && status < 300) metrics.status2xx.add(1);
  else if (status >= 300 && status < 400) metrics.status3xx.add(1);
  else if (status >= 400 && status < 500) metrics.status4xx.add(1);
  else if (status >= 500) metrics.status5xx.add(1);
  if (status === 429) metrics.rateLimited429.add(1);
}

function recordRequest(response, meta) {
  metrics.requestsTotal.add(1);
  classifyStatus(response.status);

  if (meta.type === 'page') {
    metrics.pageRequests.add(1);
    metrics.pageLatency.add(response.timings.duration);
  } else {
    metrics.apiRequests.add(1);
    metrics.apiLatency.add(response.timings.duration);
  }

  if (meta.auth) metrics.authRequests.add(1);
  else metrics.anonRequests.add(1);
}

function recordUnexpectedStatus(response, acceptableStatuses, isCritical = false) {
  const allowed = acceptableStatuses.includes(response.status);
  const is5xx = response.status >= 500;
  // Feed the 5xx rate metric on every request so the threshold scales with
  // traffic (a hair-trigger count<1 would fail the run on a single transient
  // 5xx at peak — exactly the thing a spike test is meant to observe).
  metrics.unexpected5xxRate.add(!allowed && is5xx);
  // Critical endpoint failures: track when high-value endpoints (homepage,
  // login, recommend, session) return unacceptable statuses.
  metrics.criticalEndpointFailures.add(isCritical && !allowed);
  if (allowed) return;
  if (response.status >= 400 && response.status < 500) metrics.unexpected4xx.add(1);
  if (is5xx) metrics.unexpected5xx.add(1);
}

// "strict"  → we only accept 200; any deviation is a real problem.
// "tolerant"→ we deliberately allow degraded/non-200 statuses (e.g. 503/401).
// This carries real signal (which endpoints we're lenient on) instead of a
// constant placeholder tag, and stays cheap (one of two values).
function deriveExpectation(acceptableStatuses) {
  return acceptableStatuses.length === 1 && acceptableStatuses[0] === 200 ? 'strict' : 'tolerant';
}

function sendRequest({
  method,
  name,
  path,
  type,
  auth = false,
  acceptableStatuses = [200],
  expected = null,
  body = null,
  validate = null,
  extraChecks = null,
  extraHeaders = {},
  critical = false,
}) {
  const tags = {
    name,
    type, // already exactly 'page' | 'api' — no redundant 'surface' tag
    auth: auth ? 'true' : 'false',
    expected: expected || deriveExpectation(acceptableStatuses),
  };

  const params = baseParams(tags, extraHeaders);
  let response;
  if (method === 'GET') {
    response = http.get(`${CONFIG.baseUrl}${path}`, params);
  } else if (method === 'POST') {
    response = http.post(`${CONFIG.baseUrl}${path}`, body, params);
  } else {
    throw new Error(`Unsupported method: ${method}`);
  }

  recordRequest(response, { type, auth });

  const checksMap = {
    [`${name}: acceptable status`]: (r) => acceptableStatuses.includes(r.status),
  };

  if (type === 'page') {
    checksMap[`${name}: content-type html`] = (r) => isHtmlResponse(r);
    checksMap[`${name}: body substantial`] = (r) => r.body !== null && r.body.length > 500;
  } else {
    checksMap[`${name}: json when 2xx`] = (r) => {
      if (r.status < 200 || r.status >= 300) return true; // only assert JSON on success
      return isJsonResponse(r) || safeJson(r) !== null;
    };
  }

  if (validate) {
    checksMap[`${name}: valid payload`] = (r) => {
      if (!acceptableStatuses.includes(r.status)) return true; // don't validate bodies we didn't expect
      return validate(safeJson(r), r);
    };
  }

  if (extraChecks) {
    for (const [key, fn] of Object.entries(extraChecks)) checksMap[key] = fn;
  }

  const ok = check(response, checksMap);
  metrics.businessErrors.add(!ok);
  recordUnexpectedStatus(response, acceptableStatuses, critical);

  return response;
}

// ---------------------------------------------------------------------------
// Thin, ergonomic wrappers over sendRequest
// ---------------------------------------------------------------------------
function getPage(name, path, opts = {}) {
  return sendRequest({
    method: 'GET', name, path, type: 'page', auth: false,
    acceptableStatuses: opts.acceptableStatuses || [200],
    validate: opts.validate || null,
    extraChecks: opts.extraChecks || null,
    critical: opts.critical || false,
  });
}

function getApi(name, path, opts = {}) {
  return sendRequest({
    method: 'GET', name, path, type: 'api', auth: !!opts.auth,
    acceptableStatuses: opts.acceptableStatuses || [200],
    validate: opts.validate || null,
    extraChecks: opts.extraChecks || null,
    extraHeaders: opts.extraHeaders || { Accept: 'application/json' },
    critical: opts.critical || false,
  });
}

function postApi(name, path, payload, opts = {}) {
  return sendRequest({
    method: 'POST', name, path, type: 'api', auth: !!opts.auth,
    body: JSON.stringify(payload),
    acceptableStatuses: opts.acceptableStatuses || [200],
    validate: opts.validate || null,
    extraChecks: opts.extraChecks || null,
    extraHeaders: { Accept: 'application/json', 'Content-Type': 'application/json', ...(opts.extraHeaders || {}) },
    critical: opts.critical || false,
  });
}

function authHeaders(token) {
  return { Accept: 'application/json', Authorization: `Bearer ${token}` };
}

function getAuthedPage(name, path, token, opts = {}) {
  return sendRequest({
    method: 'GET', name, path, type: 'page', auth: true,
    acceptableStatuses: opts.acceptableStatuses || [200],
    validate: opts.validate || null,
    extraChecks: opts.extraChecks || null,
    extraHeaders: { Authorization: `Bearer ${token}` },
    critical: opts.critical || false,
  });
}

function getAuthedApi(name, path, token, opts = {}) {
  return sendRequest({
    method: 'GET', name, path, type: 'api', auth: true,
    acceptableStatuses: opts.acceptableStatuses || [200],
    validate: opts.validate || null,
    extraChecks: opts.extraChecks || null,
    extraHeaders: authHeaders(token),
    critical: opts.critical || false,
  });
}

function postAuthedApi(name, path, payload, token, opts = {}) {
  return postApi(name, path, payload, { ...opts, auth: true, extraHeaders: authHeaders(token) });
}

// ---------------------------------------------------------------------------
// Validators / content checks
// ---------------------------------------------------------------------------
function hasAnyUserShape(value) {
  if (!value || typeof value !== 'object') return false;
  return !!(value.user || value.id || value.email);
}
function validateLivePayload(data) {
  return !!(data && data.status === 'alive');
}
function validateHealthPayload(data) {
  return !!(data && typeof data.status === 'string' && ('checks' in data || 'timestamp' in data));
}
function validateSessionPayload(data) {
  if (data === null || data === undefined) return true; // anon session may be empty
  return typeof data === 'object';
}
function validateSessionUserPayload(data) {
  return hasAnyUserShape(data);
}
function validateRecommendationPayload(data) {
  if (!data || typeof data !== 'object') return false;
  return Array.isArray(data.data || data.books || data.recommendations);
}
function validateSimilarPayload(data) {
  if (!data || typeof data !== 'object') return false;
  return Array.isArray(data.data || data.similar || data.books);
}
function bookDetailChecks(name) {
  return { [`${name}: contains likely book metadata`]: (r) => /book|title|author|description/i.test(r.body) };
}
function loginChecks() {
  return {
    'page_login: has password input': (r) => /type=["']password["']/i.test(r.body),
    'page_login: has email input': (r) =>
      /type=["']email["']/i.test(r.body) || /name=["']email["']/i.test(r.body),
  };
}
function registerChecks() {
  return { 'page_register: has password input': (r) => /type=["']password["']/i.test(r.body) };
}

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
const mainScenario =
  CONFIG.executor === 'arrival'
    ? {
        executor: 'ramping-arrival-rate',
        startRate: Math.max(1, Math.round(CONFIG.arrivalSustained * 0.4)),
        timeUnit: '1s',
        // Enough VUs to sustain the rate even when latency rises; k6 warns if short.
        preAllocatedVUs: Math.max(CONFIG.rampPeak, 50),
        maxVUs: CONFIG.arrivalMaxVus,
        stages: ARRIVAL_STAGES,
        gracefulStop: '30s',
        exec: 'arrivalIteration',
      }
    : {
        executor: 'ramping-vus',
        startVUs: 0,
        gracefulRampDown: '30s',
        gracefulStop: '30s',
        stages: VUS_STAGES,
        // default exec = the full user journey (default export)
      };

export const options = {
  tags: { test: 'mangu-load', environment: CONFIG.environment, executor: CONFIG.executor },

  scenarios: {
    main: mainScenario,
    canary: {
      executor: 'constant-vus',
      vus: 2,
      duration: CANARY_DURATION, // derived from STAGE_DURATIONS so it always brackets the run
      gracefulStop: '10s',
      exec: 'canaryJourney',
    },
  },

  thresholds: {
    // Transport failures (DNS/TCP/TLS/5xx). 2% tolerance is the single source
    // of truth for "how much failure is acceptable" — see the 5xx note below.
    http_req_failed: ['rate<0.02'],
    business_errors: ['rate<0.02'],

    // 5xx-specific gate, expressed as a RATE so it scales with traffic instead
    // of failing the whole spike test on one transient error at peak.
    unexpected_5xx_rate: ['rate<0.01'],

    // Blended latency (all surfaces)
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],

    // Per-surface aggregates — SSR is allowed to be heavier than JSON APIs.
    page_latency: ['p(95)<2500', 'p(99)<4500'],
    api_latency: ['p(95)<1000', 'p(99)<2000'],

    // Per-endpoint guardrails. NOTE: these are scoped to a single route, so a
    // looser number here than the page_latency aggregate (2500) is intentional
    // — e.g. the homepage is the heaviest SSR page and gets its own 3000ms
    // budget without dragging the aggregate up. Not a typo.
    'http_req_duration{name:api_live}': ['p(95)<300'],
    'http_req_duration{name:api_health}': ['p(95)<800'],
    'http_req_duration{name:page_home}': ['p(95)<3000'],
    'http_req_duration{name:page_book_detail}': ['p(95)<3000'],
    'http_req_duration{name:api_resonance_similar}': ['p(95)<1500'],
    'http_req_duration{name:api_session_auth}': ['p(95)<1000'],

    critical_endpoint_failures: ['rate<0.01'],
    checks: ['rate>0.95'],
    // Canary health probes must NEVER fail.
    'checks{group:::Canary}': ['rate==1.00'],
  },

  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

// ---------------------------------------------------------------------------
// setup() — runs once. Fail fast on a dead target; validate the auth token.
// ---------------------------------------------------------------------------
export function setup() {
  console.log(`[setup] Target: ${CONFIG.baseUrl} (environment: ${CONFIG.environment}, executor: ${CONFIG.executor})`);
  if (CONFIG.executor === 'arrival') {
    console.log(`[setup] Arrival profile: sustained=${CONFIG.arrivalSustained} rps, peak=${CONFIG.arrivalPeak} rps, maxVUs=${CONFIG.arrivalMaxVus}`);
  } else {
    console.log(`[setup] VU profile: sustained=${CONFIG.sustainedVus} VUs, peak=${CONFIG.rampPeak} VUs`);
  }
  console.log(`[setup] Run length: ~${Math.round(MAIN_TOTAL_SECONDS / 60)}m (canary ${CANARY_DURATION})`);

  if (!CONFIG.skipPreflight) {
    let reachable = false;
    for (const path of ['/api/live', '/']) {
      const response = http.get(`${CONFIG.baseUrl}${path}`, {
        headers: COMMON_HEADERS,
        timeout: '10s',
        tags: { name: 'preflight', type: 'api' },
      });
      if (response.status > 0 && response.status < 500) {
        reachable = true;
        console.log(`[setup] Preflight OK via ${path} (status ${response.status})`);
        break;
      }
      console.warn(`[setup] Preflight ${path} → status ${response.status}${response.error ? ` (${response.error})` : ''}`);
    }
    if (!reachable) {
      exec.test.abort(
        `Preflight failed: ${CONFIG.baseUrl} is unreachable. ` +
          `Tried: /api/live, /. All returned 5xx or connection errors. ` +
          `Remedies: (1) verify the server is running and BASE_URL is correct; ` +
          `(2) set SKIP_PREFLIGHT=1 to bypass this check.`
      );
    }
  }

  let authValid = false;
  if (CONFIG.authToken) {
    const response = http.get(`${CONFIG.baseUrl}/api/session`, {
      headers: authHeaders(CONFIG.authToken),
      timeout: '10s',
      tags: { name: 'preflight_auth', type: 'api' },
    });
    authValid = response.status === 200 && validateSessionUserPayload(safeJson(response));
    if (authValid) console.log('[setup] AUTH_TOKEN validated — authenticated flow ENABLED.');
    else console.warn(`[setup] AUTH_TOKEN did not resolve to a user (status ${response.status}). Authenticated flow SKIPPED.`);
  }

  return { authValid, startedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Canary — low-rate health loop that must stay green through the spike.
// ---------------------------------------------------------------------------
export function canaryJourney() {
  group('Canary', function () {
    getApi('canary_live', '/api/live', { validate: validateLivePayload, acceptableStatuses: [200] });
    sleep(2);
    getApi('canary_health', '/api/health', { validate: validateHealthPayload, acceptableStatuses: [200, 503] });
    sleep(2);
    getPage('canary_home', '/');
    sleep(5);
  });
}

// ---------------------------------------------------------------------------
// Modular flows (vus mode / full journey)
// ---------------------------------------------------------------------------
function runPublicPagesFlow(samples) {
  group('Public pages', function () {
    getPage('page_home', '/', { critical: true });
    sleepBetween(CONFIG.think.pageMin, CONFIG.think.pageMax);
    getPage('page_books_catalog', '/books');
    sleepBetween(1, 2);
    getPage('page_discover', '/discover');
    sleepBetween(1, 2);
    getPage('page_genres', '/genres');
    sleepBetween(1, 2);
    getPage('page_about', '/about');
    sleepBetween(1, 2);
    getPage('page_readers_hub', '/readers-hub');
    sleepBetween(1, 2);
    getPage('page_contact', '/contact');
    sleepBetween(1, 2);

    if (samples.bookSlug) {
      getPage('page_book_detail', `/books/${samples.bookSlug}`, { extraChecks: bookDetailChecks('page_book_detail') });
      sleepBetween(1, 2);
    }
    if (samples.authorId) {
      getPage('page_author_detail', `/authors/${samples.authorId}`);
      sleepBetween(1, 2);
    }
  });
}

function runAuthPagesFlow() {
  group('Auth pages', function () {
    getPage('page_login', '/login', { extraChecks: loginChecks(), critical: true });
    sleepBetween(1, 2);
    getPage('page_register', '/register', { extraChecks: registerChecks() });
    sleepBetween(1, 2);
    getPage('page_reset_password', '/reset-password');
    sleepBetween(1, 2);
    getPage('page_verify_email', '/verify-email');
    sleepBetween(1, 2);
  });
}

function runApiRoutesFlow(samples) {
  group('API routes', function () {
    getApi('api_live', '/api/live', { validate: validateLivePayload, acceptableStatuses: [200] });
    sleepBetween(CONFIG.think.apiMin, CONFIG.think.apiMax);
    getApi('api_health', '/api/health', { validate: validateHealthPayload, acceptableStatuses: [200, 503] });
    sleepBetween(CONFIG.think.apiMin, CONFIG.think.apiMax);
    getApi('api_session', '/api/session', { validate: validateSessionPayload, acceptableStatuses: [200, 401], critical: true });
    sleepBetween(CONFIG.think.apiMin, CONFIG.think.apiMax);
    getApi('api_resonance_recommend', '/api/resonance/recommend', {
      validate: validateRecommendationPayload, acceptableStatuses: [200, 400, 401], critical: true,
    });
    sleepBetween(CONFIG.think.apiMin, CONFIG.think.apiMax);

    if (samples.bookId) {
      // When a real book sample is provided, 404 means a bad slug or broken route — treat as failure.
      getApi('api_resonance_similar', `/api/resonance/similar?book_id=${samples.bookId}&limit=6`, {
        validate: validateSimilarPayload, acceptableStatuses: [200],
      });
      sleepBetween(CONFIG.think.apiMin, CONFIG.think.apiMax);
    }

    getApi('api_analytics', '/api/analytics', { validate: () => true, acceptableStatuses: [200, 204, 405] });
    sleepBetween(CONFIG.think.apiMin, CONFIG.think.apiMax);
  });
}

function runAuthenticatedFlow(data) {
  if (!CONFIG.authToken || !data || !data.authValid) return;
  const token = CONFIG.authToken;

  group('Authenticated', function () {
    getAuthedApi('api_session_auth', '/api/session', token, {
      validate: validateSessionUserPayload, acceptableStatuses: [200], critical: true,
    });
    sleepBetween(CONFIG.think.apiMin, CONFIG.think.apiMax);

    getAuthedPage('page_dashboard_auth', '/dashboard', token, {
      extraChecks: { 'page_dashboard_auth: is HTML': (r) => isHtmlResponse(r) },
    });
    sleepBetween(1, 2);

    getAuthedPage('page_library_auth', '/library', token);
    sleepBetween(1, 2);

    postAuthedApi('api_analytics_track_auth', '/api/analytics',
      { event: 'page_view', page: '/dashboard', timestamp: new Date().toISOString() },
      token, { validate: () => true, acceptableStatuses: [200, 201, 204] });
    sleepBetween(CONFIG.think.apiMin, CONFIG.think.apiMax);

    // --- File upload (small payload) — uncomment + provide a real fixture ---
    // Keep payloads tiny (< 50 KB) under load to avoid saturating bandwidth.
    /*
    const fileData = open('./fixtures/sample-cover.jpg', 'b');
    const file = http.file(fileData, 'sample-cover.jpg', 'image/jpeg');
    const uploadRes = http.post(`${CONFIG.baseUrl}/api/upload`, { file }, {
      headers: { Authorization: `Bearer ${token}` },
      tags: { name: 'api_upload_auth', type: 'api', auth: 'true', expected: 'strict' },
      timeout: CONFIG.requestTimeout,
    });
    recordRequest(uploadRes, { type: 'api', auth: true });
    check(uploadRes, { 'api_upload_auth: 200/201': (r) => [200, 201].includes(r.status) });
    sleepBetween(CONFIG.think.apiMin, CONFIG.think.apiMax);
    */
  });
}

function runBrowseToDetailFlow(samples) {
  group('Browse-to-detail flow', function () {
    getPage('flow_books_catalog', '/books');
    sleepBetween(1, 2);
    if (samples.bookSlug) {
      getPage('flow_book_detail', `/books/${samples.bookSlug}`);
      sleepBetween(1, 2);
      if (samples.bookId) {
        // Sample provided: 404 here is a real failure (bad slug or broken route).
        getApi('flow_api_similar', `/api/resonance/similar?book_id=${samples.bookId}&limit=6`, {
          validate: validateSimilarPayload, acceptableStatuses: [200],
        });
        sleepBetween(CONFIG.think.apiMin, CONFIG.think.apiMax);
      }
      getApi('flow_api_recommend', '/api/resonance/recommend', { validate: () => true, acceptableStatuses: [200, 400, 401] });
      sleepBetween(CONFIG.think.apiMin, CONFIG.think.apiMax);
    }
  });
}

function pickIterationSamples() {
  return {
    bookSlug: pickRandom(CONFIG.samples.bookSlugs),
    bookId: pickRandom(CONFIG.samples.bookIds),
    authorId: pickRandom(CONFIG.samples.authorIds),
  };
}

// ---------------------------------------------------------------------------
// default export — full user journey (vus mode)
// ---------------------------------------------------------------------------
export default function (data) {
  const samples = pickIterationSamples();
  runPublicPagesFlow(samples);
  runAuthPagesFlow();
  runApiRoutesFlow(samples);
  runAuthenticatedFlow(data);
  runBrowseToDetailFlow(samples);
  sleepBetween(CONFIG.think.loopMin, CONFIG.think.loopMax);
}

// ---------------------------------------------------------------------------
// arrivalIteration — ONE weighted random request per arrival (arrival mode).
// No journey, no think-time: the configured rate IS the request rate.
// Weights roughly mirror real traffic: catalog/home heavy, APIs lighter.
// ---------------------------------------------------------------------------
const ARRIVAL_ENDPOINTS = [
  { weight: 24, fire: () => getPage('page_home', '/', { critical: true }) },
  { weight: 18, fire: () => getPage('page_books_catalog', '/books') },
  { weight: 10, fire: () => getPage('page_discover', '/discover') },
  { weight: 8, fire: () => getPage('page_genres', '/genres') },
  { weight: 10, fire: () => getApi('api_live', '/api/live', { validate: validateLivePayload }) },
  { weight: 8, fire: () => getApi('api_health', '/api/health', { validate: validateHealthPayload, acceptableStatuses: [200, 503] }) },
  {
    weight: 14,
    fire: () =>
      getApi('api_resonance_recommend', '/api/resonance/recommend', {
        validate: validateRecommendationPayload, acceptableStatuses: [200, 400, 401], critical: true,
      }),
  },
];
const ARRIVAL_TOTAL_WEIGHT = ARRIVAL_ENDPOINTS.reduce((s, e) => s + e.weight, 0);

function pickWeightedEndpoint() {
  let r = Math.random() * ARRIVAL_TOTAL_WEIGHT;
  for (const endpoint of ARRIVAL_ENDPOINTS) {
    r -= endpoint.weight;
    if (r <= 0) return endpoint;
  }
  return ARRIVAL_ENDPOINTS[ARRIVAL_ENDPOINTS.length - 1];
}

export function arrivalIteration() {
  const samples = pickIterationSamples();
  // Exercise dynamic book detail / similar endpoints when samples exist.
  // Probabilities are configurable via DETAIL_PROBABILITY / SIMILAR_PROBABILITY.
  // When a real sample is provided, 404 is treated as failure (bad slug or broken route).
  if (samples.bookSlug && Math.random() < CONFIG.detailProbability) {
    getPage('page_book_detail', `/books/${samples.bookSlug}`, {
      extraChecks: bookDetailChecks('page_book_detail'),
      acceptableStatuses: [200],
    });
    return;
  }
  if (samples.bookId && Math.random() < CONFIG.similarProbability) {
    getApi('api_resonance_similar', `/api/resonance/similar?book_id=${samples.bookId}&limit=6`, {
      validate: validateSimilarPayload, acceptableStatuses: [200],
    });
    return;
  }
  pickWeightedEndpoint().fire();
}

// ---------------------------------------------------------------------------
// Summaries — compact console view + machine-readable summary.json
// ---------------------------------------------------------------------------
function renderSummary(data) {
  const m = data.metrics;
  const pad = (label) => label.padEnd(30);
  const ms = (v) => (v == null ? 'n/a' : `${v.toFixed(1)}ms`);
  const pct = (v) => (v == null ? 'n/a' : `${(v * 100).toFixed(2)}%`);
  const num = (v) => (v == null ? 'n/a' : String(v));

  const title = `Mangu Publishers — Load Test Summary (${CONFIG.environment} · ${CONFIG.executor})`;
  const inner = title.length + 6;
  const line = (ch) => ch.repeat(inner);
  const centered = (() => {
    const space = inner - title.length;
    const left = Math.floor(space / 2);
    return ' '.repeat(left) + title + ' '.repeat(space - left);
  })();
  const rule = (label) => {
    const text = `── ${label} `;
    return text + '─'.repeat(Math.max(0, inner - text.length));
  };

  const thresholdLines = Object.entries(data.thresholds || {}).map(([name, result]) => {
    const status = result.ok ? '✓ PASS' : '✗ FAIL';
    return `  [${status}] ${name}`;
  });

  return [
    '',
    `╔${line('═')}╗`,
    `║${centered}║`,
    `╚${line('═')}╝`,
    pad('Checks pass rate:') + pct(m.checks?.values?.rate),
    pad('HTTP failures:') + pct(m.http_req_failed?.values?.rate),
    pad('Business errors:') + pct(m.business_errors?.values?.rate),
    pad('Unexpected 5xx rate:') + pct(m.unexpected_5xx_rate?.values?.rate),
    pad('Critical endpoint failures:') + pct(m.critical_endpoint_failures?.values?.rate),
    pad('Total requests:') + num(m.http_reqs?.values?.count),
    pad('  page / api:') + `${num(m.page_requests_total?.values?.count)} / ${num(m.api_requests_total?.values?.count)}`,
    pad('  auth / anon:') + `${num(m.auth_requests_total?.values?.count)} / ${num(m.anon_requests_total?.values?.count)}`,
    pad('Unexpected 4xx / 5xx:') + `${num(m.unexpected_4xx?.values?.count)} / ${num(m.unexpected_5xx?.values?.count)}`,
    pad('429s (rate limited):') + num(m.rate_limited_429?.values?.count),
    pad('Peak VUs:') + num(m.vus_max?.values?.max),
    '',
    rule('Duration breakdown'),
    pad('Overall p95 / p99:') + `${ms(m.http_req_duration?.values?.['p(95)'])} / ${ms(m.http_req_duration?.values?.['p(99)'])}`,
    pad('SSR pages p95 / p99:') + `${ms(m.page_latency?.values?.['p(95)'])} / ${ms(m.page_latency?.values?.['p(99)'])}`,
    pad('API routes p95 / p99:') + `${ms(m.api_latency?.values?.['p(95)'])} / ${ms(m.api_latency?.values?.['p(99)'])}`,
    '',
    rule('Threshold results'),
    ...thresholdLines,
    '',
  ].join('\n');
}

export function handleSummary(data) {
  const summary = {
    metadata: {
      test: 'Mangu Publishers Load Test',
      baseUrl: CONFIG.baseUrl,
      environment: CONFIG.environment,
      executor: CONFIG.executor,
      timestamp: new Date().toISOString(),
      peakVUs: CONFIG.rampPeak,
      sustainedVUs: CONFIG.sustainedVus,
      arrivalPeak: CONFIG.arrivalPeak,
      arrivalSustained: CONFIG.arrivalSustained,
      requestTimeout: CONFIG.requestTimeout,
      authConfigured: !!CONFIG.authToken,
      sampleBookSlugs: CONFIG.samples.bookSlugs.length,
      sampleBookIds: CONFIG.samples.bookIds.length,
      sampleAuthorIds: CONFIG.samples.authorIds.length,
      detailProbability: CONFIG.detailProbability,
      similarProbability: CONFIG.similarProbability,
      canaryDuration: CANARY_DURATION,
      stages: CONFIG.executor === 'arrival' ? ARRIVAL_STAGES : VUS_STAGES,
    },
    thresholds: data.thresholds,
    metrics: {
      requests_total: data.metrics.requests_total?.values?.count ?? 0,
      page_requests_total: data.metrics.page_requests_total?.values?.count ?? 0,
      api_requests_total: data.metrics.api_requests_total?.values?.count ?? 0,
      auth_requests_total: data.metrics.auth_requests_total?.values?.count ?? 0,
      anon_requests_total: data.metrics.anon_requests_total?.values?.count ?? 0,
      http_reqs: data.metrics.http_reqs?.values?.count ?? 0,
      http_req_failed_rate: data.metrics.http_req_failed?.values?.rate ?? null,
      business_errors_rate: data.metrics.business_errors?.values?.rate ?? null,
      unexpected_5xx_rate: data.metrics.unexpected_5xx_rate?.values?.rate ?? null,
      critical_endpoint_failures_rate: data.metrics.critical_endpoint_failures?.values?.rate ?? null,
      checks_pass_rate: data.metrics.checks?.values?.rate ?? null,
      http_p95: data.metrics.http_req_duration?.values?.['p(95)'] ?? null,
      http_p99: data.metrics.http_req_duration?.values?.['p(99)'] ?? null,
      page_p95: data.metrics.page_latency?.values?.['p(95)'] ?? null,
      page_p99: data.metrics.page_latency?.values?.['p(99)'] ?? null,
      api_p95: data.metrics.api_latency?.values?.['p(95)'] ?? null,
      api_p99: data.metrics.api_latency?.values?.['p(99)'] ?? null,
      vus_max: data.metrics.vus_max?.values?.max ?? null,
      unexpected_4xx: data.metrics.unexpected_4xx?.values?.count ?? 0,
      unexpected_5xx: data.metrics.unexpected_5xx?.values?.count ?? 0,
      rate_limited_429: data.metrics.rate_limited_429?.values?.count ?? 0,
      status_2xx: data.metrics.http_status_2xx?.values?.count ?? 0,
      status_3xx: data.metrics.http_status_3xx?.values?.count ?? 0,
      status_4xx: data.metrics.http_status_4xx?.values?.count ?? 0,
      status_5xx: data.metrics.http_status_5xx?.values?.count ?? 0,
      data_received: data.metrics.data_received?.values?.count ?? null,
      data_sent: data.metrics.data_sent?.values?.count ?? null,
    },
    root_group: data.root_group,
  };

  return {
    stdout: renderSummary(data),
    'summary.json': JSON.stringify(summary, null, 2),
  };
}
