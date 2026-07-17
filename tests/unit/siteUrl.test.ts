import { getSiteUrl } from '@/lib/seo/siteUrl';

const ORIGINAL_ENV = process.env;

describe('getSiteUrl', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('uses NEXT_PUBLIC_SITE_URL first and removes trailing slashes', () => {
    process.env.NEXT_PUBLIC_SITE_URL = ' https://example.com/// ';
    process.env.VERCEL_URL = 'preview.vercel.app';

    expect(getSiteUrl()).toBe('https://example.com');
  });

  it('uses VERCEL_URL with https when no public site URL is configured', () => {
    process.env.VERCEL_URL = 'http://preview.vercel.app///';

    expect(getSiteUrl()).toBe('https://preview.vercel.app');
  });

  it('falls back to localhost', () => {
    expect(getSiteUrl()).toBe('http://localhost:3000');
  });
});
