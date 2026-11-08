import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearLog,
  echoLogToConsole,
  errorDetails,
  log,
  LOG_CAPACITY,
  MAX_VALUE_LENGTH,
  recentLog,
} from '../../../../src/adapters/diagnostics/log';

afterEach(() => {
  clearLog();
  echoLogToConsole(false);
  vi.restoreAllMocks();
});

describe('diagnostic log', () => {
  it('records entries with their level, time and details, oldest first', () => {
    log.info('app.started', { version: '1.0.0' });
    log.warn('storage.write-failed', { key: 'k', length: 3 });
    log.error('render.crashed');
    log.debug('view.changed', { zoom: 1 });
    expect(recentLog()).toEqual([
      {
        time: expect.any(String),
        level: 'info',
        event: 'app.started',
        details: { version: '1.0.0' },
      },
      {
        time: expect.any(String),
        level: 'warn',
        event: 'storage.write-failed',
        details: { key: 'k', length: 3 },
      },
      { time: expect.any(String), level: 'error', event: 'render.crashed', details: {} },
      // Development builds, tests included, keep debug entries.
      { time: expect.any(String), level: 'debug', event: 'view.changed', details: { zoom: 1 } },
    ]);
    expect(new Date(recentLog()[0].time).toISOString()).toBe(recentLog()[0].time);
  });

  it('keeps only the most recent entries and clips long values', () => {
    for (let index = 0; index < LOG_CAPACITY + 5; index++) log.info('tick', { index });
    expect(recentLog()).toHaveLength(LOG_CAPACITY);
    expect(recentLog()[0].details.index).toBe(5);
    log.warn('long', { message: 'x'.repeat(MAX_VALUE_LENGTH + 10), short: 'ok' });
    const { message, short } = recentLog().at(-1)!.details;
    expect(message).toBe(`${'x'.repeat(MAX_VALUE_LENGTH)}…`);
    expect(short).toBe('ok');
  });

  it('hands out copies, so callers cannot rewrite the log', () => {
    log.info('a');
    (recentLog() as unknown[]).length = 0;
    expect(recentLog()).toHaveLength(1);
    clearLog();
    expect(recentLog()).toEqual([]);
  });

  it('echoes entries to the matching console method when enabled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    log.warn('quiet');
    expect(warn).not.toHaveBeenCalled();
    echoLogToConsole(true);
    log.warn('loud', { key: 'k' });
    expect(warn).toHaveBeenCalledExactlyOnceWith('[stormlet] loud', { key: 'k' });
  });

  it('describes errors by name and message, with the top of the stack when wanted', () => {
    const error = new TypeError('broken');
    error.stack = ['TypeError: broken', ...Array.from({ length: 20 }, (_, i) => `  at f${i}`)].join(
      '\n',
    );
    const details = errorDetails(error);
    expect(details).toMatchObject({ name: 'TypeError', message: 'broken' });
    expect(String(details.stack).split('\n')).toEqual([
      'TypeError: broken',
      ...Array.from({ length: 8 }, (_, i) => `  at f${i}`),
    ]);
    expect(errorDetails(error, false)).toEqual({ name: 'TypeError', message: 'broken' });
    expect(errorDetails({ name: 'QuotaExceededError', message: 'Full' })).toEqual({
      name: 'QuotaExceededError',
      message: 'Full',
    });
    expect(errorDetails({ message: 'bare' }, false)).toEqual({ name: 'Error', message: 'bare' });
    expect(errorDetails('plain')).toEqual({ message: 'plain' });
    expect(errorDetails(undefined)).toEqual({ message: 'undefined' });
  });
});
