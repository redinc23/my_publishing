/** @jest-environment node */

import { logger } from '@/lib/logger';

describe('lib/logger', () => {
  const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

  afterEach(() => {
    infoSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
  });

  afterAll(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('emits JSON with level, route, requestId, message', () => {
    logger.info('hello', { route: '/api/health', requestId: 'req-1', foo: 1 });
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(infoSpy.mock.calls[0][0]));
    expect(payload).toMatchObject({
      level: 'info',
      route: '/api/health',
      requestId: 'req-1',
      message: 'hello',
      foo: 1,
    });
    expect(payload.ts).toEqual(expect.any(String));
  });

  it('redacts sensitive keys', () => {
    logger.warn('auth', { password: 'secret', token: 'abc', ok: true });
    const payload = JSON.parse(String(warnSpy.mock.calls[0][0]));
    expect(payload.password).toBe('[redacted]');
    expect(payload.token).toBe('[redacted]');
    expect(payload.ok).toBe(true);
  });

  it('exception includes stack when Error is passed', () => {
    logger.exception('boom', new Error('nope'), { route: '/api/x' });
    const payload = JSON.parse(String(errorSpy.mock.calls[0][0]));
    expect(payload.level).toBe('error');
    expect(payload.message).toBe('boom');
    expect(payload.errMessage).toBe('nope');
    expect(payload.stack).toEqual(expect.stringContaining('Error: nope'));
  });
});
