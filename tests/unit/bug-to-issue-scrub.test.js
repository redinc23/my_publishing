// Unit tests for the secret-scrubbing and signature helpers used by the
// bug-to-issue workflow script (.github/scripts/bug-to-issue.js).
// All credential values below are fabricated fixtures, not real secrets.

const { scrubSecrets, normalizeSignature } = require('../../.github/scripts/bug-to-issue');

describe('scrubSecrets redacts secret material', () => {
  it('redacts JWTs', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c';
    expect(scrubSecrets(`auth failed for ${jwt}`)).toBe('auth failed for [REDACTED]');
  });

  // Fixtures are assembled at runtime so secret scanning (push protection)
  // does not mistake them for real credentials in the repo.
  it('redacts GitHub classic tokens', () => {
    const tok = 'ghp_' + '16C7e42F292c6912E7710c838347Ae178B4a';
    expect(scrubSecrets(`token ${tok} leaked`)).toBe('token [REDACTED] leaked');
  });

  it('redacts GitHub fine-grained PATs', () => {
    const pat = 'github' + '_pat_' + '11AA22BB33CC44DD55EE77FF';
    expect(scrubSecrets(`pat ${pat} leaked`)).toBe('pat [REDACTED] leaked');
  });

  it('redacts GitLab PATs', () => {
    const pat = 'glpat-' + 'zKv9mP2wQx7yTr4nB8sL';
    expect(scrubSecrets(`token ${pat} leaked`)).toBe('token [REDACTED] leaked');
  });

  it('redacts Stripe secret keys', () => {
    const key = 'sk_' + 'live_' + '4eC39HqLyjWDarjtT1zdp7dc';
    expect(scrubSecrets(`key ${key} leaked`)).toBe('key [REDACTED] leaked');
  });

  it('redacts Stripe restricted keys', () => {
    const key = 'rk_' + 'test_' + '51MexampleRestrictedKey0001';
    expect(scrubSecrets(`key ${key} leaked`)).toBe('key [REDACTED] leaked');
  });

  it('redacts webhook signing secrets', () => {
    const sig = 'whsec_' + 'MfKQ9r8GKYqyTwN3SEsZ3M2N';
    expect(scrubSecrets(`sig ${sig} leaked`)).toBe('sig [REDACTED] leaked');
  });

  it('redacts Supabase secret keys', () => {
    const key = 'sb_' + 'secret_' + 'Nx7kP2mQ9vLwR4tY8hJ3fB6n';
    expect(scrubSecrets(`key ${key} leaked`)).toBe('key [REDACTED] leaked');
  });

  it('redacts KEY=value credential assignments', () => {
    expect(scrubSecrets('env MY_API_KEY=abc123XYZ789 set')).toBe('env MY_API_KEY=[REDACTED] set');
  });

  it('redacts bare TOKEN= assignments with no name prefix', () => {
    expect(scrubSecrets('env TOKEN=Zx9Qw8Er7Ty6 set')).toBe('env TOKEN=[REDACTED] set');
  });

  it('redacts bare SECRET= assignments with no name prefix', () => {
    expect(scrubSecrets('env SECRET=hunter2hunter2 set')).toBe('env SECRET=[REDACTED] set');
  });

  it('redacts double-quoted values containing spaces', () => {
    expect(scrubSecrets('auth PASSWORD="my secret pass" failed')).toBe(
      'auth PASSWORD=[REDACTED] failed'
    );
  });

  it('redacts single-quoted values containing spaces', () => {
    expect(scrubSecrets("auth DB_PASSWD='p@ss w0rd!' failed")).toBe(
      'auth DB_PASSWD=[REDACTED] failed'
    );
  });

  it('redacts credential URIs but keeps scheme and host', () => {
    expect(
      scrubSecrets('connect DATABASE_URL=postgres://shop:p4ssw0rd@db.internal:5432/shopdb failed')
    ).toBe('connect DATABASE_URL=postgres://[REDACTED]@db.internal:5432/shopdb failed');
  });

  it('redacts Bearer authorization headers', () => {
    expect(scrubSecrets('Authorization: Bearer g9Kp2LmN7QrS4tVw rejected')).toBe(
      'Authorization: [REDACTED] rejected'
    );
  });

  it('redacts PEM private key blocks', () => {
    const pem = [
      '-----BEGIN PRIVATE KEY-----',
      'MIIEvwIBADANBgkqhkiG9w0BAQEFAASC',
      'abc123==',
      '-----END PRIVATE KEY-----',
    ].join('\n');
    expect(scrubSecrets(`key dump:\n${pem}\nend`)).toBe('key dump:\n[REDACTED]\nend');
  });

  it('redacts 64+ char hex blobs', () => {
    const hex = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    expect(scrubSecrets(`sha256 ${hex} computed`)).toBe('sha256 [REDACTED] computed');
  });
});

describe('scrubSecrets preserves non-secret text', () => {
  it('leaves normal log lines untouched', () => {
    const line = "Error: Test suite failed to run: Cannot find module '@/lib/db'";
    expect(scrubSecrets(line)).toBe(line);
  });

  it('leaves 40-char git SHAs untouched', () => {
    const line = 'commit da39a3ee5e6b4b0d3255bfef95601890afd80709 broke the build';
    expect(scrubSecrets(line)).toBe(line);
  });

  it('leaves runner-masked values untouched', () => {
    expect(scrubSecrets('env MY_TOKEN=*** set')).toBe('env MY_TOKEN=*** set');
  });

  it('leaves bare-name masked values untouched', () => {
    expect(scrubSecrets('env TOKEN=*** set')).toBe('env TOKEN=*** set');
  });

  it('does not over-redact prose about Bearer authentication', () => {
    const line = 'Use Bearer authentication when calling the API';
    expect(scrubSecrets(line)).toBe(line);
  });
});

describe('normalizeSignature on scrubbed lines', () => {
  const meta = { workflowName: 'CI', jobName: 'unit-tests', stepName: 'npm test' };

  it('stays stable when KEY=value secrets rotate', () => {
    const sig1 = normalizeSignature({
      ...meta,
      topLine: scrubSecrets('npm ERR! TOKEN=aaaa1111bbbb exploded'),
    });
    const sig2 = normalizeSignature({
      ...meta,
      topLine: scrubSecrets('npm ERR! TOKEN=cccc2222dddd exploded'),
    });
    expect(sig1).toBe(sig2);
  });

  it('stays stable when Bearer JWTs rotate', () => {
    const jwtA = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhYWFhIn0.signatureA1111';
    const jwtB = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJiYmJiIn0.signatureB2222';
    const sig1 = normalizeSignature({
      ...meta,
      topLine: scrubSecrets(`auth failed: Bearer ${jwtA}`),
    });
    const sig2 = normalizeSignature({
      ...meta,
      topLine: scrubSecrets(`auth failed: Bearer ${jwtB}`),
    });
    expect(sig1).toBe(sig2);
  });
});
