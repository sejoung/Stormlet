// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../../../src/app/App';
import { DriveAuthError } from '../../../../src/adapters/drive/types';
import { serializeBoard } from '../../../../src/adapters/files/stormlet-format';
import { clearLog, recentLog } from '../../../../src/adapters/diagnostics/log';
import { boardOf, sticky } from '../../../support/boards';
import { ids, memoryStore } from '../../../support/app';
import {
  chooseFromFile,
  driveButton,
  noDriveButton,
  openFileMenu,
  renderWithDrive,
} from './support';

afterEach(() => clearLog());

describe('Google Drive', () => {
  it('is absent from builds without Drive', () => {
    render(<App store={memoryStore()} newId={ids()} />);
    expect(screen.queryByRole('button', { name: /^Google Drive/ })).not.toBeInTheDocument();
  });

  it('connects, saves the board to a chosen folder and shows it is saved', async () => {
    const { auth, drive, sync } = renderWithDrive({ ...boardOf(sticky('a')), title: 'Plan' });
    // Nothing is linked: the badge says the board is only here, and the button offers Drive.
    noDriveButton();
    expect(screen.getByText('이 브라우저에만 저장됨')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google Drive 연결' })).toBeInTheDocument();
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
      await screen.findByText('Drive의 Boards 폴더에 Plan.stormlet을(를) 저장했습니다.'),
    ).toBeInTheDocument();
    expect(auth.pick).toHaveBeenCalledWith('folder', {
      language: 'ko',
      title: '이 보드를 저장할 폴더 선택',
    });
    // Connecting first looks for a file an earlier page saved without hearing back.
    expect(drive.calls).toEqual(['unconfirmed', 'create folder']);
    expect(driveButton()).toHaveAccessibleName('Google Drive: Drive에 저장됨');
    expect(driveButton()).toHaveTextContent('저장됨');
    expect(screen.queryByText('이 브라우저에만 저장됨')).not.toBeInTheDocument();
    expect(screen.getByText('Google Drive에 자동 저장')).toBeInTheDocument();
    expect(sync.current.status).toBe('synced');

    const linked = openFileMenu();
    expect(
      within(linked)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual([
      '새 보드…',
      '열기…⌘ / Ctrl+O',
      // ⌘/Ctrl+S saves to Drive while the board is linked there.
      '파일로 내려받기',
      'PNG 이미지로 내보내기',
      'SVG 이미지로 내보내기',
      'Drive에서 열기…',
      '다른 폴더에 사본 저장…',
      '지금 동기화⌘ / Ctrl+S',
      '동기화 중지',
      'Google Drive 연결 해제…',
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
    // The conflict is logged from an effect, which React may run a tick after the button
    // shows it; asserting right away fails on a slow CI runner.
    await waitFor(() =>
      expect(recentLog().map((entry) => entry.event)).toContain('drive.sync-conflict'),
    );

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
    await chooseFromFile('Google Drive 연결 해제…');
    fireEvent.click(screen.getByRole('button', { name: '연결 해제' }));
    expect(await screen.findByText(/Google Drive 연결을 해제했습니다/)).toBeInTheDocument();
    expect(auth.disconnect).toHaveBeenCalledWith(false);
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
    // Disconnecting elsewhere pauses: the file is kept for when access comes back.
    act(() => auth.elsewhere.disconnected());
    expect(driveButton()).toHaveTextContent('다시 연결');
    act(() => auth.elsewhere.disconnected(true));
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

  it('saves to Drive before a new board stops syncing, and keeps the board when it cannot', async () => {
    const { auth, drive, sync } = renderWithDrive(boardOf(sticky('a', { text: 'kept' })));
    auth.pick.mockResolvedValueOnce({ id: 'folder', name: 'Boards' });
    await chooseFromFile('Drive 폴더에 저장…');
    await waitFor(() => expect(sync.current.status).toBe('synced'));
    act(() => sync.apply([{ op: 'set', id: 'a', field: 'text', value: 'pending' }]));
    await chooseFromFile('새 보드…');
    const dialog = screen.getByRole('dialog', { name: '새 보드' });
    expect(dialog).toHaveTextContent('Drive의 board.stormlet에 남습니다');
    fireEvent.click(within(dialog).getByRole('button', { name: '새 보드 만들기' }));
    expect(await screen.findByText(/새 보드를 만들었습니다/)).toBeInTheDocument();
    expect(drive.files.get('file1')!.board.stickies.a.text).toBe('pending');
    expect(sync.current.status).toBe('unlinked');
    noDriveButton();

    // Access lapsed with changes waiting: the board stays as it is.
    const link = { file: { id: 'file1', name: 'b.stormlet', version: '9' }, base: boardOf() };
    cleanup();
    const paused = renderWithDrive(boardOf(sticky('x')), link);
    await chooseFromFile('새 보드…');
    fireEvent.click(screen.getByRole('button', { name: '새 보드 만들기' }));
    expect(
      await screen.findByText(/Drive에 아직 저장하지 못한 변경이 있어 새 보드를 만들지 않았습니다/),
    ).toBeInTheDocument();
    expect(Object.keys(paused.store.board.stickies)).toEqual(['x']);
    expect(paused.sync.current.status).toBe('paused');
  });
});
