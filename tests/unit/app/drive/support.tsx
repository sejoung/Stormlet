import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { App } from '../../../../src/app/App';
import { DriveSync } from '../../../../src/application/drive-sync';
import type { AuthEvent, DriveAuth, DriveItem } from '../../../../src/adapters/drive/types';
import type { SavedFolder } from '../../../../src/adapters/drive/links';
import type { Board } from '../../../../src/domain/model';
import type { BoardLibrary } from '../../../../src/domain/store';
import type { RemoteLink } from '../../../../src/domain/sync/remote';
import { boardOf, sticky } from '../../../support/boards';
import { ids, memoryStore } from '../../../support/app';
import { fakeDrive, memoryLinks } from '../../../support/drive';

/** Google sign-in as the app sees it, with picks answered by the test. */
export function fakeAuth() {
  let token: string | null = null;
  let loaded = false;
  let expiring = false;
  const listeners = new Set<(event: AuthEvent) => void>();
  const emit = (event: AuthEvent) => listeners.forEach((listener) => listener(event));
  const auth = {
    getToken: () => token,
    expiring: () => token !== null && expiring,
    subscribe: (listener: (event: AuthEvent) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clearToken: vi.fn(() => {}),
    prepare: vi.fn(async () => {
      loaded = true;
    }),
    ready: () => loaded,
    connect: vi.fn(async () => {
      token = 'token';
      expiring = false;
      emit('connected');
    }),
    pick: vi.fn(async (): Promise<DriveItem | null> => null),
    disconnect: vi.fn(async (forget = false) => {
      token = null;
      emit(forget ? 'forgotten' : 'disconnected');
    }),
  } satisfies DriveAuth;
  return {
    ...auth,
    /** What another tab or the clock does to this connection. */
    elsewhere: {
      token: () => ((token = 'shared'), emit('connected')),
      expiring: () => ((expiring = true), emit('expiring')),
      expired: () => ((token = null), emit('expired')),
      disconnected: (forget = false) => (
        (token = null),
        emit(forget ? 'forgotten' : 'disconnected')
      ),
    },
  };
}

/** The Drive folder shared by every tab, kept in memory. */
export function memoryFolder(folder: SavedFolder | null = null) {
  return {
    folder,
    read() {
      return this.folder;
    },
    write(next: SavedFolder | null) {
      this.folder = next;
    },
  };
}

export function renderWithDrive(
  board: Board = boardOf(sticky('a')),
  link: RemoteLink | null = null,
  options: { folder?: SavedFolder; startedEmpty?: boolean; library?: BoardLibrary } = {},
) {
  const auth = fakeAuth();
  const drive = fakeDrive();
  const store = memoryStore(board);
  const links = memoryLinks(link);
  const sync = new DriveSync(store, drive.remote, links);
  const folder = memoryFolder(options.folder);
  const services = { auth, sync, folder, startedEmpty: options.startedEmpty };
  render(<App store={sync} drive={services} newId={ids()} library={options.library} />);
  return { auth, drive, store, sync, links, folder };
}

/** The linked file's sync status beside the board name; absent while nothing is linked. */
export const driveButton = () => screen.getByRole('button', { name: /^Google Drive:/ });
export const noDriveButton = () =>
  expect(screen.queryByRole('button', { name: /^Google Drive:/ })).not.toBeInTheDocument();
export const openFileMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: '파일' }));
  return screen.getByRole('menu', { name: '파일' });
};
/** Run a File menu item once Google's scripts have loaded and it is enabled. */
export async function chooseFromFile(name: string) {
  const item = within(openFileMenu()).getByRole('menuitem', { name });
  await waitFor(() => expect(item).toBeEnabled());
  fireEvent.click(item);
}
