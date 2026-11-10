// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearLog } from '../../../../src/adapters/diagnostics/log';
import { serializeBoard } from '../../../../src/adapters/files/stormlet-format';
import type { Board } from '../../../../src/domain/model';
import type { Patch } from '../../../../src/domain/patch';
import type { BoardLibrary } from '../../../../src/domain/store';
import { boardOf, sticky } from '../../../support/boards';
import { chooseFromFile, driveButton, renderWithDrive } from './support';

const boards = { id: 'folder', name: 'Boards' };
const remoteBoard = { ...boardOf(sticky('r', { text: 'from drive' })), title: 'Shared' };
const setText = (value: string): Patch[] => [{ op: 'set', id: 'a', field: 'text', value }];

/** Choose a local `.stormlet` file holding `board` in the hidden file input. */
function openLocal(board: Board) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  const content = serializeBoard(board);
  const file = new File([content], 'local.stormlet');
  // jsdom's File has no text(); the browser's does.
  Object.defineProperty(file, 'text', { value: async () => content });
  fireEvent.change(input, { target: { files: [file] } });
}

/** A board saved to Drive as `file1` and synced, with Google connected. */
async function linked() {
  const setup = renderWithDrive(boardOf(sticky('a', { text: 'old' })));
  setup.auth.pick.mockResolvedValueOnce(boards);
  await chooseFromFile('Drive 폴더에 저장…');
  await waitFor(() => expect(setup.sync.current.status).toBe('synced'));
  return setup;
}

afterEach(() => clearLog());

describe('Google Drive keeps files safe', () => {
  it('opens a board from Drive as a fresh start, so undo cannot write the old one into it', async () => {
    const { auth, drive, sync, store } = await linked();
    act(() => sync.apply(setText('edited')));
    // An undoable edit first: its history belongs to the board being replaced.
    fireEvent.click(screen.getByRole('button', { name: '가운데 붙이기' }));
    expect(screen.getByRole('button', { name: '실행 취소' })).toBeEnabled();
    drive.files.set('remote', { name: 'Shared.stormlet', version: 4, board: remoteBoard });
    auth.pick.mockResolvedValueOnce({ id: 'remote', name: 'Shared.stormlet' });
    await chooseFromFile('Drive에서 열기…');
    await screen.findByText('Drive에서 Shared.stormlet을(를) 열었습니다.');
    expect(screen.getByRole('button', { name: '실행 취소' })).toBeDisabled();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(store.board).toEqual(remoteBoard);
    // Nothing differs from the opened file, so saving now writes nothing.
    await act(() => sync.saveNow());
    expect(drive.calls).not.toContain('save remote');
    expect(drive.files.get('remote')!.board).toEqual(remoteBoard);
    // The previous board went to its own file before the switch.
    expect(drive.files.get('file1')!.board.stickies.a.text).toBe('edited');
  });

  it('keeps a board that is only in this browser in Recent boards before opening over it', async () => {
    const library = {
      closed: async () => [],
      open: vi.fn(),
      startInTab: vi.fn(),
      remove: async () => true,
      keep: vi.fn<BoardLibrary['keep']>(() => true),
    };
    const local = boardOf(sticky('a', { text: 'only here' }));
    const { auth, drive, store, sync } = renderWithDrive(local, null, { library });
    drive.files.set('remote', { name: 'Shared.stormlet', version: 4, board: remoteBoard });
    // When storage cannot keep it, the board on screen stays and nothing is linked.
    library.keep.mockReturnValueOnce(false);
    auth.pick.mockResolvedValueOnce({ id: 'remote', name: 'Shared.stormlet' });
    await chooseFromFile('Drive에서 열기…');
    await screen.findByText(/저장 공간이 부족해 지금 보드를 보관할 수 없어 열지 않았습니다/);
    expect(store.board).toEqual(local);
    expect(sync.current.status).toBe('unlinked');

    auth.pick.mockResolvedValueOnce({ id: 'remote', name: 'Shared.stormlet' });
    await chooseFromFile('Drive에서 열기…');
    await screen.findByText(
      'Drive에서 Shared.stormlet을(를) 열었습니다. 이전 보드는 최근 보드에 있습니다.',
    );
    expect(library.keep).toHaveBeenLastCalledWith(local);
    expect(store.board).toEqual(remoteBoard);
  });

  it('saves edits made while a Drive file downloads to the previous file', async () => {
    const { auth, drive, sync, links } = await linked();
    drive.files.set('remote', { name: 'Shared.stormlet', version: 4, board: remoteBoard });
    auth.pick.mockResolvedValueOnce({ id: 'remote', name: 'Shared.stormlet' });
    const open = drive.remote.open;
    let downloaded = () => {};
    const download = new Promise<void>((resolve) => (downloaded = resolve));
    drive.remote.open = async (id) => {
      await download;
      return open(id);
    };
    await chooseFromFile('Drive에서 열기…');
    await waitFor(() => expect(auth.pick).toHaveBeenCalledTimes(2));
    act(() => sync.apply(setText('typed meanwhile')));
    await act(async () => downloaded());
    await screen.findByText('Drive에서 Shared.stormlet을(를) 열었습니다.');
    expect(drive.files.get('file1')!.board.stickies.a.text).toBe('typed meanwhile');
    expect(links.link?.file.id).toBe('remote');
  });

  it('saves pending Drive edits before a local file replaces the board', async () => {
    const { drive, sync, store } = await linked();
    act(() => sync.apply(setText('pending')));
    openLocal(boardOf(sticky('x')));
    await screen.findByText('local.stormlet을(를) 열었습니다.');
    expect(drive.files.get('file1')!.board.stickies.a.text).toBe('pending');
    expect(sync.current.status).toBe('unlinked');
    expect(Object.keys(store.board.stickies)).toEqual(['x']);
  });

  it('keeps the board when its Drive edits cannot be saved before opening a local file', async () => {
    const link = { file: { id: 'file1', name: 'b.stormlet', version: '1' }, base: boardOf() };
    const { store, sync } = renderWithDrive(boardOf(sticky('unsaved')), link);
    openLocal(boardOf(sticky('x')));
    expect(
      await screen.findByText(/지금 Drive 파일의 변경 내용이 아직 저장되지 않았습니다/),
    ).toBeInTheDocument();
    expect(Object.keys(store.board.stickies)).toEqual(['unsaved']);
    expect(sync.current.status).toBe('paused');
  });

  it('makes one file when Save to Drive is clicked twice', async () => {
    const { auth, drive, sync } = renderWithDrive(boardOf(sticky('a')), null, { folder: boards });
    act(() => auth.elsewhere.token());
    const save = await screen.findByRole('button', { name: 'Drive에 저장' });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(sync.current.status).toBe('synced'));
    await act(async () => {});
    expect(drive.calls.filter((call) => call.startsWith('create'))).toEqual(['create folder']);
  });

  it('checks the account of every token and asks Google for the linked one', async () => {
    const { auth, drive, sync } = await linked();
    // Another tab hands over access to another account while this file is synced.
    drive.who.account = { id: 'other', email: 'other@example.com' };
    act(() => auth.elsewhere.token());
    await waitFor(() =>
      expect(sync.current).toMatchObject({ status: 'failed', reason: 'account' }),
    );
    act(() => sync.apply(setText('not for this account')));
    await act(async () => {});
    expect(drive.calls.filter((call) => call.startsWith('save'))).toEqual([]);

    act(() => auth.elsewhere.expired());
    await waitFor(() => expect(driveButton()).toHaveTextContent('다시 연결'));
    drive.who.account = { id: 'me', email: 'me@example.com' };
    fireEvent.click(driveButton());
    expect(auth.connect).toHaveBeenLastCalledWith('me@example.com');
    await waitFor(() => expect(sync.current.status).toBe('synced'));
    expect(drive.files.get('file1')!.board.stickies.a.text).toBe('not for this account');
  });
});
