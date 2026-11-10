// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DRIVE_SCOPE,
  GoogleConnection,
  RENEW_BEFORE,
  IDENTITY_SCRIPT,
  PICKER_SCRIPT,
} from '../../../../src/adapters/drive/google';
import { DriveAuthError, type AuthEvent } from '../../../../src/adapters/drive/types';
import type { AuthMessage } from '../../../../src/adapters/drive/auth-channel';
import type { GoogleApi, TokenResponse } from '../../../../src/adapters/drive/google-types';
import { clearLog } from '../../../../src/adapters/diagnostics/log';

const config = { clientId: 'client', apiKey: 'key', appId: 'app' };

/** Google's scripts as the tests drive them: answers to sign-in and Picker are queued. */
function fakeGoogle() {
  const answers: (TokenResponse | 'closed')[] = [];
  const requested: { client_id: string; scope: string; prompt: string; login_hint?: string }[] = [];
  const revoked: string[] = [];
  let revokeResult = { successful: true };
  const built: Record<string, unknown>[] = [];
  let pickAnswer: { action: string; docs?: { id: string; name: string }[] } = { action: 'cancel' };
  class DocsView {
    settings: Record<string, unknown> = {};
    constructor(readonly id: unknown) {}
    setIncludeFolders = (value: boolean) => ((this.settings.folders = value), this);
    setSelectFolderEnabled = (value: boolean) => ((this.settings.selectFolders = value), this);
    setMode = () => this;
    setParent = (value: string) => ((this.settings.parent = value), this);
    setMimeTypes = (value: string) => ((this.settings.mimeTypes = value), this);
  }
  class PickerBuilder {
    options: Record<string, unknown> = {};
    callback: (result: typeof pickAnswer) => void = () => {};
    setLocale = (value: string) => ((this.options.locale = value), this);
    setTitle = (value: string) => ((this.options.title = value), this);
    setDeveloperKey = (value: string) => ((this.options.key = value), this);
    setAppId = (value: string) => ((this.options.appId = value), this);
    setOAuthToken = (value: string) => ((this.options.token = value), this);
    setOrigin = () => this;
    addView = (view: DocsView) => ((this.options.view = view.settings), this);
    setCallback = (callback: (result: typeof pickAnswer) => void) => (
      (this.callback = callback),
      this
    );
    build = () => {
      built.push(this.options);
      return {
        setVisible: () => {
          this.callback({ action: 'loaded' });
          this.callback(pickAnswer);
        },
        dispose: () => {},
      };
    };
  }
  const google = {
    accounts: {
      oauth2: {
        initTokenClient: (options: {
          client_id: string;
          scope: string;
          callback: (result: TokenResponse) => void;
          error_callback: () => void;
        }) => ({
          requestAccessToken: (request: { prompt: string; login_hint?: string }) => {
            requested.push({ client_id: options.client_id, scope: options.scope, ...request });
            const answer = answers.shift() ?? 'closed';
            if (answer === 'closed') options.error_callback();
            else options.callback(answer);
          },
        }),
        revoke: (token: string, callback: (result: { successful: boolean }) => void) => {
          revoked.push(token);
          callback(revokeResult);
        },
      },
    },
    picker: {
      PickerBuilder,
      DocsView,
      DocsViewMode: { LIST: 'list' },
      ViewId: { DOCS: 'docs', FOLDERS: 'folders' },
    },
  } as unknown as GoogleApi;
  return {
    google,
    answers,
    requested,
    revoked,
    built,
    pick: (answer: typeof pickAnswer) => (pickAnswer = answer),
    refuseRevoke: () => (revokeResult = { successful: false }),
  };
}

beforeEach(() => clearLog());
afterEach(() => {
  delete window.google;
  delete window.gapi;
  localStorage.clear();
  document.head.innerHTML = '';
  vi.useRealTimers();
});

describe('Google connection', () => {
  it('loads Google’s scripts and the Picker before connecting', async () => {
    const connection = new GoogleConnection(config);
    expect(connection.ready()).toBe(false);
    const prepared = connection.prepare();
    const scripts = [...document.head.querySelectorAll('script')].map((script) => script.src);
    expect(scripts).toEqual([IDENTITY_SCRIPT, PICKER_SCRIPT]);
    window.gapi = { load: (_name, options) => options.callback() };
    document.head
      .querySelectorAll('script')
      .forEach((script) => script.onload?.(new Event('load')));
    await prepared;
    expect(connection.ready()).toBe(true);
  });

  it('reports scripts that fail to load, and a missing Picker loader', async () => {
    // Loaded scripts are remembered per page, so this page starts from a fresh module.
    vi.resetModules();
    const fresh = await import('../../../../src/adapters/drive/google');
    const connection = new fresh.GoogleConnection(config);
    const prepared = connection.prepare();
    const [identity, picker] = document.head.querySelectorAll('script');
    identity.onerror?.(new Event('error'));
    await expect(prepared).rejects.toMatchObject({ reason: 'unavailable' });
    expect(document.head.querySelectorAll('script')).toHaveLength(1);
    // The failed script is tried again; the other one stays loaded.
    const again = connection.prepare();
    picker.onload?.(new Event('load'));
    const retried = [...document.head.querySelectorAll('script')].at(-1)!;
    expect(retried).not.toBe(picker);
    retried.onload?.(new Event('load'));
    await expect(again).rejects.toThrow('The Picker loader is missing.');
    expect(connection.ready()).toBe(false);
  });

  it('keeps a token in memory only, announcing its renewal window and its end', async () => {
    vi.useFakeTimers();
    const fake = fakeGoogle();
    window.google = fake.google;
    const connection = new GoogleConnection(config);
    const events: AuthEvent[] = [];
    connection.subscribe((event) => events.push(event));
    fake.answers.push({ access_token: 'token', expires_in: 3600 });
    await connection.connect();
    expect(fake.requested).toEqual([{ client_id: 'client', scope: DRIVE_SCOPE, prompt: '' }]);
    expect(connection.getToken()).toBe('token');
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('token');
    const lifetime = (3600 - 30) * 1000;
    await vi.advanceTimersByTimeAsync(lifetime - RENEW_BEFORE - 1);
    expect([connection.expiring(), events]).toEqual([false, ['connected']]);
    await vi.advanceTimersByTimeAsync(1);
    expect([connection.expiring(), events]).toEqual([true, ['connected', 'expiring']]);
    // Renewing replaces the token and starts a new schedule, suggesting the same account.
    fake.answers.push({ access_token: 'renewed', expires_in: 3600 });
    await connection.connect('me@example.com');
    expect(fake.requested.at(-1)).toMatchObject({ prompt: '', login_hint: 'me@example.com' });
    expect([connection.getToken(), connection.expiring()]).toEqual(['renewed', false]);
    await vi.advanceTimersByTimeAsync(lifetime);
    expect(connection.getToken()).toBeNull();
    expect(events).toEqual(['connected', 'expiring', 'connected', 'expiring', 'expired']);
  });

  it('hands its token to other tabs and follows theirs', async () => {
    vi.useFakeTimers();
    const fake = fakeGoogle();
    window.google = fake.google;
    const posted: AuthMessage[] = [];
    let receive: (message: AuthMessage) => void = () => {};
    const channel = {
      post: (message: AuthMessage) => posted.push(message),
      listen: (r: typeof receive) => (receive = r),
    };
    const connection = new GoogleConnection(config, channel);
    const events: AuthEvent[] = [];
    connection.subscribe((event) => events.push(event));
    // A new tab asks for a token, and nobody has one yet.
    expect(posted).toEqual([{ type: 'request' }]);
    receive({ type: 'request' });
    expect(posted).toHaveLength(1);

    receive({ type: 'token', token: 'theirs', expiresIn: 60_000 });
    expect(connection.getToken()).toBe('theirs');
    // An older token is ignored; a later one replaces it.
    receive({ type: 'token', token: 'older', expiresIn: 30_000 });
    expect(connection.getToken()).toBe('theirs');
    fake.answers.push({ access_token: 'mine', expires_in: 3600 });
    await connection.connect();
    expect(posted.at(-1)).toEqual({ type: 'token', token: 'mine', expiresIn: (3600 - 30) * 1000 });
    receive({ type: 'request' });
    expect(posted.at(-1)).toMatchObject({ type: 'token', token: 'mine' });

    // Only the refused token ends here.
    receive({ type: 'expired', token: 'theirs' });
    expect(connection.getToken()).toBe('mine');
    receive({ type: 'expired', token: 'mine' });
    expect(connection.getToken()).toBeNull();
    receive({ type: 'token', token: 'again', expiresIn: 60_000 });
    // A refusal of an older token leaves the current one alone.
    connection.clearToken('mine');
    expect(connection.getToken()).toBe('again');
    connection.clearToken('again');
    expect(connection.getToken()).toBeNull();
    expect(posted.at(-1)).toEqual({ type: 'expired', token: 'again' });

    // Disconnecting elsewhere ends this tab too, including a popup it still has open.
    fake.answers.push('closed');
    receive({ type: 'token', token: 'last', expiresIn: 60_000 });
    receive({ type: 'disconnected', forget: false });
    expect(connection.getToken()).toBeNull();
    expect(events).toEqual([
      'connected',
      'connected',
      'expired',
      'connected',
      'expired',
      'connected',
      'disconnected',
    ]);
    await connection.disconnect();
    expect(posted.at(-1)).toEqual({ type: 'disconnected', forget: false });
    await connection.disconnect(true);
    expect(posted.at(-1)).toEqual({ type: 'disconnected', forget: true });
    receive({ type: 'disconnected', forget: true });
    expect(events.at(-1)).toBe('forgotten');
    expect(fake.revoked).toEqual([]);
  });

  it('rejects closed, refused or missing sign-in', async () => {
    const connection = new GoogleConnection(config);
    await expect(connection.connect()).rejects.toMatchObject({ reason: 'unavailable' });
    const fake = fakeGoogle();
    window.google = fake.google;
    await expect(connection.connect()).rejects.toMatchObject({ reason: 'cancelled' });
    fake.answers.push({ error: 'access_denied' });
    await expect(connection.connect()).rejects.toThrow('access_denied');
    expect(connection.getToken()).toBeNull();
  });

  it('shows the Picker for folders and files with the user’s language', async () => {
    const fake = fakeGoogle();
    window.google = fake.google;
    const connection = new GoogleConnection(config);
    await expect(connection.pick('file', { language: 'en', title: 'Open' })).rejects.toBeInstanceOf(
      DriveAuthError,
    );
    fake.answers.push({ access_token: 'token' });
    await connection.connect();
    fake.pick({ action: 'picked', docs: [{ id: 'folder', name: 'Boards' }] });
    expect(await connection.pick('folder', { language: 'ko', title: '폴더' })).toEqual({
      id: 'folder',
      name: 'Boards',
    });
    fake.pick({ action: 'cancel' });
    expect(await connection.pick('file', { language: 'en', title: 'Open' })).toBeNull();
    expect(fake.built).toEqual([
      {
        locale: 'ko',
        title: '폴더',
        key: 'key',
        appId: 'app',
        token: 'token',
        view: {
          folders: true,
          selectFolders: true,
          parent: 'root',
          mimeTypes: 'application/vnd.google-apps.folder',
        },
      },
      expect.objectContaining({ view: { folders: true, selectFolders: false } }),
    ]);
  });

  it('forgets the token on disconnect and withdraws consent', async () => {
    const fake = fakeGoogle();
    window.google = fake.google;
    const connection = new GoogleConnection(config);
    await connection.disconnect();
    expect(fake.revoked).toEqual([]);
    fake.answers.push({ access_token: 'one' });
    await connection.connect();
    await connection.disconnect();
    expect(connection.getToken()).toBeNull();
    expect(fake.revoked).toEqual(['one']);
    fake.answers.push({ access_token: 'two' });
    await connection.connect();
    fake.refuseRevoke();
    await expect(connection.disconnect()).rejects.toMatchObject({ reason: 'revoke' });
    expect(connection.getToken()).toBeNull();
  });
});
