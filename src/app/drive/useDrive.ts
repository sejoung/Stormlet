import { useCallback, useEffect, useRef, useState } from 'react';
import type { Board } from '../../domain/model';
import { RemoteError } from '../../domain/sync/remote';
import type { Side } from '../../domain/sync/merge';
import type { DriveSync, SyncState } from '../../application/drive-sync';
import {
  DriveAuthError,
  type AuthEvent,
  type DriveAuth,
  type DriveItem,
} from '../../adapters/drive/types';
import { isEmptyBoard } from '../../domain/model';
import type { SavedFolder } from '../../adapters/drive/links';
import { useAuthRenewal } from './useAuthRenewal';
import { errorDetails, log } from '../../adapters/diagnostics/log';
import { useLocale, useT } from '../../components/common/i18n';
import type { MessageKey } from '../../i18n/messages';

/** Google Drive for this build; absent when it is not configured. */
export interface DriveServices {
  auth: DriveAuth;
  sync: DriveSync;
  /** The folder boards are saved to, shared by every tab, with the account it is in. */
  folder: { read(): SavedFolder | null; write(folder: SavedFolder | null): void };
  /** This tab started from an empty board, so its first edit goes to the folder. */
  startedEmpty?: boolean;
}

interface Options {
  services: DriveServices | undefined;
  /** The board on screen, so a new board can go to Drive once it has something on it. */
  board: Board;
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
export function useDrive({ services, board, flushEditor, replaceBoard, onStatus }: Options) {
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
      // Disconnecting keeps the file to continue with after reconnecting; forgetting drops it.
      else if (event === 'disconnected') sync.pause();
      else if (event === 'forgotten') {
        autoSave.current = false;
        sync.unlink();
      }
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
  /** Save the board as a new file in `folder`, and make it the folder for every tab. */
  /** The shared folder, unless it is in another account than the one connected now. */
  const sharedFolder = async (drive: DriveServices) => {
    const folder = drive.folder.read();
    if (!folder?.account) return folder;
    const current = await drive.sync.account();
    return !current || current.id === folder.account ? folder : null;
  };
  const createIn = async (drive: DriveServices, folder: DriveItem) => {
    const current = await drive.sync.account();
    drive.folder.write({ id: folder.id, name: folder.name, account: current?.id });
    const file = await drive.sync.create(folder.id);
    onStatus(t('drive.savedIn', { name: file.name, folder: folder.name }));
  };
  const saveToFolder = () =>
    run('drive.create-failed', async (drive) => {
      flushEditor();
      await access(drive);
      const folder = await pick(drive, 'folder');
      if (folder) await createIn(drive, folder);
    });
  const syncNow = () => {
    flushEditor();
    if (services?.auth.getToken()) void services.sync.saveNow();
    // Saving resumes when the token arrives.
    else run('drive.connect-failed', ({ auth }) => auth.connect());
  };

  // A board started in this tab goes to the shared folder with its first edit, so Drive,
  // not this browser, is where new work lives. Stopping sync here turns that off.
  const autoSave = useRef(services?.startedEmpty ?? false);
  const linked = 'file' in state;
  const firstEdit = !isEmptyBoard(board);
  useEffect(() => {
    if (!services || !autoSave.current) return;
    if (linked) autoSave.current = false;
    if (linked || !connected || !firstEdit) return;
    const folder = services.folder.read();
    if (!folder) return;
    autoSave.current = false;
    run('drive.create-failed', async (drive) => {
      const shared = await sharedFolder(drive);
      if (shared) await createIn(drive, shared);
    });
    // `run` and `createIn` change every render; the conditions above are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, linked, connected, firstEdit]);

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
    /** Where this board is kept, for the badge beside its name. */
    savedTo: !services ? undefined : linked ? ('drive' as const) : ('browser-only' as const),
    /** The folder boards are saved to; null until one is chosen. */
    folder: () => services?.folder.read() ?? null,
    saveToFolder,
    /** Save this board to Drive: into the shared folder, or a folder chosen now. */
    saveToDrive: () =>
      run('drive.create-failed', async (drive) => {
        flushEditor();
        await access(drive);
        const folder = (await sharedFolder(drive)) ?? (await pick(drive, 'folder'));
        if (folder) await createIn(drive, folder);
      }),
    /**
     * Give access to the linked file again by choosing it in the Picker, e.g. after
     * reconnecting when Drive no longer lets Stormlet see it; then continue syncing.
     */
    relink: () =>
      run('drive.open-failed', async (drive) => {
        await access(drive);
        const picked = await pick(drive, 'file');
        if (!picked) return;
        const { current } = drive.sync;
        if (!('file' in current) || picked.id !== current.file.id)
          return onStatus(t('drive.relinkOther'));
        await drive.sync.resume();
      }),
    /** ⌘/Ctrl+S: save the linked file now, or `download` a board not in Drive. */
    saveOr: (download: () => void) => () => (linked ? syncNow() : download()),
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
    syncNow,
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
    unlink: () => {
      autoSave.current = false;
      services?.sync.unlink();
    },
    /**
     * Withdraw Google's access in every tab. The tabs keep their files and the folder, so
     * reconnecting continues where they were; with `forget`, they drop those too.
     */
    disconnect: (forget = false) =>
      run('drive.disconnect-failed', async ({ auth, sync, folder }) => {
        if (forget) {
          autoSave.current = false;
          sync.unlink();
          folder.write(null);
        } else sync.pause();
        await auth.disconnect(forget);
        onStatus(t(forget ? 'drive.forgotten' : 'drive.disconnected'));
      }),
  };
}

export type Drive = ReturnType<typeof useDrive>;
