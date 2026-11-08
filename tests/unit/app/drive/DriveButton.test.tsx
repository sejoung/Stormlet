// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { clearLog } from '../../../../src/adapters/diagnostics/log';
import { boardOf, sticky } from '../../../support/boards';
import { driveButton, renderWithDrive } from './support';

const boards = { id: 'folder', name: 'Boards' };
const addNote = () => fireEvent.click(screen.getByRole('button', { name: '가운데 붙이기' }));

afterEach(() => clearLog());

describe('the Google Drive button', () => {
  it('connects, then saves into the folder every tab shares, without asking again', async () => {
    const { auth, drive, folder } = renderWithDrive(boardOf(sticky('a')), null, {
      folder: boards,
    });
    // Before Google's scripts load, the click opens the dialog that loads them.
    fireEvent.click(screen.getByRole('button', { name: 'Google Drive 연결' }));
    const dialog = screen.getByRole('dialog', { name: 'Google Drive' });
    await waitFor(() => expect(auth.prepare).toHaveBeenCalled());
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Google Drive 연결' }));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Google Drive 연결' }));
    expect(auth.connect).toHaveBeenCalledTimes(1);

    fireEvent.click(await screen.findByRole('button', { name: 'Drive에 저장' }));
    expect(
      await screen.findByText('Drive의 Boards 폴더에 board.stormlet을(를) 저장했습니다.'),
    ).toBeInTheDocument();
    expect(auth.pick).not.toHaveBeenCalled();
    expect(drive.calls).toContain('create folder');
    expect(driveButton()).toHaveTextContent('저장됨');
    expect(folder.read()).toEqual({ ...boards, account: 'me' });
  });

  it('asks for a folder the first time and remembers it for every tab', async () => {
    const { auth, folder } = renderWithDrive();
    act(() => auth.elsewhere.token());
    auth.pick.mockResolvedValueOnce({ id: 'picked', name: 'Retros' });
    fireEvent.click(screen.getByRole('button', { name: 'Drive에 저장' }));
    expect(await screen.findByText(/Drive의 Retros 폴더에/)).toBeInTheDocument();
    expect(folder.read()).toEqual({ id: 'picked', name: 'Retros', account: 'me' });
  });

  it('saves to Drive with ⌘/Ctrl+S once linked', async () => {
    const { auth, drive, sync } = renderWithDrive(boardOf(sticky('a')), null, {
      folder: boards,
    });
    act(() => auth.elsewhere.token());
    fireEvent.click(screen.getByRole('button', { name: 'Drive에 저장' }));
    await waitFor(() => expect(sync.current.status).toBe('synced'));
    act(() => sync.apply([{ op: 'set', id: 'a', field: 'text', value: 'now' }]));
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(drive.calls).toContain('save file1'));
    expect(drive.files.get('file1')!.board.stickies.a.text).toBe('now');
  });

  it('puts a board started in this tab into the shared folder with its first edit', async () => {
    const { auth, drive } = renderWithDrive(boardOf(), null, {
      folder: boards,
      startedEmpty: true,
    });
    act(() => auth.elsewhere.token());
    await act(async () => {});
    expect(drive.calls).not.toContain('create folder');
    addNote();
    expect(
      await screen.findByText('Drive의 Boards 폴더에 board.stormlet을(를) 저장했습니다.'),
    ).toBeInTheDocument();
    expect(driveButton()).toHaveTextContent('저장됨');
  });

  it('leaves boards that were here before alone', async () => {
    const { auth, drive } = renderWithDrive(boardOf(sticky('a')), null, { folder: boards });
    act(() => auth.elsewhere.token());
    addNote();
    await act(async () => {});
    expect(drive.calls).not.toContain('create folder');
  });
});
