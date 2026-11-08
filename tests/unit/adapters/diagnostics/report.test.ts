// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { logUncaughtErrors } from '../../../../src/adapters/diagnostics/global-errors';
import { clearLog, log, recentLog } from '../../../../src/adapters/diagnostics/log';
import { diagnosticsReport } from '../../../../src/adapters/diagnostics/report';
import { APP_VERSION } from '../../../../src/adapters/diagnostics/build-info';
import { boardOf, sticky } from '../../../support/boards';
import { frame } from '../../../support/frames';
import packageJson from '../../../../package.json';

afterEach(() => {
  clearLog();
  localStorage.clear();
});

describe('diagnostics report', () => {
  it('names the version, browser, board size, storage use and recent log, but no note text', () => {
    localStorage.setItem('stormlet.board', 'x'.repeat(42));
    localStorage.setItem('other.app', 'ignored');
    log.warn('storage.write-failed', { key: 'stormlet.board', name: 'QuotaExceededError' });
    log.error('render.crashed', { message: 'Cannot read "x"', stack: 'Error\n  at f\n  at g' });
    const board = {
      ...boardOf(sticky('a', { text: 'secret plan' }), sticky('b')),
      frames: { f: frame() },
    };
    const report = diagnosticsReport({ locale: 'ko', board });
    const [time] = recentLog().map((entry) => entry.time);
    expect(APP_VERSION).toBe(packageJson.version);
    expect(report).toContain(`Stormlet ${packageJson.version}\n`);
    expect(report).toContain(`Browser: ${navigator.userAgent}`);
    expect(report).toContain('Languages: ko-KR (interface: ko)');
    expect(report).toContain('Board: 2 notes, 1 frames, 0 connectors');
    expect(report).toContain('Storage: stormlet.board=42\n');
    expect(report).toContain(
      `Recent log (2):\n${time} WARN storage.write-failed key=stormlet.board name=QuotaExceededError\n`,
    );
    expect(report).toMatch(
      / ERROR render\.crashed message="Cannot read \\"x\\""\n {2}stack:\n {4}Error\n {4} {2}at f\n {4} {2}at g$/,
    );
    expect(report).not.toContain('secret plan');
  });

  it('says so when the log and storage are empty', () => {
    const report = diagnosticsReport({ locale: 'en', board: { stickies: {} } }, []);
    expect(report).toContain('Storage: (empty or unavailable)');
    expect(report).toMatch(/Recent log \(0\):\n\(empty\)$/);
  });
});

describe('uncaught errors', () => {
  it('records thrown errors and unhandled rejections until stopped', () => {
    const stop = logUncaughtErrors();
    window.dispatchEvent(
      new ErrorEvent('error', {
        error: new RangeError('too far'),
        message: 'too far',
        filename: 'app.js',
        lineno: 12,
      }),
    );
    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }));
    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'nope' }));
    stop();
    window.dispatchEvent(new ErrorEvent('error', { message: 'after' }));
    expect(recentLog().map(({ event, details }) => ({ event, details }))).toEqual([
      {
        event: 'uncaught.error',
        details: {
          name: 'RangeError',
          message: 'too far',
          stack: expect.stringContaining('too far'),
          source: 'app.js',
          line: 12,
        },
      },
      {
        event: 'uncaught.error',
        details: { message: 'Script error.', source: undefined, line: undefined },
      },
      { event: 'uncaught.rejection', details: { message: 'nope' } },
    ]);
  });
});
