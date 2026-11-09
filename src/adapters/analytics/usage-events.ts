import type { LogEntry, LogValue } from '../diagnostics/log';

export type EventParams = Readonly<Record<string, string | number | boolean>>;

export interface UsageEvent {
  name: string;
  params: EventParams;
}

/**
 * Log entries sent as usage statistics, by their log event name: the event they are sent
 * as, and the details that go along. Everything else stays in the browser. A detail is sent
 * only when it is a short code word or a number, so note text can never ride along.
 */
const USAGE: Readonly<Record<string, { name: string; params?: readonly string[] }>> = {
  'files.new-board': { name: 'board_created' },
  'files.opened': { name: 'file_opened' },
  'files.downloaded': { name: 'file_downloaded' },
  'files.exported': { name: 'image_exported', params: ['format'] },
};

const CODE_WORD = /^[\w.-]{1,40}$/;

function sendable(value: LogValue): value is string | number | boolean {
  if (typeof value === 'string') return CODE_WORD.test(value);
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'boolean';
}

/**
 * The usage event a log entry is sent as, or null for one that is not sent. Errors are sent
 * by their event name only (`app_error` with `error_event: 'store.save-failed'`), never
 * with their message, which may quote what the user typed.
 */
export function usageEvent(entry: LogEntry): UsageEvent | null {
  if (entry.level === 'error') return { name: 'app_error', params: { error_event: entry.event } };
  const usage = Object.hasOwn(USAGE, entry.event) ? USAGE[entry.event] : undefined;
  if (!usage) return null;
  const params: Record<string, string | number | boolean> = {};
  for (const key of usage.params ?? []) {
    const value = entry.details[key];
    if (sendable(value)) params[key] = value;
  }
  return { name: usage.name, params };
}
