// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../../src/app/App';
import { DriveSync } from '../../../../src/application/drive-sync';
import {
  DriveAuthError,
  type AuthEvent,
  type DriveAuth,
  type DriveItem,
} from '../../../../src/adapters/drive/types';
import { serializeBoard } from '../../../../src/adapters/files/stormlet-format';
import { clearLog, recentLog } from '../../../../src/adapters/diagnostics/log';
import type { Board } from '../../../../src/domain/model';
import type { RemoteLink } from '../../../../src/domain/sync/remote';
import { boardOf, sticky } from '../../../support/boards';
import { ids, memoryStore } from '../../../support/app';
import { fakeDrive, memoryLinks } from '../../../support/drive';

/** Google sign-in as the app sees it, with picks answered by the test. */
function fakeAuth() {
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
    disconnect: vi.fn(async () => {
      token = null;
      emit('disconnected');
    }),
  } satisfies DriveAuth;
  return {
    ...auth,
    /** What another tab or the clock does to this connection. */
    elsewhere: {
      token: () => ((token = 'shared'), emit('connected')),
      expiring: () => ((expiring = true), emit('expiring')),
      expired: () => ((token = null), emit('expired')),
      disconnected: () => ((token = null), emit('disconnected')),
    },
  };
}

function renderWithDrive(board: Board = boardOf(sticky('a')), link: RemoteLink | null = null) {
  const auth = fakeAuth();
  const drive = fakeDrive();
  const store = memoryStore(board);
  const links = memoryLinks(link);
  const sync = new DriveSync(store, drive.remote, links);
  render(<App store={sync} drive={{ auth, sync }} newId={ids()} />);
  return { auth, drive, store, sync, links };
}

/** The linked file's sync status beside the board name; absent while nothing is linked. */
const driveButton = () => screen.getByRole('button', { name: /^Google Drive:/ });
const noDriveButton = () =>
  expect(screen.queryByRole('button', { name: /^Google Drive:/ })).not.toBeInTheDocument();
const openFileMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: '파일' }));
  return screen.getByRole('menu', { name: '파일' });
};
/** Run a File menu item once Google's scripts have loaded and it is enabled. */
async function chooseFromFile(name: string) {
  const item = within(openFileMenu()).getByRole('menuitem', { name });
  await waitFor(() => expect(item).toBeEnabled());
  fireEvent.click(item);
}

afterEach(() => clearLog());

describe('Google Drive', () => {
  it('is absent from builds without Drive', () => {
    render(<App store={memoryStore()} newId={ids()} />);
    expect(screen.queryByRole('button', { name: /^Google Drive/ })).not.toBeInTheDocument();
  });

  it('connects, saves the board to a chosen folder and shows it is saved', async () => {
    const { auth, drive, sync } = renderWithDrive({ ...boardOf(sticky('a')), title: 'Plan' });
    // Nothing is linked: the local badge shows where the board is kept.
    noDriveButton();
    expect(screen.getByText('브라우저에 자동 저장')).toBeInTheDocument();
    const menu = openFileMenu();
    expect(within(menu).getByText('Google 서비스 불러오는 중…')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Drive 폴더에 저장…' })).toBeDisabled();
    expect(auth.prepare).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '파일' })).toHaveFocus();

    auth.pick.mockResolvedValueOnce({ id: 'folder', name: 'Boards' });
    await chooseFromFile('Drive 폴더에 저장…');
    // Signing in happens within the click; the menu is gone before Google's Picker opens.
    expect(auth.connect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(
      await screen.findByText('Plan.stormlet을(를) Drive에 저장했습니다.'),
    ).toBeInTheDocument();
    expect(auth.pick).toHaveBeenCalledWith('folder', {
      language: 'ko',
      title: '이 보드를 저장할 폴더 선택',
    });
    // Connecting first looks for a file an earlier page saved without hearing back.
    expect(drive.calls).toEqual(['unconfirmed', 'create folder']);
    expect(driveButton()).toHaveAccessibleName('Google Drive: Drive에 저장됨');
    expect(driveButton()).toHaveTextContent('저장됨');
    expect(screen.queryByText('브라우저에 자동 저장')).not.toBeInTheDocument();
    expect(sync.current.status).toBe('synced');

    const linked = openFileMenu();
    expect(
      within(linked)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual([
      '열기…⌘ / Ctrl+O',
      '파일로 내려받기⌘ / Ctrl+S',
      'Drive에서 열기…',
      '다른 폴더에 사본 저장…',
      '지금 동기화',
      '동기화 중지',
      'Google Drive 연결 해제',
    ]);
    fireEvent.keyDown(linked, { key: 'Escape' });
    fireEvent.click(driveButton());
    const details = screen.getByRole('dialog', { name: 'Google Drive' });
    expect(within(details).getByText('Plan.stormlet')).toBeInTheDocument();
  });

  it('links a file saved just before the page closed once connected', async () => {
    const { auth, drive, links } = renderWithDrive({ ...boardOf(sticky('a')), title: 'Plan' });
    drive.files.set('made', { name: 'Plan.stormlet', version: 1, board: boardOf() });
    drive.unseen.id = 'made';
    act(() => auth.elsewhere.token());
    expect(
      await screen.findByText(
        '페이지를 닫기 직전 Drive에 저장한 Plan.stormlet을(를) 찾아 다시 연결했습니다.',
      ),
    ).toBeInTheDocument();
    expect(links.link?.file.id).toBe('made');
    expect(recentLog().map((entry) => entry.event)).toContain('drive.recovered');
  });

  it('opens a board from Drive without saving it back', async () => {
    const { auth, drive, links } = renderWithDrive();
    drive.files.set('remote', {
      name: 'Shared.stormlet',
      version: 4,
      board: { ...boardOf(sticky('r', { text: 'from drive' })), title: 'Shared' },
    });
    auth.pick.mockResolvedValueOnce({ id: 'remote', name: 'Shared.stormlet' });
    await chooseFromFile('Drive에서 열기…');
    expect(
      await screen.findByText('Drive에서 Shared.stormlet을(를) 열었습니다.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '도메인 이벤트: from drive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '보드 이름: Shared' })).toBeInTheDocument();
    expect(links.link?.file).toEqual({ id: 'remote', name: 'Shared.stormlet', version: '4' });
    expect(drive.calls).toEqual(['unconfirmed', 'open remote']);
  });

  it('reconnects a remembered file from the toolbar and resolves conflicts there', async () => {
    const base = boardOf(sticky('a', { text: 'start' }), sticky('b', { text: 'start' }));
    const link = { file: { id: 'file1', name: 'board.stormlet', version: '1' }, base };
    const local = boardOf(sticky('a', { text: 'mine' }), sticky('b', { text: 'mine' }));
    const { auth, drive, store } = renderWithDrive(local, link);
    drive.files.set('file1', {
      name: 'board.stormlet',
      version: 2,
      board: boardOf(sticky('a', { text: 'theirs' }), sticky('b', { text: 'theirs' })),
    });
    expect(driveButton()).toHaveTextContent('다시 연결');
    // Google's scripts load ahead, so this click can open the sign-in popup itself.
    await waitFor(() => expect(auth.prepare).toHaveBeenCalled());
    await act(async () => {});
    fireEvent.click(driveButton());
    expect(auth.connect).toHaveBeenCalled();
    await waitFor(() => expect(driveButton()).toHaveTextContent('충돌'));
    expect(recentLog().map((entry) => entry.event)).toContain('drive.sync-conflict');

    fireEvent.click(driveButton());
    const dialog = screen.getByRole('dialog', { name: '남길 변경 선택' });
    const groups = within(dialog).getAllByRole('group', { name: '포스트잇 “mine”: 내용' });
    expect(groups).toHaveLength(2);
    expect(within(groups[0]).getByRole('radio', { name: '내 변경 mine' })).toBeChecked();
    fireEvent.click(within(groups[1]).getByRole('radio', { name: 'Drive theirs' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '선택대로 적용' }));
    await waitFor(() => expect(driveButton()).toHaveTextContent('저장됨'));
    const saved = drive.files.get('file1')!.board;
    expect([saved.stickies.a.text, saved.stickies.b.text]).toEqual(['mine', 'theirs']);
    expect([store.board.stickies.a.text, store.board.stickies.b.text]).toEqual(['mine', 'theirs']);
  });

  it('can take every conflict from one side at once', async () => {
    const base = boardOf(sticky('a', { text: 'start' }));
    const link = { file: { id: 'file1', name: 'board.stormlet', version: '1' }, base };
    const { drive, store } = renderWithDrive(boardOf(sticky('a', { text: 'mine' })), link);
    drive.files.set('file1', {
      name: 'board.stormlet',
      version: 2,
      board: boardOf(sticky('a', { text: 'theirs' })),
    });
    await act(async () => {});
    fireEvent.click(driveButton());
    await waitFor(() => expect(driveButton()).toHaveTextContent('충돌'));
    fireEvent.click(driveButton());
    const dialog = screen.getByRole('dialog', { name: '남길 변경 선택' });
    fireEvent.click(within(dialog).getByRole('button', { name: '모두 Drive 것으로' }));
    expect(within(dialog).getByRole('radio', { name: 'Drive theirs' })).toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: '모두 내 변경으로' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '모두 Drive 것으로' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '선택대로 적용' }));
    await waitFor(() => expect(store.board.stickies.a.text).toBe('theirs'));
  });

  it('stops syncing when a local file replaces the board, and on disconnect', async () => {
    const { auth, sync } = renderWithDrive();
    auth.pick.mockResolvedValueOnce({ id: 'folder', name: 'Boards' });
    await chooseFromFile('Drive 폴더에 저장…');
    await waitFor(() => expect(sync.current.status).toBe('synced'));

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const content = serializeBoard(boardOf(sticky('x')));
    const file = new File([content], 'local.stormlet');
    // jsdom's File has no text(); the browser's does.
    Object.defineProperty(file, 'text', { value: async () => content });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText('local.stormlet을(를) 열었습니다.')).toBeInTheDocument();
    expect(sync.current.status).toBe('unlinked');

    noDriveButton();
    await chooseFromFile('Google Drive 연결 해제');
    expect(await screen.findByText('Google Drive 연결을 해제했습니다.')).toBeInTheDocument();
    expect(auth.disconnect).toHaveBeenCalled();
  });

  it('reports failed actions and logs them', async () => {
    const { auth } = renderWithDrive();
    auth.connect.mockRejectedValueOnce(new DriveAuthError('cancelled'));
    await chooseFromFile('Drive에서 열기…');
    expect(
      await screen.findByText('Google 로그인이 취소되었거나 차단되었습니다.'),
    ).toBeInTheDocument();
    expect(auth.pick).not.toHaveBeenCalled();
    expect(recentLog().map((entry) => entry.event)).toContain('drive.open-failed');
  });

  it('follows a token, an expiry and a disconnect from another tab', async () => {
    const link = {
      file: { id: 'file1', name: 'board.stormlet', version: '1' },
      base: boardOf(sticky('a')),
    };
    const { auth, drive, sync } = renderWithDrive(boardOf(sticky('a', { text: 'offline' })), link);
    drive.files.set('file1', { name: 'board.stormlet', version: 1, board: boardOf(sticky('a')) });
    expect(driveButton()).toHaveTextContent('다시 연결');
    act(() => auth.elsewhere.token());
    // No popup here: the other tab's token resumes saving.
    await waitFor(() => expect(driveButton()).toHaveTextContent('저장됨'));
    expect(auth.connect).not.toHaveBeenCalled();
    expect(drive.files.get('file1')!.board.stickies.a.text).toBe('offline');

    act(() => auth.elsewhere.expired());
    expect(driveButton()).toHaveTextContent('다시 연결');
    act(() => auth.elsewhere.token());
    await waitFor(() => expect(driveButton()).toHaveTextContent('저장됨'));
    act(() => auth.elsewhere.disconnected());
    expect(sync.current.status).toBe('unlinked');
    noDriveButton();
  });

  it('renews expiring access on the next click, and from the button after a failure', async () => {
    const { auth, sync } = renderWithDrive();
    auth.pick.mockResolvedValueOnce({ id: 'folder', name: 'Boards' });
    await chooseFromFile('Drive 폴더에 저장…');
    await waitFor(() => expect(sync.current.status).toBe('synced'));
    expect(auth.connect).toHaveBeenCalledTimes(1);

    act(() => auth.elsewhere.expiring());
    expect(driveButton()).toHaveAccessibleName(
      'Google Drive: Drive 접근 권한이 곧 끝납니다. 눌러서 연장하세요.',
    );
    expect(driveButton()).toHaveTextContent('연장');
    // Keys never renew: the popup would take focus mid-typing.
    fireEvent.keyDown(window, { key: 'a' });
    expect(auth.connect).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('application', { name: '포스트잇 보드' }));
    await waitFor(() => expect(driveButton()).toHaveTextContent('저장됨'));
    expect(auth.connect).toHaveBeenCalledTimes(2);

    // A closed popup stops renewing on clicks; the button still renews and says why not.
    act(() => auth.elsewhere.expiring());
    auth.connect.mockRejectedValueOnce(new DriveAuthError('cancelled'));
    fireEvent.click(screen.getByRole('application', { name: '포스트잇 보드' }));
    await waitFor(() => expect(auth.connect).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole('application', { name: '포스트잇 보드' }));
    expect(auth.connect).toHaveBeenCalledTimes(3);
    auth.connect.mockRejectedValueOnce(new DriveAuthError('cancelled'));
    fireEvent.click(driveButton());
    expect(
      await screen.findByText(
        'Drive 접근 권한을 연장하지 못했습니다. 끝나기 전에 연장을 다시 눌러 주세요.',
      ),
    ).toBeInTheDocument();
    expect(auth.connect).toHaveBeenCalledTimes(4);
    fireEvent.click(driveButton());
    await waitFor(() => expect(driveButton()).toHaveTextContent('저장됨'));
    expect(recentLog().map((entry) => entry.event)).toEqual(
      expect.arrayContaining(['drive.renewed', 'drive.renew-failed']),
    );
  });
});
