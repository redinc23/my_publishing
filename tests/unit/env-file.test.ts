import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readEnvFile, upsertEnvVars } from '../../scripts/lib/env-file';

describe('scripts/lib/env-file', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mangu-env-'));
    path = join(dir, '.env.local');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('upserts new keys and preserves comments', () => {
    writeFileSync(path, '# hi\nFOO=1\n');
    upsertEnvVars(path, { FOO: '2', BAR: 'x' });
    const text = readFileSync(path, 'utf8');
    expect(text).toContain('# hi');
    expect(text).toContain('FOO=2');
    expect(text).toContain('BAR=x');
    expect(readEnvFile(path).get('FOO')).toBe('2');
  });
});
