import { errorDetails, log } from '../diagnostics/log';

/**
 * Guarded Web Storage. Privacy settings, sandboxed frames and full quotas make every access
 * throw, and the app keeps working without it, so failures read as absent and writes are
 * dropped. Each failure is logged, and writes report whether they landed.
 */
export function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    log.warn('storage.read-failed', { key, ...errorDetails(error, false) });
    return null;
  }
}

/** Returns false when the browser refused the write; the session keeps its in-memory state. */
export function writeItem(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    log.warn('storage.write-failed', { key, length: value.length, ...errorDetails(error, false) });
    return false;
  }
}

/** Characters each Stormlet key holds, for diagnosing a full quota. */
export function storageUsage(): Record<string, number> {
  try {
    const storage = window.localStorage;
    const usage: Record<string, number> = {};
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith('stormlet.')) usage[key] = storage.getItem(key)?.length ?? 0;
    }
    return usage;
  } catch {
    return {};
  }
}

/** A stable local key lets reactions toggle without a profile. */
export function reactionIdentity(): string {
  const key = 'stormlet.reactor';
  const previous = readItem(key);
  if (previous) return previous;
  const identity = crypto.randomUUID();
  writeItem(key, identity);
  return identity;
}
