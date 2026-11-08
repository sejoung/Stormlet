import { DriveAuthError } from './types';

const LOAD_TIMEOUT_MS = 15_000;
// One download per script; a failed or stalled one is forgotten so the next call retries.
const scripts = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  if (!scripts.has(src))
    scripts.set(
      src,
      new Promise((resolve, reject) => {
        const element = document.createElement('script');
        element.src = src;
        element.async = true;
        const fail = (message: string) => {
          clearTimeout(timer);
          scripts.delete(src);
          element.remove();
          reject(new DriveAuthError('unavailable', message));
        };
        const timer = window.setTimeout(() => fail(`Timed out loading ${src}`), LOAD_TIMEOUT_MS);
        element.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        element.onerror = () => fail(`Could not load ${src}`);
        document.head.append(element);
      }),
    );
  return scripts.get(src)!;
}
