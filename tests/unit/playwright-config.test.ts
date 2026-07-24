/** @jest-environment node */

/**
 * P0-005: verify playwright.config.ts honors BASE_URL for preview E2E.
 */

jest.mock('@playwright/test', () => ({
  defineConfig: (c: unknown) => c,
  devices: new Proxy({}, { get: () => ({}) }),
}));

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.BASE_URL;
  delete process.env.CI;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

async function loadConfig() {
  // playwright.config.ts uses top-level `process.env` reads, so we must
  // re-import after setting env vars.
  const mod = await import('../../playwright.config');
  return mod.default;
}

describe('Playwright config BASE_URL semantics', () => {
  it('defaults baseURL to localhost:3000 and starts a local webServer', async () => {
    const config = await loadConfig();
    expect(config.use?.baseURL).toBe('http://localhost:3000');
    expect(config.webServer).toBeDefined();
  });

  it('uses BASE_URL when set and omits the local webServer', async () => {
    process.env.BASE_URL = 'https://preview-abc123.vercel.app';
    const config = await loadConfig();
    expect(config.use?.baseURL).toBe('https://preview-abc123.vercel.app');
    expect(config.webServer).toBeUndefined();
  });

  it('CI mode uses only chromium project', async () => {
    process.env.CI = 'true';
    const config = await loadConfig();
    const names = (config.projects ?? []).map((p) => p.name);
    expect(names).toEqual(['chromium']);
  });
});
