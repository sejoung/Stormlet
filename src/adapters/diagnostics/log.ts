/**
 * The app's diagnostic log (ADR 0009). Entries stay in memory, in a ring of the most recent
 * `LOG_CAPACITY`, and leave the browser only when the user copies them. They describe what
 * happened (event names, error messages, counts) and never carry note text.
 *
 * The log is a module-level singleton on purpose: it is the one piece of shared state every
 * layer that may log (adapters and app) reaches directly, so nothing has to thread it through.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogValue = string | number | boolean | null | undefined;
export type LogDetails = Readonly<Record<string, LogValue>>;

export interface LogEntry {
  time: string;
  level: LogLevel;
  event: string;
  details: LogDetails;
}

/** How many entries are kept; older ones are dropped first. */
export const LOG_CAPACITY = 200;
/** Longest kept string value, so one huge message cannot crowd out the rest. */
export const MAX_VALUE_LENGTH = 1000;
/** Stack frames kept from an error; the top of the stack is what locates a bug. */
const STACK_FRAMES = 8;

const entries: LogEntry[] = [];
const listeners = new Set<(entry: LogEntry) => void>();
// Tests check the log itself; echoing it would only bury their output.
let echo = import.meta.env.MODE !== 'test';

const clip = (value: LogValue): LogValue =>
  typeof value === 'string' && value.length > MAX_VALUE_LENGTH
    ? `${value.slice(0, MAX_VALUE_LENGTH)}…`
    : value;

function record(level: LogLevel, event: string, details: LogDetails = {}) {
  // Debug entries help while developing and would only crowd the log of a release build.
  if (level === 'debug' && !import.meta.env.DEV) return;
  const entry: LogEntry = {
    time: new Date().toISOString(),
    level,
    event,
    details: Object.fromEntries(Object.entries(details).map(([key, value]) => [key, clip(value)])),
  };
  entries.push(entry);
  if (entries.length > LOG_CAPACITY) entries.splice(0, entries.length - LOG_CAPACITY);
  if (echo) console[level](`[stormlet] ${event}`, entry.details);
  for (const listener of listeners)
    try {
      listener(entry);
    } catch {
      // A broken listener must not stop the log; logging its failure could loop.
    }
}

/** Event names are dotted and stable (`store.save-failed`), so reports can be searched. */
export const log = {
  debug: (event: string, details?: LogDetails) => record('debug', event, details),
  info: (event: string, details?: LogDetails) => record('info', event, details),
  warn: (event: string, details?: LogDetails) => record('warn', event, details),
  error: (event: string, details?: LogDetails) => record('error', event, details),
};

/** The kept entries, oldest first. */
export const recentLog = (): readonly LogEntry[] => [...entries];

/**
 * Calls `listener` with each entry recorded from now on, such as for usage statistics.
 * Returns a function that stops listening.
 */
export function onLogEntry(listener: (entry: LogEntry) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearLog(): void {
  entries.length = 0;
}

/** Whether entries are also written to the developer console (on outside tests). */
export function echoLogToConsole(enabled: boolean): void {
  echo = enabled;
}

/** The parts of a thrown value worth keeping. Expected failures can leave out the stack. */
export function errorDetails(error: unknown, withStack = true): LogDetails {
  // Anything shaped like an error counts, since a `DOMException` is not an `Error` everywhere.
  if (typeof error !== 'object' || error === null || !('message' in error))
    return { message: String(error) };
  const { name, message, stack } = error as Partial<Error>;
  return {
    name: String(name ?? 'Error'),
    message: String(message),
    ...(withStack && typeof stack === 'string'
      ? {
          stack: stack
            .split('\n')
            .slice(0, STACK_FRAMES + 1)
            .join('\n'),
        }
      : {}),
  };
}
