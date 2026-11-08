import { useCallback, useEffect, useRef, useState } from 'react';
import type { Board } from '../../domain/model';
import { RemoteError } from '../../domain/sync/remote';
import type { Side } from '../../domain/sync/merge';
import type { DriveSync, SyncState } from '../../application/drive-sync';
import { DriveAuthError, type AuthEvent, type DriveAuth } from '../../adapters/drive/types';
import { useAuthRenewal } from './useAuthRenewal';
import { errorDetails, log } from '../../adapters/diagnostics/log';
import { useLocale, useT } from '../../components/common/i18n';
import type { MessageKey } from '../../i18n/messages';

/** Google Drive for this build; absent when it is not configured. */
export interface DriveServices {
  auth: DriveAuth;
  sync: DriveSync;
}

interface Options {
  services: DriveServices | undefined;
  flushEditor(): void;
  /** Put an opened board on the canvas, titled after `name` when it has no title. */
  replaceBoard(board: Board, name: string): void;
  onStatus(message: string): void;
}

const UNLINKED: SyncState = { status: 'unlinked' };

/** The message for a failed Drive action. */
function failure(error: unknown): MessageKey {
  if (error instanceof DriveAuthError)
    return error.reason === 'revoke'
      ? 'drive.revokeFailed'
      : error.reason === 'cancelled'
        ? 'drive.error.cancelled'
        : 'drive.error.unavailable';
  if (error instanceof RemoteError)
    return error.reason === 'auth' ? 'drive.failure.auth' : `drive.failure.${error.reason}`;
  return 'drive.failure.unknown';
}

/**
 * Google Drive for the workspace: the connection, the linked file's sync state, and the
 * actions behind the Drive dialog. Every action reports failures as a status message and
 * in the diagnostics log; none of them touches the board unless it succeeds.
 */
export function useDrive({ services, flushEditor, replaceBoard, onStatus }: Options) {
  const t = useT();
  const locale = useLocale();
  const [state, setState] = useState<SyncState>(() => services?.sync.current ?? UNLINKED);
  const [connected, setConnected] = useState(() => Boolean(services?.auth.getToken()));
  const [ready, setReady] = useState(() => services?.auth.ready() ?? false);
  const [busy, setBusy] = useState(false);

  useEffect(() => services?.sync.watch(setState), [services]);
  /** Reports a file found again by `recover`; kept current without resubscribing below. */
  const recovered = useRef<(name: string) => void>(() => {});
  recovered.current = (name) => onStatus(t('drive.recovered', { name }));
  // Connections, expiries and disconnects come from this tab or from another one.
  useEffect(() => {
    if (!services) return;
    const { auth, sync } = services;
    const follow = (event: AuthEvent) => {
      setConnected(auth.getToken() !== null);
      const { status } = sync.current;
      if (event === 'connected' && status === 'paused') void sync.resume();
      // A file saved just before the page closed is linked again once connected.
      else if (event === 'connected' && status === 'unlinked')
        sync.recover().then(
          (file) => {
            if (!file) return;
            log.info('drive.recovered');
            recovered.current(file.name);
          },
          (error: unknown) => log.warn('drive.recover-failed', errorDetails(error)),
        );
      else if (event === 'expired') sync.pause();
      else if (event === 'disconnected') sync.unlink();
    };
    const unsubscribe = auth.subscribe(follow);
    // Another tab may have handed over its token before this subscribed.
    if (auth.getToken()) follow('connected');
    return unsubscribe;
  }, [services]);
  const renewal = useAuthRenewal(services?.auth, connected && 'file' in state, onStatus);
  useEffect(() => {
    if (state.status === 'failed')
      log.warn('drive.sync-failed', { reason: state.reason, message: state.detail });
    else if (state.status === 'conflict')
      log.warn('drive.sync-conflict', { conflicts: state.conflicts.length });
    else if (state.status === 'paused') log.info('drive.sync-paused');
  }, [state]);

  const prepare = useCallback(async () => {
    if (!services || services.auth.ready()) return;
    try {
      await services.auth.prepare();
      setReady(true);
    } catch (error) {
      log.warn('drive.load-failed', errorDetails(error, false));
      onStatus(t('drive.error.unavailable'));
    }
  }, [services, onStatus, t]);

  // A remembered file waits for reconnecting, which must open Google's popup at once.
  const remembered = services?.sync.current.status === 'paused';
  useEffect(() => {
    if (remembered) void prepare();
  }, [remembered, prepare]);

  /** Run `action`, reporting a failure; the action's first step still runs in the click. */
  const run = (event: string, action: (drive: DriveServices) => Promise<void>) => {
    if (!services) return;
    setBusy(true);
    action(services)
      .catch((error: unknown) => {
        log.warn(event, errorDetails(error));
        onStatus(t(failure(error)));
      })
      .finally(() => setBusy(false));
  };
  /** Sign in first when needed; the popup opens because this still runs in the click. */
  const access = async ({ auth }: DriveServices) => {
    if (!auth.getToken()) await auth.connect();
  };
  const pick = (drive: DriveServices, kind: 'file' | 'folder') =>
    drive.auth.pick(kind, {
      language: locale,
      title: t(kind === 'file' ? 'drive.pickFile' : 'drive.pickFolder'),
    });

  return {
    available: Boolean(services),
    state,
    connected,
    expiring: renewal.expiring,
    renew: renewal.renew,
    ready,
    busy,
    prepare,
    connect: () =>
      // Saving resumes when the token arrives, as it does when another tab connects.
      run('drive.connect-failed', ({ auth }) => auth.connect()),
    saveToFolder: () =>
      run('drive.create-failed', async (drive) => {
        flushEditor();
        await access(drive);
        const folder = await pick(drive, 'folder');
        if (!folder) return;
        const file = await drive.sync.create(folder.id);
        onStatus(t('drive.saved', { name: file.name }));
      }),
    open: () =>
      run('drive.open-failed', async (drive) => {
        flushEditor();
        await access(drive);
        const picked = await pick(drive, 'file');
        if (!picked) return;
        if (!(await drive.sync.settle())) return onStatus(t('drive.openBlocked'));
        const opened = await drive.sync.open(picked.id);
        // Linked first, so putting the board in place does not save it back.
        drive.sync.linkOpened(opened);
        replaceBoard(opened.board, opened.file.name);
        onStatus(t('drive.opened', { name: opened.file.name }));
      }),
    saveNow: () => {
      flushEditor();
      void services?.sync.saveNow();
    },
    /** Save the linked file now, reconnecting first if access ended. */
    syncNow: () => {
      flushEditor();
      if (services?.auth.getToken()) void services.sync.saveNow();
      // Saving resumes when the token arrives.
      else run('drive.connect-failed', ({ auth }) => auth.connect());
    },
    /**
     * Before a new board replaces this one: save what is pending to the linked file, then
     * stop syncing. False, with a message, when that cannot be saved now.
     */
    release: async () => {
      if (!services || !('file' in services.sync.current)) return true;
      flushEditor();
      if (!(await services.sync.settle())) {
        onStatus(t('drive.newBlocked'));
        return false;
      }
      services.sync.unlink();
      return true;
    },
    resolve: (choices: Record<string, Side>) => void services?.sync.resolve(choices),
    unlink: () => services?.sync.unlink(),
    disconnect: () =>
      run('drive.disconnect-failed', async ({ auth, sync }) => {
        sync.unlink();
        await auth.disconnect();
        onStatus(t('drive.disconnected'));
      }),
  };
}

export type Drive = ReturnType<typeof useDrive>;
