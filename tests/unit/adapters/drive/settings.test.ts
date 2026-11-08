// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { driveConfig } from '../../../../src/adapters/drive/config';
import {
  DRIVE_BASE_KEY,
  DRIVE_FILE_KEY,
  LocalDriveLinks,
} from '../../../../src/adapters/drive/links';
import {
  openAuthChannel,
  parseAuthMessage,
  type AuthMessage,
} from '../../../../src/adapters/drive/auth-channel';
import { DRIVE_CREATING_KEY, LocalCreations } from '../../../../src/adapters/drive/creations';
import { clearLog, recentLog } from '../../../../src/adapters/diagnostics/log';
import { boardOf, sticky } from '../../../support/boards';

afterEach(() => {
  localStorage.clear();
  clearLog();
});

describe('Drive configuration', () => {
  it('enables Drive only with all three public values', () => {
    expect(driveConfig({})).toBeNull();
    expect(
      driveConfig({
        VITE_GOOGLE_CLIENT_ID: 'c',
        VITE_GOOGLE_API_KEY: ' k ',
        VITE_GOOGLE_APP_ID: '',
      }),
    ).toBeNull();
    expect(
      driveConfig({
        VITE_GOOGLE_CLIENT_ID: 'c',
        VITE_GOOGLE_API_KEY: ' k ',
        VITE_GOOGLE_APP_ID: '1',
      }),
    ).toEqual({ clientId: 'c', apiKey: 'k', appId: '1' });
  });
});

describe('Drive link storage', () => {
  const link = {
    file: { id: 'f1', name: 'Plan.stormlet', version: '3' },
    base: { ...boardOf(sticky('a')), title: 'Plan' },
  };

  it('remembers the linked file and its base board, and forgets both', () => {
    const links = new LocalDriveLinks();
    expect(links.read()).toBeNull();
    links.write(link);
    expect(JSON.parse(localStorage.getItem(DRIVE_FILE_KEY)!)).toEqual(link.file);
    expect(new LocalDriveLinks().read()).toEqual(link);
    links.write(null);
    expect(localStorage.getItem(DRIVE_FILE_KEY)).toBeNull();
    expect(localStorage.getItem(DRIVE_BASE_KEY)).toBeNull();
  });

  it('keeps a separate link for each board slot', () => {
    new LocalDriveLinks('one').write(link);
    expect(new LocalDriveLinks('two').read()).toBeNull();
    expect(new LocalDriveLinks('one').read()).toEqual(link);
    expect(localStorage.getItem(`${DRIVE_FILE_KEY}.one`)).not.toBeNull();
    expect(localStorage.getItem(DRIVE_FILE_KEY)).toBeNull();
  });

  it('ignores a broken record and logs it', () => {
    const links = new LocalDriveLinks();
    links.write(link);
    localStorage.setItem(DRIVE_FILE_KEY, JSON.stringify({ id: 'f1', name: 'x' }));
    expect(links.read()).toBeNull();
    localStorage.setItem(DRIVE_FILE_KEY, '{');
    expect(links.read()).toBeNull();
    expect(recentLog().map((entry) => entry.event)).toEqual([
      'drive.link-unreadable',
      'drive.link-unreadable',
    ]);
  });
});

describe('pending creation storage', () => {
  it('keeps one record for each board slot', () => {
    new LocalCreations('one').write({ folderId: 'folder', id: 'reserved', at: 5 });
    expect(new LocalCreations('two').read()).toBeNull();
    expect(new LocalCreations('one').read()).toMatchObject({ id: 'reserved' });
    expect(localStorage.getItem(DRIVE_CREATING_KEY)).toBeNull();
  });

  it('keeps the reserved ID across pages, and ignores a broken record', () => {
    const creation = { folderId: 'folder', id: 'reserved', at: 5 };
    new LocalCreations().write(creation);
    expect(new LocalCreations().read()).toEqual(creation);
    new LocalCreations().write(null);
    expect(localStorage.getItem(DRIVE_CREATING_KEY)).toBeNull();
    for (const broken of ['{', '{"folderId":"folder","id":"","at":5}', 'null']) {
      localStorage.setItem(DRIVE_CREATING_KEY, broken);
      expect(new LocalCreations().read()).toBeNull();
    }
  });
});

describe('auth channel between tabs', () => {
  it('accepts only well-formed messages', () => {
    expect(parseAuthMessage({ type: 'request' })).toEqual({ type: 'request' });
    expect(parseAuthMessage({ type: 'disconnected', extra: 1 })).toEqual({ type: 'disconnected' });
    expect(parseAuthMessage({ type: 'expired', token: 't' })).toEqual({
      type: 'expired',
      token: 't',
    });
    expect(parseAuthMessage({ type: 'token', token: 't', expiresIn: 5 })).toEqual({
      type: 'token',
      token: 't',
      expiresIn: 5,
    });
    for (const bad of [
      null,
      'request',
      { type: 'expired' },
      { type: 'token', token: '', expiresIn: 5 },
      { type: 'token', token: 't', expiresIn: -1 },
      { type: 'token', token: 't', expiresIn: Infinity },
      { type: 'other' },
    ])
      expect(parseAuthMessage(bad)).toBeNull();
  });

  it('carries messages between tabs of the same client', async () => {
    const one = openAuthChannel('client')!;
    const two = openAuthChannel('client')!;
    const other = openAuthChannel('another')!;
    const received: AuthMessage[] = [];
    const strays: AuthMessage[] = [];
    two.listen((message) => received.push(message));
    other.listen((message) => strays.push(message));
    one.post({ type: 'token', token: 't', expiresIn: 1000 });
    await vi.waitFor(() =>
      expect(received).toEqual([{ type: 'token', token: 't', expiresIn: 1000 }]),
    );
    expect(strays).toEqual([]);
  });

  it('is absent where the browser has no channels', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    expect(openAuthChannel('client')).toBeNull();
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor() {
          throw new Error('blocked');
        }
      },
    );
    expect(openAuthChannel('client')).toBeNull();
    vi.unstubAllGlobals();
  });
});
