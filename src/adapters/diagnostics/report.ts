import type { Board } from '../../domain/model';
import { browserLanguages } from '../browser/languages';
import { storageUsage } from '../storage/web-storage';
import { APP_VERSION } from './build-info';
import { recentLog, type LogEntry, type LogValue } from './log';

export interface ReportContext {
  /** The interface language in use. */
  locale: string;
  board: Board;
}

const count = (items: object | undefined) => Object.keys(items ?? {}).length;

/** `key=value`, quoting values a reader could misparse. */
const field = (key: string, value: LogValue) =>
  typeof value === 'string' && /[\s"=]/.test(value)
    ? `${key}=${JSON.stringify(value)}`
    : `${key}=${value}`;

function line({ time, level, event, details }: LogEntry): string {
  const present = Object.entries(details).filter(([, value]) => value !== undefined);
  // Multi-line values (stacks) read best indented under their entry.
  const inline = present.filter(([, value]) => !String(value).includes('\n'));
  const blocks = present.filter(([, value]) => String(value).includes('\n'));
  return [
    [time, level.toUpperCase(), event, ...inline.map(([key, value]) => field(key, value))].join(
      ' ',
    ),
    ...blocks.map(([key, value]) => `  ${key}:\n${String(value).replace(/^/gm, '    ')}`),
  ].join('\n');
}

/**
 * A plain-text summary for bug reports: the version, browser, board size and recent log.
 * It counts the board's contents but never includes their text.
 */
export function diagnosticsReport(
  { locale, board }: ReportContext,
  entries: readonly LogEntry[] = recentLog(),
): string {
  return [
    `Stormlet ${APP_VERSION}`,
    `Time: ${new Date().toISOString()}`,
    `Browser: ${navigator.userAgent}`,
    `Languages: ${browserLanguages().join(', ')} (interface: ${locale})`,
    `Board: ${count(board.stickies)} notes, ${count(board.frames)} frames, ${count(board.connections)} connectors`,
    `Storage: ${
      Object.entries(storageUsage())
        .map(([key, size]) => `${key}=${size}`)
        .join(', ') || '(empty or unavailable)'
    }`,
    '',
    `Recent log (${entries.length}):`,
    ...(entries.length ? entries.map(line) : ['(empty)']),
  ].join('\n');
}
