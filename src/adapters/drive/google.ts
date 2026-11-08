import type { GoogleConfig } from './config';
import { loadScript } from './script-loader';
import { showPicker } from './picker';
import {
  DriveAuthError,
  type DriveAuth,
  type DriveItem,
  type PickKind,
  type PickOptions,
} from './types';

export const IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
export const PICKER_SCRIPT = 'https://apis.google.com/js/api.js';
/** Access to files Stormlet creates or the user opens with it, and nothing else. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const PICKER_TIMEOUT_MS = 15_000;
const REVOKE_TIMEOUT_MS = 10_000;
/** Google reports the lifetime in seconds; stop using a token a little before it lapses. */
const EXPIRY_MARGIN_S = 30;

/**
 * Google sign-in with a memory-only access token (ADR 0010): it is never written to any
 * browser storage, so a reload needs the user to reconnect. Google's token model has no
 * refresh token, and its popup needs a user gesture, so nothing reconnects on its own.
 * `getToken` is an arrow property because the Drive client receives it as a callback.
 */
export class GoogleConnection implements DriveAuth {
  private token: string | null = null;
  private expiry: ReturnType<typeof setTimeout> | null = null;
  private loaded = false;
  /** Bumped by `disconnect`, so a popup answered afterwards is ignored. */
  private generation = 0;
  private readonly listeners = new Set<(connected: boolean) => void>();

  constructor(private readonly config: GoogleConfig) {}

  getToken = (): string | null => this.token;

  subscribe(listener: (connected: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  ready(): boolean {
    return this.loaded;
  }

  async prepare(): Promise<void> {
    await Promise.all([loadScript(IDENTITY_SCRIPT), loadScript(PICKER_SCRIPT)]);
    const gapi = window.gapi;
    if (!gapi) throw new DriveAuthError('unavailable', 'The Picker loader is missing.');
    await new Promise<void>((resolve, reject) =>
      gapi.load('picker', {
        callback: resolve,
        onerror: () => reject(new DriveAuthError('unavailable', 'Could not load the Picker.')),
        timeout: PICKER_TIMEOUT_MS,
        ontimeout: () => reject(new DriveAuthError('unavailable', 'Timed out loading the Picker.')),
      }),
    );
    this.loaded = true;
  }

  connect(): Promise<void> {
    const oauth = window.google?.accounts?.oauth2;
    if (!oauth)
      return Promise.reject(new DriveAuthError('unavailable', 'Google sign-in is not loaded.'));
    const generation = this.generation;
    return new Promise((resolve, reject) => {
      const client = oauth.initTokenClient({
        client_id: this.config.clientId,
        scope: DRIVE_SCOPE,
        callback: (result) => {
          if (generation !== this.generation || result.error || !result.access_token) {
            reject(new DriveAuthError('cancelled', result.error ?? 'No access was granted.'));
            return;
          }
          const lifetime = Math.max(0, (result.expires_in ?? 3600) - EXPIRY_MARGIN_S) * 1000;
          this.keep(result.access_token, lifetime);
          resolve();
        },
        error_callback: () =>
          reject(new DriveAuthError('cancelled', 'The sign-in window was closed or blocked.')),
      });
      // An empty prompt skips the consent screen when the user already agreed.
      client.requestAccessToken({ prompt: '' });
    });
  }

  async pick(kind: PickKind, options: PickOptions): Promise<DriveItem | null> {
    const token = this.token;
    const api = window.google?.picker;
    if (!token || !api) throw new DriveAuthError('unavailable', 'Connect Google Drive first.');
    return showPicker(kind, {
      ...options,
      api,
      token,
      apiKey: this.config.apiKey,
      appId: this.config.appId,
    });
  }

  async disconnect(): Promise<void> {
    const token = this.token;
    this.generation++;
    this.keep(null, 0);
    if (token) await revoke(token);
  }

  /** Hold `token` for `lifetime` ms and announce both ends of it. */
  private keep(token: string | null, lifetime: number): void {
    const was = this.token !== null;
    this.token = token;
    if (this.expiry !== null) clearTimeout(this.expiry);
    this.expiry = token ? setTimeout(() => this.keep(null, 0), lifetime) : null;
    if (was !== (token !== null)) for (const listener of this.listeners) listener(token !== null);
  }
}

/** Withdraw Google's consent for `token`; rejects unless Google confirms it in time. */
function revoke(token: string): Promise<void> {
  const oauth = window.google?.accounts?.oauth2;
  if (!oauth) return Promise.reject(new DriveAuthError('revoke', 'Google sign-in is not loaded.'));
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new DriveAuthError('revoke', 'Google did not confirm in time.')),
      REVOKE_TIMEOUT_MS,
    );
    oauth.revoke(token, (result) => {
      clearTimeout(timer);
      if (result?.successful) resolve();
      else reject(new DriveAuthError('revoke', result?.error ?? 'Google refused.'));
    });
  });
}
