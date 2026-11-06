/**
 * Guarded Web Storage. Privacy settings, sandboxed frames and full quotas make every access
 * throw, and the app keeps working without it, so failures read as absent and writes are
 * dropped.
 */
export function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The current session keeps its in-memory state.
  }
}
